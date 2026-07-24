import { supabase } from "@/lib/supabase";
import type { DailyLogRecord, LifeMediaUploadInput, LifePhotoRecord } from "@/types/domain";

type DailyLogRow = {
  id: string;
  log_date: string;
  content: string;
  linked_target_id: string | null;
  linked_target_title: string | null;
  linked_target_type: "schedule" | "todo" | "event" | null;
  created_at: string;
};

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
  linked_target_type: "schedule" | "todo" | "event" | null;
  taken_at: string | null;
  created_at: string;
};

const dailyLogColumns = "id,log_date,content,linked_target_id,linked_target_title,linked_target_type,created_at";
const lifePhotoColumns = "id,photo_date,file_name,file_path,mime_type,size_bytes,width,height,duration_seconds,caption,linked_target_id,linked_target_title,linked_target_type,taken_at,created_at";

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

async function getUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

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

function mapDailyLogRow(row: DailyLogRow): DailyLogRecord {
  return {
    id: row.id,
    date: row.log_date,
    content: row.content,
    linkedTargetId: row.linked_target_id ?? undefined,
    linkedTargetTitle: row.linked_target_title ?? undefined,
    linkedTargetType: row.linked_target_type ?? undefined,
    createdAt: row.created_at,
  };
}

async function mapLifePhotoRow(row: LifePhotoRow): Promise<LifePhotoRecord> {
  const signedUrl = await getLifePhotoSignedUrl(row.file_path);

  return {
    id: row.id,
    date: row.photo_date,
    fileName: row.file_name,
    filePath: row.file_path,
    fileUrl: signedUrl ?? undefined,
    mimeType: row.mime_type ?? undefined,
    sizeBytes: row.size_bytes === null ? undefined : Number(row.size_bytes),
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    durationSeconds: row.duration_seconds === null ? undefined : Number(row.duration_seconds),
    caption: row.caption ?? undefined,
    linkedTargetId: row.linked_target_id ?? undefined,
    linkedTargetTitle: row.linked_target_title ?? undefined,
    linkedTargetType: row.linked_target_type ?? undefined,
    takenAt: row.taken_at ?? undefined,
    createdAt: row.created_at,
  };
}

export async function fetchDailyLogsFromDb() {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("daily_logs")
    .select(dailyLogColumns)
    .order("log_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as DailyLogRow[]).map(mapDailyLogRow);
}

export async function createDailyLogInDb(date: string, content: string, linkedTarget?: { id: string; title: string; type: "schedule" | "todo" | "event" }) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("daily_logs")
    .insert({
      user_id: userId,
      log_date: date,
      content,
      linked_target_id: linkedTarget?.id ?? null,
      linked_target_title: linkedTarget?.title ?? null,
      linked_target_type: linkedTarget?.type ?? null,
    })
    .select(dailyLogColumns)
    .single();

  if (error) throw error;
  return mapDailyLogRow(data as DailyLogRow);
}

export async function updateDailyLogInDb(log: DailyLogRecord) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("daily_logs")
    .update({
      log_date: log.date,
      content: log.content,
      linked_target_id: log.linkedTargetId ?? null,
      linked_target_title: log.linkedTargetTitle ?? null,
      linked_target_type: log.linkedTargetType ?? null,
    })
    .eq("id", log.id)
    .select(dailyLogColumns)
    .single();

  if (error) throw error;
  return mapDailyLogRow(data as DailyLogRow);
}

export async function deleteDailyLogFromDb(id: string) {
  if (!supabase) return false;
  const { error } = await supabase.from("daily_logs").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function fetchLifePhotosFromDb() {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("life_photos")
    .select(lifePhotoColumns)
    .order("photo_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return Promise.all((data as LifePhotoRow[]).map(mapLifePhotoRow));
}

export async function uploadLifePhotosToDb(
  date: string,
  uploads: LifeMediaUploadInput[],
  caption?: string,
  linkedTarget?: { id: string; title: string; type: "schedule" | "todo" | "event" },
) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const uploadedRows: LifePhotoRow[] = [];

  for (const upload of uploads) {
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
        taken_at: file.lastModified ? new Date(file.lastModified).toISOString() : null,
      })
      .select(lifePhotoColumns)
      .single();

    if (error) throw createLifePhotoDbError("life_photos metadata insert failed", error);
    uploadedRows.push(data as LifePhotoRow);
  }

  return Promise.all(uploadedRows.map(mapLifePhotoRow));
}

export async function deleteLifePhotoFromDb(photo: Pick<LifePhotoRecord, "filePath" | "id">) {
  if (!supabase) return false;

  const { error: deleteError } = await supabase.from("life_photos").delete().eq("id", photo.id);
  if (deleteError) throw createLifePhotoDbError("life_photos metadata delete failed", deleteError);

  const { error: storageError } = await supabase.storage.from("life-media").remove([photo.filePath]);
  if (storageError) throw createLifePhotoDbError("life-media storage delete failed", storageError);

  return true;
}

async function getLifePhotoSignedUrl(path: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from("life-media").createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
