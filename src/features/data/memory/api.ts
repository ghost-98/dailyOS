import { requireCurrentUser } from "@/lib/authUser";
import { supabase } from "@/lib/supabase";
import type { MemoryConversationMessage, MemoryDocument, MemorySummary } from "@/features/memory-conversation/types";

export type MemoryConversationRecord = {
  id: string;
  title: string;
  updatedAt: string;
};

type MemoryDocumentRow = {
  document_date: string;
  document_id: string;
  focus_id?: string | null;
  kind: string;
  label: string;
  metadata: Record<string, unknown>;
  source_id: string;
  source_type: string;
  text: string;
  title: string;
  user_id: string;
};

type MemorySummaryRow = {
  kind: string;
  period_end?: string | null;
  period_start?: string | null;
  subject?: string | null;
  summary_id: string;
  text: string;
  user_id: string;
};

export async function syncMemoryDocumentsToDb(documents: MemoryDocument[], summaries: MemorySummary[]) {
  if (!supabase) return;
  const user = await requireCurrentUser();
  const documentRows: MemoryDocumentRow[] = documents.map((document) => ({
    document_date: document.date,
    document_id: document.id,
    focus_id: document.focusId ?? null,
    kind: document.kind,
    label: document.label,
    metadata: document.metadata as Record<string, unknown>,
    source_id: document.sourceId,
    source_type: document.sourceType,
    text: document.text,
    title: document.title,
    user_id: user.id,
  }));
  const summaryRows: MemorySummaryRow[] = summaries.map((summary) => ({
    kind: summary.kind,
    period_end: summary.periodEnd ?? null,
    period_start: summary.periodStart ?? null,
    subject: summary.subject ?? null,
    summary_id: summary.id,
    text: summary.text,
    user_id: user.id,
  }));

  if (documentRows.length > 0) {
    const { error } = await supabase.from("memory_documents").upsert(documentRows, { onConflict: "user_id,document_id" });
    if (error) throw error;
  }
  if (summaryRows.length > 0) {
    const { error } = await supabase.from("memory_summaries").upsert(summaryRows, { onConflict: "user_id,summary_id" });
    if (error) throw error;
  }
}

export async function createMemoryConversation(title: string): Promise<MemoryConversationRecord | null> {
  if (!supabase) return null;
  const user = await requireCurrentUser();
  const { data, error } = await supabase
    .from("memory_conversations")
    .insert({ title, user_id: user.id })
    .select("id,title,updated_at")
    .single();
  if (error) throw error;
  return data ? { id: data.id, title: data.title, updatedAt: data.updated_at } : null;
}

export async function fetchMemoryConversations(): Promise<MemoryConversationRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("memory_conversations")
    .select("id,title,updated_at")
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, title: row.title, updatedAt: row.updated_at }));
}

export async function fetchMemoryMessages(conversationId: string): Promise<MemoryConversationMessage[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("memory_messages")
    .select("id,role,content,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(80);
  if (error) throw error;
  return (data ?? []).map((row) => ({ content: row.content, createdAt: row.created_at, id: row.id, role: row.role }));
}

export async function saveMemoryMessage(conversationId: string, role: "user" | "assistant", content: string) {
  if (!supabase) return null;
  const user = await requireCurrentUser();
  const { data, error } = await supabase
    .from("memory_messages")
    .insert({ content, conversation_id: conversationId, role, user_id: user.id })
    .select("id,role,content,created_at")
    .single();
  if (error) throw error;
  await supabase.from("memory_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
  return data ? { content: data.content, createdAt: data.created_at, id: data.id, role: data.role } : null;
}
