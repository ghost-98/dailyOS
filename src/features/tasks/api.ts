import { supabase } from "@/lib/supabase";
import type { TaskItem, TaskPriority, TaskStatus } from "@/types/domain";

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  scheduled_date: string;
  due_date: string | null;
  completed_at: string | null;
  deferred_count: number;
  memo: string | null;
};

type TaskInsert = Omit<TaskRow, "id"> & {
  user_id: string;
};

type TaskUpdate = Partial<Omit<TaskInsert, "user_id">>;

async function getUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

function mapRowToTask(row: TaskRow): TaskItem {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    scheduledDate: row.scheduled_date,
    dueDate: row.due_date ?? undefined,
    completedAt: row.completed_at ?? undefined,
    deferredCount: row.deferred_count,
    memo: row.memo ?? undefined,
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
    completed_at: task.completedAt ?? null,
    deferred_count: task.deferredCount,
    memo: task.memo ?? null,
  };
}

function mapTaskToUpdate(task: TaskItem): TaskUpdate {
  return {
    title: task.title,
    status: task.status,
    priority: task.priority,
    scheduled_date: task.scheduledDate,
    due_date: task.dueDate ?? null,
    completed_at: task.completedAt ?? null,
    deferred_count: task.deferredCount,
    memo: task.memo ?? null,
  };
}

export async function fetchTasksFromDb() {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("tasks")
    .select("id,title,status,priority,scheduled_date,due_date,completed_at,deferred_count,memo")
    .order("scheduled_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as TaskRow[]).map(mapRowToTask);
}

export async function createTaskInDb(task: TaskItem) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("tasks")
    .insert(mapTaskToInsert(task, userId))
    .select("id,title,status,priority,scheduled_date,due_date,completed_at,deferred_count,memo")
    .single();

  if (error) throw error;
  return mapRowToTask(data as TaskRow);
}

export async function updateTaskInDb(task: TaskItem) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("tasks")
    .update(mapTaskToUpdate(task))
    .eq("id", task.id)
    .select("id,title,status,priority,scheduled_date,due_date,completed_at,deferred_count,memo")
    .single();

  if (error) throw error;
  return mapRowToTask(data as TaskRow);
}

export async function deleteTaskFromDb(id: string) {
  if (!supabase) return false;

  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
  return true;
}
