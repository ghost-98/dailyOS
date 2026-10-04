import { NextResponse } from "next/server";
import { buildAnalyticsMemoryAnswer } from "@/features/memory-conversation/analyticsAnswer";
import { decideConversationRoute } from "@/features/memory-conversation/conversationPolicy";
import { buildLocalMemoryAnswer, selectConversationMemory } from "@/features/memory-conversation/memoryDocuments";
import { buildGeneralChatPrompt, buildMemoryAnswerPrompt } from "@/features/memory-conversation/memoryPrompts";
import { retrieveSemanticMemory } from "@/features/memory-conversation/semanticRetrieval";
import { createUserScopedSupabase, getBearerToken } from "@/features/memory-conversation/serverSupabase";
import type { MemoryQuestionPlan } from "@/features/memory-conversation/conversationPolicy";
import type { MemoryChatResponse, MemoryConversationMessage, MemoryDocument, MemorySummary } from "@/features/memory-conversation/types";

const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const memoryChatProvider = process.env.MEMORY_CHAT_PROVIDER || "ollama";
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const ollamaChatModel = process.env.OLLAMA_CHAT_MODEL || process.env.LOCAL_CHAT_MODEL || "qwen3:8b";

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
  const decision = decideConversationRoute(question, documents);
  if (!decision.useMemory && isChatProviderConfigured()) {
    try {
      return NextResponse.json(await generateGeneralProviderAnswer(question, messages));
    } catch (error) {
      console.error("Failed to generate general answer", error);
      return NextResponse.json(buildGeneralFallbackAnswer(question));
    }
  }

  if (documents.length === 0 && summaries.length === 0) {
    return NextResponse.json({
      answer: "아직 대화에 사용할 기록 메모리가 충분하지 않습니다. 기록을 먼저 추가하면 그 기록을 기반으로 답할 수 있어요.",
      evidence: [],
      followups: ["최근 기록을 추가한 뒤 다시 물어보기", "오늘 하루를 먼저 기록하기"],
      mode: "local",
      summary: "사용 가능한 기억 없음",
    } satisfies MemoryChatResponse);
  }

  if (decision.route === "memory_analytics") {
    const analyticsResponse = buildAnalyticsMemoryAnswer(question, decision.plan, documents, summaries);
    if (analyticsResponse) return NextResponse.json(analyticsResponse);
  }

  const semanticMemory = await getSemanticMemory(request, question);
  const selectedMemory = semanticMemory ?? selectConversationMemory(question, documents, summaries, messages);
  if (!isChatProviderConfigured()) {
    return NextResponse.json(buildLocalMemoryAnswer(question, selectedMemory.documents, selectedMemory.summaries));
  }

  try {
    const llmResponse = await generateProviderAnswer(question, selectedMemory.documents, selectedMemory.summaries, selectedMemory.messages, decision.plan);
    return NextResponse.json(llmResponse);
  } catch (error) {
    console.error("Failed to generate memory answer", error);
    return NextResponse.json(buildLocalMemoryAnswer(question, selectedMemory.documents, selectedMemory.summaries));
  }
}

function isChatProviderConfigured() {
  if (memoryChatProvider === "auto") return Boolean(geminiApiKey || (ollamaBaseUrl && ollamaChatModel));
  if (memoryChatProvider === "ollama") return Boolean(ollamaBaseUrl && ollamaChatModel);
  return Boolean(geminiApiKey);
}

async function generateProviderAnswer(
  question: string,
  documents: MemoryDocument[],
  summaries: MemorySummary[],
  messages: Array<{ content: string; role: string }>,
  questionPlan: MemoryQuestionPlan,
) {
  if (memoryChatProvider === "auto") return generateAutoProviderAnswer(question, documents, summaries, messages, questionPlan);
  return memoryChatProvider === "ollama"
    ? generateOllamaAnswer(question, documents, summaries, messages, questionPlan)
    : generateGeminiAnswer(question, documents, summaries, messages, questionPlan);
}

async function generateAutoProviderAnswer(
  question: string,
  documents: MemoryDocument[],
  summaries: MemorySummary[],
  messages: Array<{ content: string; role: string }>,
  questionPlan: MemoryQuestionPlan,
) {
  if (geminiApiKey) {
    try {
      return await generateGeminiAnswer(question, documents, summaries, messages, questionPlan);
    } catch (error) {
      console.error("Gemini memory answer failed, falling back to local provider", error);
    }
  }
  if (ollamaBaseUrl && ollamaChatModel) {
    return generateOllamaAnswer(question, documents, summaries, messages, questionPlan);
  }
  return buildLocalMemoryAnswer(question, documents, summaries);
}

async function generateGeneralProviderAnswer(question: string, messages: MemoryConversationMessage[]): Promise<MemoryChatResponse> {
  const prompt = buildGeneralChatPrompt(question, messages);
  const parsed = memoryChatProvider === "ollama"
    ? await callOllamaJson(prompt)
    : memoryChatProvider === "auto"
      ? await callAutoJson(prompt)
      : await callGeminiJson(prompt);

  return {
    answer: requireProviderAnswer(parsed.answer),
    evidence: [],
    followups: sanitizeFollowups(parsed.followups, []),
    mode: "llm",
    summary: parsed.summary || "일반 대화",
  };
}

async function callAutoJson(prompt: string) {
  if (geminiApiKey) {
    try {
      return await callGeminiJson(prompt);
    } catch (error) {
      console.error("Gemini general answer failed, falling back to local provider", error);
    }
  }
  if (ollamaBaseUrl && ollamaChatModel) return callOllamaJson(prompt);
  return {};
}

async function getSemanticMemory(request: Request, question: string) {
  const accessToken = getBearerToken(request);
  if (!accessToken) return null;
  try {
    const supabase = createUserScopedSupabase(accessToken);
    const memory = await retrieveSemanticMemory(supabase, question);
    if (!memory || (memory.documents.length === 0 && memory.summaries.length === 0)) return null;
    return {
      documents: memory.documents,
      messages: [] as Array<{ content: string; role: string }>,
      summaries: memory.summaries,
    };
  } catch (error) {
    console.error("Failed to retrieve semantic memory", error);
    return null;
  }
}

async function generateOllamaAnswer(
  question: string,
  documents: MemoryDocument[],
  summaries: MemorySummary[],
  messages: Array<{ content: string; role: string }>,
  questionPlan: MemoryQuestionPlan,
): Promise<MemoryChatResponse> {
  const prompt = buildMemoryAnswerPrompt(question, documents, summaries, messages, questionPlan);
  const parsed = await callOllamaJson(prompt);

  return {
    answer: parsed.answer || buildLocalMemoryAnswer(question, documents, summaries).answer,
    evidence: sanitizeEvidence(parsed.evidence, documents),
    followups: sanitizeFollowups(parsed.followups),
    mode: "llm",
    summary: parsed.summary || summaries[0]?.text || "관련 기억을 바탕으로 답변했습니다.",
  };
}

async function callOllamaJson(prompt: string): Promise<Partial<MemoryChatResponse>> {
  let response: Response;
  try {
    response = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        format: "json",
        model: ollamaChatModel,
        options: { temperature: 0.25 },
        prompt,
        stream: false,
      }),
    });
  } catch {
    throw new Error(`Ollama 대화 서버에 연결할 수 없습니다. ${ollamaBaseUrl}에서 Ollama가 실행 중인지 확인해 주세요.`);
  }

  if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);
  const data = await response.json();
  const rawText = data?.response;
  if (typeof rawText !== "string") throw new Error("Ollama 응답이 비어 있습니다.");
  return JSON.parse(rawText) as Partial<MemoryChatResponse>;
}

async function callGeminiJson(prompt: string): Promise<Partial<MemoryChatResponse>> {
  if (!geminiApiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
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
  return JSON.parse(rawText) as Partial<MemoryChatResponse>;
}

async function generateGeminiAnswer(
  question: string,
  documents: MemoryDocument[],
  summaries: MemorySummary[],
  messages: Array<{ content: string; role: string }>,
  questionPlan: MemoryQuestionPlan,
): Promise<MemoryChatResponse> {
  const prompt = buildMemoryAnswerPrompt(question, documents, summaries, messages, questionPlan);
  const parsed = await callGeminiJson(prompt);

  return {
    answer: parsed.answer || buildLocalMemoryAnswer(question, documents, summaries).answer,
    evidence: sanitizeEvidence(parsed.evidence, documents),
    followups: sanitizeFollowups(parsed.followups),
    mode: "llm",
    summary: parsed.summary || summaries[0]?.text || "관련 기억을 바탕으로 답변했습니다.",
  };
}

function buildGeneralFallbackAnswer(question: string): MemoryChatResponse {
  const compact = question.replace(/\s+/g, "");
  const isIdentityQuestion = /(너|넌|너는|dailyos|데일리os|데일리오에스).*(누구|뭐|무엇)|누구야|뭐야/.test(compact.toLocaleLowerCase("ko-KR"));
  const isMetaTurn = /물어볼게|물어볼께|질문할게|질문할께|물어보려고|질문하려고|궁금한게있어|궁금한게 있어|궁금한 게 있어/.test(question);
  const answer = isIdentityQuestion
    ? "저는 dailyOS의 기록 대화 도우미예요. 평소 대화는 가볍게 이어가고, 당신의 활동이나 장소, 소비, 건강 기록이 필요한 질문이면 그 기록을 찾아서 답해요."
    : isMetaTurn
      ? "좋아요. 물어보세요. 기록이 필요한 질문이면 제가 가진 dailyOS 기록을 기준으로 찾아보고 답할게요."
      : "좋아요. 지금 질문은 기록 검색 없이 답할 수 있는 일반 대화로 이해했어요.";

  return {
    answer,
    evidence: [],
    followups: [],
    mode: "local",
    summary: "일반 대화",
  };
}

function requireProviderAnswer(answer: unknown) {
  if (typeof answer === "string" && answer.trim()) return answer;
  throw new Error("LLM 응답에 answer가 없습니다.");
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

function sanitizeFollowups(value: unknown, fallback = ["근거 기록을 더 자세히 보여줘", "최근 기록만 기준으로 다시 봐줘"]) {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 4);
}
