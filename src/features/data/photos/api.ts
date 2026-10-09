import { getCurrentUserId } from "@/lib/authUser";
import { supabase } from "@/lib/supabase";
import type { LifeMediaUploadInput, LifePhotoRecord } from "@/types/domain";

type LifePhotoRow = {
  id: string;
  photo_date: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | string | null;
  caption: string | null;
  linked_target_id: string | null;
  linked_target_title: string | null;
  linked_target_type: "schedule" | "todo" | "event" | "activity" | null;
  taken_at: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  created_at: string;
};

const lifePhotoColumns = "id,photo_date,file_name,file_path,mime_type,size_bytes,width,height,duration_seconds,caption,linked_target_id,linked_target_title,linked_target_type,taken_at,latitude,longitude,created_at";

type SupabaseErrorLike = {
  code?: unknown;
  details?: unknown;
  error?: unknown;
  hint?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
  statusCode?: unknown;
};

function getObjectErrorEntries(error: SupabaseErrorLike) {
  return Object.getOwnPropertyNames(error)
    .map((key) => [key, error[key as keyof SupabaseErrorLike]])
    .filter(([, value]) => value !== undefined && value !== null && value !== "");
}

function getSupabaseErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return String(error);

  const errorLike = error as SupabaseErrorLike;
  const directMessage = [errorLike.message, errorLike.error, errorLike.details, errorLike.hint].find((value) => typeof value === "string" && value.length > 0);
  if (directMessage) return directMessage;

  const entries = getObjectErrorEntries(errorLike);
  if (entries.length > 0) {
    return entries.map(([key, value]) => `${key}: ${String(value)}`).join(", ");
  }

  try {
    return JSON.stringify(error);
  } catch {
    return Object.prototype.toString.call(error);
  }
}

function createLifePhotoDbError(context: string, error: unknown) {
  const errorLike = error && typeof error === "object" ? (error as SupabaseErrorLike) : {};
  const status = errorLike.statusCode ?? errorLike.status;
  const code = errorLike.code;
  const suffix = [status ? `status=${status}` : null, code ? `code=${code}` : null].filter(Boolean).join(", ");
  const detail = getSupabaseErrorMessage(error);
  return new Error(`${context}: ${detail}${suffix ? ` (${suffix})` : ""}`);
}

async function mapLifePhotoRow(row: LifePhotoRow): Promise<LifePhotoRecord> {
  const signedUrl = await getLifePhotoSignedUrl(row.file_path);

  return {
    ...mapLifePhotoMetadataRow(row),
    fileUrl: signedUrl ?? undefined,
  };
}

function mapLifePhotoMetadataRow(row: LifePhotoRow): LifePhotoRecord {
  return {
    id: row.id,
    date: row.photo_date,
    fileName: row.file_name,
    filePath: row.file_path,
    mimeType: row.mime_type ?? undefined,
    sizeBytes: row.size_bytes === null ? undefined : Number(row.size_bytes),
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    durationSeconds: row.duration_seconds === null ? undefined : Number(row.duration_seconds),
    caption: row.caption ?? undefined,
    linkedTargetId: row.linked_target_id ?? undefined,
    linkedTargetTitle: row.linked_target_title ?? undefined,
    linkedTargetType: row.linked_target_type === "schedule" ? "event" : row.linked_target_type ?? undefined,
    takenAt: row.taken_at ?? undefined,
    latitude: row.latitude === null ? undefined : Number(row.latitude),
    longitude: row.longitude === null ? undefined : Number(row.longitude),
    createdAt: row.created_at,
  };
}

export async function fetchLifePhotosFromDb(date?: string) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const query = supabase
    .from("life_photos")
    .select(lifePhotoColumns)
    .eq("user_id", userId)
    .order("photo_date", { ascending: true })
    .order("created_at", { ascending: false });
  const { data, error } = date ? await query.eq("photo_date", date) : await query;

  if (error) throw error;
  return Promise.all((data as LifePhotoRow[]).map(mapLifePhotoRow));
}

export async function uploadLifePhotosToDb(
  date: string,
  uploads: LifeMediaUploadInput[],
  caption?: string,
  linkedTarget?: { id: string; title: string; type: "todo" | "event" | "activity" },
) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const uploadedRows = await Promise.all(uploads.map((upload) => uploadLifePhotoToDb(userId, date, upload, caption, linkedTarget)));
  return Promise.all(uploadedRows.map(mapLifePhotoRow));
}

async function uploadLifePhotoToDb(
  userId: string,
  date: string,
  upload: LifeMediaUploadInput,
  caption?: string,
  linkedTarget?: { id: string; title: string; type: "todo" | "event" | "activity" },
) {
  if (!supabase) throw new Error("Supabase client is not initialized.");

  const { file } = upload;
  const extension = file.name.includes(".") ? file.name.split(".").pop() : "photo";
  const safeExtension = extension?.replace(/[^a-zA-Z0-9]/g, "") || "photo";
  const path = `${userId}/${date}/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;

  const { error: uploadError } = await supabase.storage.from("life-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadError) throw createLifePhotoDbError("life-media storage upload failed", uploadError);

  const { data, error } = await supabase
    .from("life_photos")
    .insert({
      user_id: userId,
      photo_date: date,
      file_name: file.name,
      file_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      width: upload.width ?? null,
      height: upload.height ?? null,
      duration_seconds: upload.durationSeconds ?? null,
      caption: caption || null,
      linked_target_id: linkedTarget?.id ?? null,
      linked_target_title: linkedTarget?.title ?? null,
      linked_target_type: linkedTarget?.type ?? null,
      taken_at: upload.takenAt ?? (file.lastModified ? new Date(file.lastModified).toISOString() : null),
      latitude: upload.latitude ?? null,
      longitude: upload.longitude ?? null,
    })
    .select(lifePhotoColumns)
    .single();

  if (error) throw createLifePhotoDbError("life_photos metadata insert failed", error);
  return data as LifePhotoRow;
}

export async function deleteLifePhotoFromDb(photo: Pick<LifePhotoRecord, "filePath" | "id">) {
  if (!supabase) return false;
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { error: deleteError } = await supabase.from("life_photos").delete().eq("id", photo.id).eq("user_id", userId);
  if (deleteError) throw createLifePhotoDbError("life_photos metadata delete failed", deleteError);

  const { error: storageError } = await supabase.storage.from("life-media").remove([photo.filePath]);
  if (storageError) throw createLifePhotoDbError("life-media storage delete failed", storageError);

  return true;
}

export async function updateLifePhotoDetailsInDb(
  id: string,
  date: string,
  caption?: string,
  linkedTarget?: { id: string; title: string; type: "todo" | "event" | "activity" },
) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("life_photos")
    .update({
      caption: caption?.trim() || null,
      linked_target_id: linkedTarget?.id ?? null,
      linked_target_title: linkedTarget?.title ?? null,
      linked_target_type: linkedTarget?.type ?? null,
      photo_date: date,
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select(lifePhotoColumns)
    .single();

  if (error) throw createLifePhotoDbError("life_photos details update failed", error);
  return mapLifePhotoRow(data as LifePhotoRow);
}

async function getLifePhotoSignedUrl(path: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from("life-media").createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
