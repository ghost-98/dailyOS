import { getCurrentUserId } from "@/lib/authUser";
import { supabase } from "@/lib/supabase";
import type { DailyLogRecord } from "@/types/domain";

type DailyLogRow = {
  id: string;
  log_date: string;
  content: string;
  linked_target_id: string | null;
  linked_target_title: string | null;
  linked_target_type: "schedule" | "todo" | "event" | "activity" | null;
  created_at: string;
};

const dailyLogColumns = "id,log_date,content,linked_target_id,linked_target_title,linked_target_type,created_at";

function mapDailyLogRow(row: DailyLogRow): DailyLogRecord {
  return {
    id: row.id,
    date: row.log_date,
    content: row.content,
    linkedTargetId: row.linked_target_id ?? undefined,
    linkedTargetTitle: row.linked_target_title ?? undefined,
    linkedTargetType: row.linked_target_type === "schedule" ? "event" : row.linked_target_type ?? undefined,
    createdAt: row.created_at,
  };
}

export async function fetchDailyLogsFromDb() {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("daily_logs")
    .select(dailyLogColumns)
    .eq("user_id", userId)
    .order("log_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as DailyLogRow[]).map(mapDailyLogRow);
}

export async function createDailyLogInDb(date: string, content: string, linkedTarget?: { id: string; title: string; type: "todo" | "event" | "activity" }) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
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
  const userId = await getCurrentUserId();
  if (!userId) return null;

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
    .eq("user_id", userId)
    .select(dailyLogColumns)
    .single();

  if (error) throw error;
  return mapDailyLogRow(data as DailyLogRow);
}

export async function deleteDailyLogFromDb(id: string) {
  if (!supabase) return false;
  const userId = await getCurrentUserId();
  if (!userId) return false;
  const { error } = await supabase.from("daily_logs").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
  return true;
}
