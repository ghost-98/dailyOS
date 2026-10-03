import { requireCurrentUser } from "@/lib/authUser";
import { supabase } from "@/lib/supabase";
import type { MemoryConversationMessage, MemoryDocument, MemorySummary } from "@/features/memory-conversation/types";

export type MemoryConversationRecord = {
  id: string;
  title: string;
  updatedAt: string;
};

export async function syncMemoryDocumentsToDb(documents: MemoryDocument[], summaries: MemorySummary[]) {
  if (!supabase) return;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("로그인이 필요합니다.");
  const response = await fetch("/api/memory/sync", {
    body: JSON.stringify({ documents, summaries }),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    const detail = typeof result?.error === "string" ? result.error : `${response.status} ${response.statusText}`;
    throw new Error(`메모리 동기화에 실패했습니다: ${detail}`);
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
