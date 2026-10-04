import { supabase } from "@/lib/supabase";
import type { MemoryDocument, MemorySummary } from "@/features/memory-conversation/types";

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
