import { getCurrentUserId } from "@/lib/authUser";
import { supabase } from "@/lib/supabase";
import type { TaskItem, TaskPriority, TaskStatus } from "@/types/domain";

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  scheduled_date: string;
  due_date: string | null;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean | null;
  completed_at: string | null;
  deferred_count: number;
  memo: string | null;
  expense_amount: number | string | null;
  companions: string | null;
  place_name: string | null;
  place_address: string | null;
  place_latitude: number | string | null;
  place_longitude: number | string | null;
  place_provider_id: string | null;
  place_phone: string | null;
  place_category: string | null;
  place_url: string | null;
};

type TaskInsert = Omit<TaskRow, "id"> & {
  user_id: string;
};

type TaskUpdate = Partial<Omit<TaskInsert, "user_id">>;

const taskColumns =
  "id,title,status,priority,scheduled_date,due_date,start_time,end_time,is_all_day,completed_at,deferred_count,memo,expense_amount,companions,place_name,place_address,place_latitude,place_longitude,place_provider_id,place_phone,place_category,place_url";

function mapRowPlace(row: TaskRow) {
  const latitude = row.place_latitude === null ? null : Number(row.place_latitude);
  const longitude = row.place_longitude === null ? null : Number(row.place_longitude);
  if (!row.place_name || latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;

  return {
    name: row.place_name,
    address: row.place_address ?? "",
    latitude,
    longitude,
    providerPlaceId: row.place_provider_id ?? undefined,
    phone: row.place_phone ?? undefined,
    category: row.place_category ?? undefined,
    url: row.place_url ?? undefined,
  };
}

function mapRowToTask(row: TaskRow): TaskItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    scheduledDate: row.scheduled_date,
    dueDate: row.due_date ?? undefined,
    startTime: row.start_time?.slice(0, 5) || undefined,
    endTime: row.end_time?.slice(0, 5) || undefined,
    isAllDay: row.is_all_day ?? true,
    completedAt: row.completed_at ?? undefined,
    deferredCount: row.deferred_count,
    memo: row.memo ?? undefined,
    expenseAmount: row.expense_amount === null ? undefined : Number(row.expense_amount),
    companions: row.companions ?? undefined,
    place: mapRowPlace(row),
  };
}

function mapTaskToInsert(task: TaskItem, userId: string): TaskInsert {
  return {
    user_id: userId,
    title: task.title,
    status: task.status,
    priority: task.priority,
    scheduled_date: task.scheduledDate,
    due_date: task.dueDate ?? null,
    start_time: task.isAllDay ? null : task.startTime ?? null,
    end_time: task.isAllDay ? null : task.endTime ?? null,
    is_all_day: task.isAllDay ?? true,
    completed_at: task.completedAt ?? null,
    deferred_count: task.deferredCount,
    memo: task.memo ?? null,
    expense_amount: task.expenseAmount ?? null,
    companions: task.companions ?? null,
    place_name: task.place?.name ?? null,
    place_address: task.place?.address ?? null,
    place_latitude: task.place?.latitude ?? null,
    place_longitude: task.place?.longitude ?? null,
    place_provider_id: task.place?.providerPlaceId ?? null,
    place_phone: task.place?.phone ?? null,
    place_category: task.place?.category ?? null,
    place_url: task.place?.url ?? null,
  };
}

function mapTaskToUpdate(task: TaskItem): TaskUpdate {
  return {
    title: task.title,
    status: task.status,
    priority: task.priority,
    scheduled_date: task.scheduledDate,
    due_date: task.dueDate ?? null,
    start_time: task.isAllDay ? null : task.startTime ?? null,
    end_time: task.isAllDay ? null : task.endTime ?? null,
    is_all_day: task.isAllDay ?? true,
    completed_at: task.completedAt ?? null,
    deferred_count: task.deferredCount,
    memo: task.memo ?? null,
    expense_amount: task.expenseAmount ?? null,
    companions: task.companions ?? null,
    place_name: task.place?.name ?? null,
    place_address: task.place?.address ?? null,
    place_latitude: task.place?.latitude ?? null,
    place_longitude: task.place?.longitude ?? null,
    place_provider_id: task.place?.providerPlaceId ?? null,
    place_phone: task.place?.phone ?? null,
    place_category: task.place?.category ?? null,
    place_url: task.place?.url ?? null,
  };
}

export async function fetchTasksFromDb() {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("tasks")
    .select(taskColumns)
    .eq("user_id", userId)
    .order("scheduled_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as TaskRow[]).map(mapRowToTask);
}

export async function createTaskInDb(task: TaskItem) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("tasks")
    .insert(mapTaskToInsert(task, userId))
    .select(taskColumns)
    .single();

  if (error) throw error;
  return mapRowToTask(data as TaskRow);
}

export async function updateTaskInDb(task: TaskItem) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("tasks")
    .update(mapTaskToUpdate(task))
    .eq("id", task.id)
    .eq("user_id", userId)
    .select(taskColumns)
    .single();

  if (error) throw error;
  return mapRowToTask(data as TaskRow);
}

export async function deleteTaskFromDb(id: string) {
  if (!supabase) return false;
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { error } = await supabase.from("tasks").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
  return true;
}



