import { NextResponse } from "next/server";
import { buildLocalMemoryAnswer, selectConversationMemory } from "@/features/memory-conversation/memoryDocuments";
import type { MemoryChatResponse, MemoryConversationMessage, MemoryDocument, MemorySummary } from "@/features/memory-conversation/types";

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";

type MemoryChatRequest = {
  documents?: MemoryDocument[];
  messages?: MemoryConversationMessage[];
  question?: string;
  summaries?: MemorySummary[];
};

export async function POST(request: Request) {
  let body: MemoryChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const question = body.question?.trim();
  const documents = body.documents ?? [];
  const summaries = body.summaries ?? [];
  const messages = body.messages ?? [];

  if (!question) return NextResponse.json({ error: "질문을 입력해 주세요." }, { status: 400 });
  if (documents.length === 0 && summaries.length === 0) {
    return NextResponse.json({
      answer: "아직 대화에 사용할 기록 메모리가 충분하지 않습니다. 기록을 먼저 추가하면 그 기록을 기반으로 답할 수 있어요.",
      evidence: [],
      followups: ["최근 기록을 추가한 뒤 다시 물어보기", "오늘 하루를 먼저 기록하기"],
      mode: "local",
      summary: "사용 가능한 기억 없음",
    } satisfies MemoryChatResponse);
  }

  const selectedMemory = selectConversationMemory(question, documents, summaries, messages);
  if (!geminiApiKey) {
    return NextResponse.json(buildLocalMemoryAnswer(question, selectedMemory.documents, selectedMemory.summaries));
  }

  try {
    const llmResponse = await generateGeminiAnswer(question, selectedMemory.documents, selectedMemory.summaries, selectedMemory.messages);
    return NextResponse.json(llmResponse);
  } catch (error) {
    console.error("Failed to generate memory answer", error);
    return NextResponse.json(buildLocalMemoryAnswer(question, selectedMemory.documents, selectedMemory.summaries));
  }
}

async function generateGeminiAnswer(
  question: string,
  documents: MemoryDocument[],
  summaries: MemorySummary[],
  messages: Array<{ content: string; role: string }>,
): Promise<MemoryChatResponse> {
  const prompt = buildPrompt(question, documents, summaries, messages);
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.35,
      },
    }),
  });

  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof rawText !== "string") throw new Error("Gemini 응답이 비어 있습니다.");
  const parsed = JSON.parse(rawText) as Partial<MemoryChatResponse>;

  return {
    answer: parsed.answer || buildLocalMemoryAnswer(question, documents, summaries).answer,
    evidence: sanitizeEvidence(parsed.evidence, documents),
    followups: sanitizeFollowups(parsed.followups),
    mode: "llm",
    summary: parsed.summary || summaries[0]?.text || "관련 기억을 바탕으로 답변했습니다.",
  };
}

function buildPrompt(
  question: string,
  documents: MemoryDocument[],
  summaries: MemorySummary[],
  messages: Array<{ content: string; role: string }>,
) {
  return [
    "너는 dailyOS의 개인 기록 기반 대화 엔진이다.",
    "사용자의 기록과 요약 메모리만 근거로 답한다. 근거 없는 사실을 만들지 않는다.",
    "기록이 부족하면 부족하다고 말하되, 가능한 범위에서 패턴과 다음 질문을 제안한다.",
    "답변은 한국어로 자연스럽고 개인 비서처럼 맥락 있게 작성한다.",
    "반드시 JSON만 반환한다. 형식: {\"answer\":\"...\",\"summary\":\"...\",\"evidence\":[{\"id\":\"...\",\"title\":\"...\",\"date\":\"...\",\"label\":\"...\",\"reason\":\"...\"}],\"followups\":[\"...\"]}",
    "",
    `질문: ${question}`,
    "",
    "최근 대화:",
    messages.length > 0 ? messages.map((message) => `${message.role}: ${message.content}`).join("\n") : "없음",
    "",
    "장기 요약 메모리:",
    summaries.length > 0 ? summaries.map((summary) => `- [${summary.kind}] ${summary.subject ?? summary.periodStart ?? summary.id}: ${summary.text}`).join("\n") : "없음",
    "",
    "관련 원본 기억:",
    documents.map((document) => `- id=${document.id} / ${document.date} / ${document.label} / ${document.title}\n${document.text}`).join("\n\n"),
  ].join("\n");
}

function sanitizeEvidence(value: unknown, documents: MemoryDocument[]) {
  const localEvidence = buildLocalMemoryAnswer("", documents, []).evidence;
  if (!Array.isArray(value)) return localEvidence;
  const byId = new Map(documents.map((document) => [document.id, document]));
  return value.slice(0, 8).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const id = "id" in item && typeof item.id === "string" ? item.id : "";
    const document = byId.get(id);
    if (!document) return [];
    return [{
      date: document.date,
      focusId: document.focusId,
      id: document.id,
      label: document.label,
      reason: "reason" in item && typeof item.reason === "string" ? item.reason : "답변의 직접 근거 기록",
      title: document.title,
    }];
  });
}

function sanitizeFollowups(value: unknown) {
  if (!Array.isArray(value)) return ["근거 기록을 더 자세히 보여줘", "최근 기록만 기준으로 다시 봐줘"];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4);
}
