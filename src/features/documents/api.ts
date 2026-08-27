import { getCurrentUserId } from "@/lib/authUser";
import { supabase } from "@/lib/supabase";
import type { DocumentImageAsset, DocumentRecord } from "@/features/documents/types";
import {
  collectDocumentFilePathsFromBlocks,
  createDocumentRecord,
  hydrateDocumentImages,
  normalizeDocumentContent,
  stripTransientDocumentFields,
  summarizeDocument,
} from "@/features/documents/utils";

type DocumentRow = {
  content: unknown;
  created_at: string;
  icon: string | null;
  id: string;
  summary: string | null;
  title: string;
  updated_at: string;
};

const documentColumns = "id,title,icon,summary,content,created_at,updated_at";

function mapDocumentRow(row: DocumentRow, content: DocumentRecord["content"]): DocumentRecord {
  return {
    content,
    createdAt: row.created_at,
    icon: row.icon ?? undefined,
    id: row.id,
    summary: row.summary ?? undefined,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

async function getDocumentSignedUrl(path: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from("life-media").createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

export async function fetchDocumentsFromDb() {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase.from("documents").select(documentColumns).order("updated_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as DocumentRow[];
  return Promise.all(rows.map(async (row) => {
    const content = await hydrateDocumentImages(normalizeDocumentContent(row.content), getDocumentSignedUrl);
    return mapDocumentRow(row, content);
  }));
}

export async function createDocumentInDb() {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const draft = createDocumentRecord();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      content: stripTransientDocumentFields(draft.content),
      icon: draft.icon ?? null,
      summary: summarizeDocument(draft.title, draft.content),
      title: draft.title,
      user_id: userId,
    })
    .select(documentColumns)
    .single();

  if (error) throw error;
  const row = data as DocumentRow;
  const content = await hydrateDocumentImages(normalizeDocumentContent(row.content), getDocumentSignedUrl);
  return mapDocumentRow(row, content);
}

export async function updateDocumentInDb(document: DocumentRecord) {
  if (!supabase) return null;
  const summary = summarizeDocument(document.title, document.content);
  const { data, error } = await supabase
    .from("documents")
    .update({
      content: stripTransientDocumentFields(document.content),
      icon: document.icon?.trim() || null,
      summary,
      title: document.title.trim() || "제목 없는 문서",
    })
    .eq("id", document.id)
    .select(documentColumns)
    .single();

  if (error) throw error;
  const row = data as DocumentRow;
  const content = await hydrateDocumentImages(normalizeDocumentContent(row.content), getDocumentSignedUrl);
  return mapDocumentRow(row, content);
}

export async function uploadDocumentImageToDb(file: File, dimensions?: { height?: number; width?: number }) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "image";
  const safeExtension = extension?.replace(/[^a-zA-Z0-9]/g, "") || "image";
  const path = `${userId}/documents/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;

  const { error: uploadError } = await supabase.storage.from("life-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const fileUrl = await getDocumentSignedUrl(path);
  const asset: DocumentImageAsset = {
    fileName: file.name,
    filePath: path,
    fileUrl: fileUrl ?? undefined,
    height: dimensions?.height,
    mimeType: file.type || undefined,
    sizeBytes: file.size,
    width: dimensions?.width,
  };
  return asset;
}

export async function deleteDocumentStorageFiles(paths: string[]) {
  if (!supabase || paths.length === 0) return true;
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (uniquePaths.length === 0) return true;
  const { error } = await supabase.storage.from("life-media").remove(uniquePaths);
  if (error) throw error;
  return true;
}

export async function deleteDocumentFromDb(document: DocumentRecord) {
  if (!supabase) return false;
  const filePaths = collectDocumentFilePathsFromBlocks(document.content);
  if (filePaths.length > 0) await deleteDocumentStorageFiles(filePaths);
  const { data, error } = await supabase.from("documents").delete().eq("id", document.id).select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
