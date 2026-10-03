import type { SupabaseClient } from "@supabase/supabase-js";
import { embedMemoryQuery, isEmbeddingConfigured, toPgVector } from "@/features/memory-conversation/embedding";
import { expandMemoryQuestion } from "@/features/memory-conversation/memorySemantics";
import type { MemoryDocument, MemorySummary } from "@/features/memory-conversation/types";

type MemoryDocumentMatchRow = {
  document_date: string;
  document_id: string;
  focus_id?: string | null;
  kind: string;
  label: string;
  metadata: Record<string, unknown>;
  similarity: number;
  source_id: string;
  source_type: string;
  text: string;
  title: string;
};

type MemorySummaryMatchRow = {
  kind: MemorySummary["kind"];
  period_end?: string | null;
  period_start?: string | null;
  similarity: number;
  subject?: string | null;
  summary_id: string;
  text: string;
};

export async function retrieveSemanticMemory(supabase: SupabaseClient, question: string) {
  if (!isEmbeddingConfigured()) return null;
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw userError ?? new Error("로그인이 필요합니다.");
  const queryEmbedding = toPgVector(await embedMemoryQuery(expandMemoryQuestion(question)));

  const [documentsResult, summariesResult] = await Promise.all([
    supabase.rpc("match_memory_documents", {
      match_count: 44,
      match_threshold: 0.18,
      query_embedding: queryEmbedding,
      query_user_id: userData.user.id,
    }),
    supabase.rpc("match_memory_summaries", {
      match_count: 10,
      match_threshold: 0.15,
      query_embedding: queryEmbedding,
      query_user_id: userData.user.id,
    }),
  ]);

  if (documentsResult.error) throw documentsResult.error;
  if (summariesResult.error) throw summariesResult.error;

  return {
    documents: ((documentsResult.data ?? []) as MemoryDocumentMatchRow[]).map(matchRowToDocument),
    summaries: ((summariesResult.data ?? []) as MemorySummaryMatchRow[]).map(matchRowToSummary),
  };
}

function matchRowToDocument(row: MemoryDocumentMatchRow): MemoryDocument {
  return {
    date: row.document_date,
    focusId: row.focus_id ?? undefined,
    id: row.document_id,
    kind: row.kind as MemoryDocument["kind"],
    label: row.label,
    metadata: { ...row.metadata, semanticSimilarity: row.similarity },
    sourceId: row.source_id,
    sourceType: row.source_type,
    text: row.text,
    title: row.title,
  };
}

function matchRowToSummary(row: MemorySummaryMatchRow): MemorySummary {
  return {
    id: row.summary_id,
    kind: row.kind,
    periodEnd: row.period_end ?? undefined,
    periodStart: row.period_start ?? undefined,
    subject: row.subject ?? undefined,
    text: row.text,
  };
}
