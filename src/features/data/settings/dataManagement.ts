import { requireCurrentUser } from "@/lib/authUser";
import { supabase } from "@/lib/supabase";

const exportTables = [
  { name: "profiles", conflict: "user_id" },
  { name: "tasks", conflict: "id" },
  { name: "calendar_events", conflict: "id" },
  { name: "life_activities", conflict: "id" },
  { name: "daily_logs", conflict: "id" },
  { name: "life_photos", conflict: "id" },
  { name: "weight_records", conflict: "id" },
  { name: "workout_sessions", conflict: "id" },
  { name: "expense_records", conflict: "id" },
  { name: "income_records", conflict: "id" },
  { name: "people", conflict: "id" },
  { name: "saved_places", conflict: "id" },
  { name: "activity_categories", conflict: "id" },
] as const;

const deleteTables = [...exportTables].reverse();

type ExportTableName = (typeof exportTables)[number]["name"];

type ExportRow = Record<string, unknown>;

type DailyOSExportPayload = {
  exportedAt: string;
  tables: Partial<Record<ExportTableName, ExportRow[]>>;
  version: 1;
};

export async function exportDailyOSData() {
  if (!supabase) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  const user = await requireCurrentUser();
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
  const user = await requireCurrentUser();
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
  const user = await requireCurrentUser();
  const { data: photoRows } = await supabase.from("life_photos").select("file_path").eq("user_id", user.id);
  const filePaths = (photoRows ?? []).map((row) => String((row as { file_path: string }).file_path)).filter(Boolean);
  const storagePaths = [...new Set(filePaths)];

  if (storagePaths.length > 0) {
    const { error } = await supabase.storage.from("life-media").remove(storagePaths);
    if (error) throw error;
  }

  for (const table of deleteTables) {
    const { error } = await supabase.from(table.name).delete().eq("user_id", user.id);
    if (error) throw error;
  }
}




