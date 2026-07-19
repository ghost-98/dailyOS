import { supabase } from "@/lib/supabase";
import type { DailyLogRecord, LifePhotoRecord } from "@/types/domain";

type DailyLogRow = {
  id: string;
  log_date: string;
  content: string;
  created_at: string;
};

type LifePhotoRow = {
  id: string;
  photo_date: string;
  file_name: string;
  file_path: string;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
};

const dailyLogColumns = "id,log_date,content,created_at";
const lifePhotoColumns = "id,photo_date,file_name,file_path,caption,taken_at,created_at";

async function getUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

function mapDailyLogRow(row: DailyLogRow): DailyLogRecord {
  return {
    id: row.id,
    date: row.log_date,
    content: row.content,
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
    caption: row.caption ?? undefined,
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

export async function createDailyLogInDb(date: string, content: string) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("daily_logs")
    .insert({
      user_id: userId,
      log_date: date,
      content,
    })
    .select(dailyLogColumns)
    .single();

  if (error) throw error;
  return mapDailyLogRow(data as DailyLogRow);
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

export async function uploadLifePhotosToDb(date: string, files: File[], caption?: string) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const uploadedRows: LifePhotoRow[] = [];

  for (const file of files) {
    const extension = file.name.includes(".") ? file.name.split(".").pop() : "photo";
    const safeExtension = extension?.replace(/[^a-zA-Z0-9]/g, "") || "photo";
    const path = `${userId}/${date}/${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;

    const { error: uploadError } = await supabase.storage.from("life-media").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from("life_photos")
      .insert({
        user_id: userId,
        photo_date: date,
        file_name: file.name,
        file_path: path,
        caption: caption || null,
        taken_at: file.lastModified ? new Date(file.lastModified).toISOString() : null,
      })
      .select(lifePhotoColumns)
      .single();

    if (error) throw error;
    uploadedRows.push(data as LifePhotoRow);
  }

  return Promise.all(uploadedRows.map(mapLifePhotoRow));
}

async function getLifePhotoSignedUrl(path: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from("life-media").createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
