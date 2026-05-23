import { supabase } from "@/lib/supabase";
import type { ExpenseCategory, ExpenseRecord } from "@/types/domain";

type ExpenseRow = {
  id: string;
  expense_date: string;
  title: string;
  amount: number | string;
  category: ExpenseCategory;
  memo: string | null;
};

type ExpenseInsert = Omit<ExpenseRow, "id"> & {
  user_id: string;
};

type ExpenseUpdate = Partial<Omit<ExpenseInsert, "user_id">>;

const expenseColumns = "id,expense_date,title,amount,category,memo";

async function getUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

function mapExpenseRow(row: ExpenseRow): ExpenseRecord {
  return {
    id: row.id,
    date: row.expense_date,
    title: row.title,
    amount: Number(row.amount),
    category: row.category,
    memo: row.memo ?? undefined,
  };
}

function mapExpenseInsert(record: ExpenseRecord, userId: string): ExpenseInsert {
  return {
    user_id: userId,
    expense_date: record.date,
    title: record.title.trim(),
    amount: record.amount,
    category: record.category,
    memo: record.memo?.trim() || null,
  };
}

function mapExpenseUpdate(record: ExpenseRecord): ExpenseUpdate {
  return {
    expense_date: record.date,
    title: record.title.trim(),
    amount: record.amount,
    category: record.category,
    memo: record.memo?.trim() || null,
  };
}

export async function fetchExpenseRecordsFromDb() {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("expense_records")
    .select(expenseColumns)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as ExpenseRow[]).map(mapExpenseRow);
}

export async function createExpenseRecordInDb(record: ExpenseRecord) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("expense_records")
    .insert(mapExpenseInsert(record, userId))
    .select(expenseColumns)
    .single();

  if (error) throw error;
  return mapExpenseRow(data as ExpenseRow);
}

export async function updateExpenseRecordInDb(record: ExpenseRecord) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("expense_records")
    .update(mapExpenseUpdate(record))
    .eq("id", record.id)
    .select(expenseColumns)
    .single();

  if (error) throw error;
  return mapExpenseRow(data as ExpenseRow);
}

export async function deleteExpenseRecordFromDb(id: string) {
  if (!supabase) return false;
  const { error } = await supabase.from("expense_records").delete().eq("id", id);
  if (error) throw error;
  return true;
}
