import { supabase } from "@/lib/supabase";

const exportTables = [
  { name: "profiles", conflict: "user_id" },
  { name: "place_folders", conflict: "id" },
  { name: "places", conflict: "id" },
  { name: "tasks", conflict: "id" },
  { name: "calendar_events", conflict: "id" },
  { name: "daily_logs", conflict: "id" },
  { name: "life_photos", conflict: "id" },
  { name: "weight_records", conflict: "id" },
  { name: "workout_sessions", conflict: "id" },
  { name: "expense_records", conflict: "id" },
  { name: "place_folder_links", conflict: "id" },
  { name: "place_links", conflict: "id" },
  { name: "career_records", conflict: "id" },
  { name: "application_events", conflict: "id" },
  { name: "job_applications", conflict: "id" },
  { name: "job_application_steps", conflict: "id" },
  { name: "job_application_requirements", conflict: "id" },
  { name: "job_application_check_items", conflict: "id" },
  { name: "job_application_files", conflict: "id" },
  { name: "ai_extraction_drafts", conflict: "id" },
] as const;

const deleteTables = [...exportTables].reverse();

type ExportTableName = (typeof exportTables)[number]["name"];

type ExportRow = Record<string, unknown>;

type DailyOSExportPayload = {
  exportedAt: string;
  tables: Partial<Record<ExportTableName, ExportRow[]>>;
  version: 1;
};

async function getCurrentUser() {
  if (!supabase) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("로그인이 필요합니다.");
  return data.user;
}

export async function exportDailyOSData() {
  if (!supabase) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  const user = await getCurrentUser();
  const tables: DailyOSExportPayload["tables"] = {};

  for (const table of exportTables) {
    const { data, error } = await supabase.from(table.name).select("*").eq("user_id", user.id);
    if (error) throw error;
    tables[table.name] = (data ?? []) as ExportRow[];
  }

  return {
    exportedAt: new Date().toISOString(),
    tables,
    version: 1,
  } satisfies DailyOSExportPayload;
}

export function downloadDailyOSExport(payload: DailyOSExportPayload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dailyos-backup-${payload.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function importDailyOSData(file: File) {
  if (!supabase) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  const user = await getCurrentUser();
  const payload = JSON.parse(await file.text()) as Partial<DailyOSExportPayload>;
  if (payload.version !== 1 || !payload.tables) throw new Error("dailyOS 백업 파일 형식이 아닙니다.");

  for (const table of exportTables) {
    const rows = payload.tables[table.name];
    if (!rows?.length) continue;

    const scopedRows = rows.map((row) => ({
      ...row,
      email: table.name === "profiles" ? user.email ?? row.email ?? null : row.email,
      user_id: user.id,
    }));
    const { error } = await supabase.from(table.name).upsert(scopedRows, { onConflict: table.conflict });
    if (error) throw error;
  }
}

export async function deleteDailyOSData() {
  if (!supabase) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  const user = await getCurrentUser();
  const { data: photoRows } = await supabase.from("life_photos").select("file_path").eq("user_id", user.id);
  const filePaths = (photoRows ?? []).map((row) => String((row as { file_path: string }).file_path)).filter(Boolean);

  if (filePaths.length > 0) {
    const { error } = await supabase.storage.from("life-media").remove(filePaths);
    if (error) throw error;
  }

  for (const table of deleteTables) {
    const { error } = await supabase.from(table.name).delete().eq("user_id", user.id);
    if (error) throw error;
  }
}
