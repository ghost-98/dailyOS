import { NextResponse } from "next/server";
import { embedMemoryText, isEmbeddingConfigured, isMemoryEmbeddingUnavailableError, toPgVector } from "@/features/memory-conversation/embedding";
import { createUserScopedSupabase, getBearerToken } from "@/features/memory-conversation/serverSupabase";
import type { MemoryDocument, MemorySummary } from "@/features/memory-conversation/types";

type MemorySyncRequest = {
  documents?: MemoryDocument[];
  summaries?: MemorySummary[];
};

type MemoryDocumentRow = {
  document_date: string;
  document_id: string;
  embedding?: string | null;
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
  embedding?: string | null;
  kind: string;
  period_end?: string | null;
  period_start?: string | null;
  subject?: string | null;
  summary_id: string;
  text: string;
  user_id: string;
};

type ExistingMemoryRow = {
  document_id?: string;
  embedding?: unknown;
  summary_id?: string;
  text: string;
  title?: string;
};

export async function POST(request: Request) {
  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    let body: MemorySyncRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    }

    const documents = body.documents ?? [];
    const summaries = body.summaries ?? [];
    const supabase = createUserScopedSupabase(accessToken);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return NextResponse.json({ error: userError?.message ?? "로그인이 필요합니다." }, { status: 401 });

    const canEmbed = isEmbeddingConfigured();
    const existingDocuments = await fetchExistingMemoryRows(supabase, "memory_documents", "document_id", documents.map((document) => document.id));
    const existingSummaries = await fetchExistingMemoryRows(supabase, "memory_summaries", "summary_id", summaries.map((summary) => summary.id));
    let embeddingWarning = "";
    const documentRows: MemoryDocumentRow[] = [];
    for (const document of documents) {
      const existing = existingDocuments.get(document.id);
      const shouldEmbed = canEmbed && !embeddingWarning && (!existing || existing.title !== document.title || existing.text !== document.text || !existing.hasEmbedding);
      const embedding = shouldEmbed ? await createOptionalEmbedding(createEmbeddingInput(document.title, document.text), (message) => { embeddingWarning = message; }) : undefined;
      documentRows.push({
        document_date: document.date,
        document_id: document.id,
        ...(embedding ? { embedding } : {}),
        focus_id: document.focusId ?? null,
        kind: document.kind,
        label: document.label,
        metadata: document.metadata as Record<string, unknown>,
        source_id: document.sourceId,
        source_type: document.sourceType,
        text: document.text,
        title: document.title,
        user_id: userData.user.id,
      });
    }

    const summaryRows: MemorySummaryRow[] = [];
    for (const summary of summaries) {
      const existing = existingSummaries.get(summary.id);
      const shouldEmbed = canEmbed && !embeddingWarning && (!existing || existing.text !== summary.text || !existing.hasEmbedding);
      const embedding = shouldEmbed ? await createOptionalEmbedding(summary.text, (message) => { embeddingWarning = message; }) : undefined;
      summaryRows.push({
        ...(embedding ? { embedding } : {}),
        kind: summary.kind,
        period_end: summary.periodEnd ?? null,
        period_start: summary.periodStart ?? null,
        subject: summary.subject ?? null,
        summary_id: summary.id,
        text: summary.text,
        user_id: userData.user.id,
      });
    }

    if (documentRows.length > 0) {
      const { error } = await supabase.from("memory_documents").upsert(documentRows, { onConflict: "user_id,document_id" });
      if (error) return NextResponse.json({ error: `memory_documents upsert 실패: ${error.message}` }, { status: 500 });
    }

    if (summaryRows.length > 0) {
      const { error } = await supabase.from("memory_summaries").upsert(summaryRows, { onConflict: "user_id,summary_id" });
      if (error) return NextResponse.json({ error: `memory_summaries upsert 실패: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({
      embedded: canEmbed && !embeddingWarning,
      embeddingWarning,
      syncedDocuments: documentRows.length,
      syncedSummaries: summaryRows.length,
    });
  } catch (error) {
    console.error("Failed to sync memory", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "메모리 동기화 중 알 수 없는 오류가 발생했습니다." }, { status: 500 });
  }
}

async function fetchExistingMemoryRows(
  supabase: ReturnType<typeof createUserScopedSupabase>,
  table: "memory_documents" | "memory_summaries",
  idColumn: "document_id" | "summary_id",
  ids: string[],
) {
  const rows = new Map<string, { hasEmbedding: boolean; text: string; title?: string }>();
  for (let index = 0; index < ids.length; index += 80) {
    const chunk = ids.slice(index, index + 80);
    if (chunk.length === 0) continue;
    const selectColumns = table === "memory_documents" ? `${idColumn},title,text,embedding` : `${idColumn},text,embedding`;
    const { data, error } = await supabase.from(table).select(selectColumns).in(idColumn, chunk);
    if (error) throw error;
    ((data ?? []) as unknown as ExistingMemoryRow[]).forEach((row) => {
      const id = (idColumn === "document_id" ? row.document_id : row.summary_id) ?? "";
      if (!id) return;
      rows.set(id, {
        hasEmbedding: Boolean(row.embedding),
        text: row.text,
        title: row.title,
      });
    });
  }
  return rows;
}

function createEmbeddingInput(title: string, text: string) {
  return `${title}\n${text}`;
}

async function createOptionalEmbedding(input: string, onUnavailable: (message: string) => void) {
  try {
    return toPgVector(await embedMemoryText(input));
  } catch (error) {
    if (isMemoryEmbeddingUnavailableError(error)) {
      onUnavailable(error.message);
      return undefined;
    }
    throw error;
  }
}
