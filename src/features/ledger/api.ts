import { getCurrentUserId } from "@/lib/authUser";
import { supabase } from "@/lib/supabase";
import type { ExpenseCategory, ExpenseRecord, IncomeCategory, IncomeRecord } from "@/types/domain";

type ExpenseRow = {
  id: string;
  expense_date: string;
  title: string;
  amount: number | string;
  category: ExpenseCategory;
  memo: string | null;
  target_type: ExpenseRecord["targetType"];
  target_id: string;
};

type ExpenseInsert = Omit<ExpenseRow, "id"> & {
  user_id: string;
};

type ExpenseUpdate = Partial<Omit<ExpenseInsert, "user_id">>;

type IncomeRow = {
  id: string;
  income_date: string;
  title: string;
  amount: number | string;
  category: IncomeCategory;
  memo: string | null;
};

type IncomeInsert = Omit<IncomeRow, "id"> & {
  user_id: string;
};

type IncomeUpdate = Partial<Omit<IncomeInsert, "user_id">>;

const expenseColumns = "id,expense_date,title,amount,category,memo,target_type,target_id";
const incomeColumns = "id,income_date,title,amount,category,memo";

function mapExpenseRow(row: ExpenseRow): ExpenseRecord {
  return {
    id: row.id,
    date: row.expense_date,
    title: row.title,
    amount: Number(row.amount),
    category: row.category,
    memo: row.memo ?? undefined,
    targetType: row.target_type,
    targetId: row.target_id,
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
    target_type: record.targetType,
    target_id: record.targetId,
  };
}

function mapExpenseUpdate(record: ExpenseRecord): ExpenseUpdate {
  return {
    expense_date: record.date,
    title: record.title.trim(),
    amount: record.amount,
    category: record.category,
    memo: record.memo?.trim() || null,
    target_type: record.targetType,
    target_id: record.targetId,
  };
}

function mapIncomeRow(row: IncomeRow): IncomeRecord {
  return {
    amount: Number(row.amount),
    category: row.category,
    date: row.income_date,
    id: row.id,
    memo: row.memo ?? undefined,
    title: row.title,
  };
}

function mapIncomeInsert(record: IncomeRecord, userId: string): IncomeInsert {
  return {
    amount: record.amount,
    category: record.category,
    income_date: record.date,
    memo: record.memo?.trim() || null,
    title: record.title.trim(),
    user_id: userId,
  };
}

function mapIncomeUpdate(record: IncomeRecord): IncomeUpdate {
  return {
    amount: record.amount,
    category: record.category,
    income_date: record.date,
    memo: record.memo?.trim() || null,
    title: record.title.trim(),
  };
}

export async function fetchExpenseRecordsFromDb() {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("expense_records")
    .select(expenseColumns)
    .eq("user_id", userId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as ExpenseRow[]).map(mapExpenseRow);
}

export async function fetchIncomeRecordsFromDb() {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("income_records")
    .select(incomeColumns)
    .eq("user_id", userId)
    .order("income_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as IncomeRow[]).map(mapIncomeRow);
}

export async function createIncomeRecordInDb(record: IncomeRecord) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("income_records")
    .insert(mapIncomeInsert(record, userId))
    .select(incomeColumns)
    .single();

  if (error) throw error;
  return mapIncomeRow(data as IncomeRow);
}

export async function updateIncomeRecordInDb(record: IncomeRecord) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("income_records")
    .update(mapIncomeUpdate(record))
    .eq("id", record.id)
    .eq("user_id", userId)
    .select(incomeColumns)
    .single();

  if (error) throw error;
  return mapIncomeRow(data as IncomeRow);
}

export async function deleteIncomeRecordFromDb(id: string) {
  if (!supabase) return false;
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { error } = await supabase.from("income_records").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
  return true;
}

export async function syncLinkedExpenseRecordInDb({
  amount,
  date,
  memo,
  targetId,
  targetType,
  title,
}: {
  amount?: number;
  date: string;
  memo?: string;
  targetId: string;
  targetType: NonNullable<ExpenseRecord["targetType"]>;
  title: string;
}) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data: existing, error: fetchError } = await supabase
    .from("expense_records")
    .select(expenseColumns)
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (!amount || amount <= 0) {
    if (!existing) return null;
    const { error } = await supabase.from("expense_records").delete().eq("id", (existing as ExpenseRow).id);
    if (error) throw error;
    return null;
  }

  const record: ExpenseRecord = {
    id: (existing as ExpenseRow | null)?.id ?? `expense-${Date.now()}`,
    amount,
    category: (existing as ExpenseRow | null)?.category ?? "etc",
    date,
    memo,
    targetId,
    targetType,
    title,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("expense_records")
      .update(mapExpenseUpdate(record))
      .eq("id", (existing as ExpenseRow).id)
      .select(expenseColumns)
      .single();

    if (error) throw error;
    return mapExpenseRow(data as ExpenseRow);
  }

  const { data, error } = await supabase
    .from("expense_records")
    .insert(mapExpenseInsert(record, userId))
    .select(expenseColumns)
    .single();

  if (error) throw error;
  return mapExpenseRow(data as ExpenseRow);
}

export async function deleteLinkedExpenseRecordInDb(targetType: NonNullable<ExpenseRecord["targetType"]>, targetId: string) {
  if (!supabase) return false;
  const userId = await getCurrentUserId();
  if (!userId) return false;

  const { error } = await supabase.from("expense_records").delete().eq("user_id", userId).eq("target_type", targetType).eq("target_id", targetId);
  if (error) throw error;
  return true;
}
