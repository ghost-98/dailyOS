import { NextResponse } from "next/server";
import { buildAnalyticsMemoryAnswer } from "@/features/memory-conversation/analyticsAnswer";
import { buildLocalMemoryAnswer, selectConversationMemory } from "@/features/memory-conversation/memoryDocuments";
import { planMemoryQuestion } from "@/features/memory-conversation/questionRouter";
import { retrieveSemanticMemory } from "@/features/memory-conversation/semanticRetrieval";
import { createUserScopedSupabase, getBearerToken } from "@/features/memory-conversation/serverSupabase";
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
  const questionPlan = planMemoryQuestion(question, documents);
  if (!shouldUseMemoryContext(question, questionPlan) && isChatProviderConfigured()) {
    try {
      return NextResponse.json(await generateGeneralProviderAnswer(question, messages));
    } catch (error) {
      console.error("Failed to generate general answer", error);
      return NextResponse.json(buildProviderUnavailableAnswer());
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

  if (questionPlan.needsDeterministicAnswer) {
    const analyticsResponse = buildAnalyticsMemoryAnswer(question, questionPlan, documents, summaries);
    if (analyticsResponse) return NextResponse.json(analyticsResponse);
  }

  const semanticMemory = await getSemanticMemory(request, question);
  const selectedMemory = semanticMemory ?? selectConversationMemory(question, documents, summaries, messages);
  if (!isChatProviderConfigured()) {
    return NextResponse.json(buildLocalMemoryAnswer(question, selectedMemory.documents, selectedMemory.summaries));
  }

  try {
    const llmResponse = await generateProviderAnswer(question, selectedMemory.documents, selectedMemory.summaries, selectedMemory.messages, questionPlan);
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
  questionPlan: ReturnType<typeof planMemoryQuestion>,
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
  questionPlan: ReturnType<typeof planMemoryQuestion>,
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
  const prompt = buildGeneralPrompt(question, messages);
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
  questionPlan: ReturnType<typeof planMemoryQuestion>,
): Promise<MemoryChatResponse> {
  const prompt = buildPrompt(question, documents, summaries, messages, questionPlan);
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
  questionPlan: ReturnType<typeof planMemoryQuestion>,
): Promise<MemoryChatResponse> {
  const prompt = buildPrompt(question, documents, summaries, messages, questionPlan);
  const parsed = await callGeminiJson(prompt);

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
  questionPlan: ReturnType<typeof planMemoryQuestion>,
) {
  return [
    "너는 dailyOS의 개인 기록 기반 대화 엔진이다.",
    "제공된 기록과 요약 메모리를 근거로 자연스럽게 답한다. 근거 없는 사실을 만들지 않는다.",
    "답변 본문에는 근거 목록을 길게 반복하지 않는다. 근거는 evidence 필드에 분리해서 담는다.",
    "질문 성격에 따라 답변 방식을 조절한다. 분석형 질문은 숫자, 기간, 사람, 장소, 유형을 먼저 분리해서 근거 중심으로 답한다.",
    "기록이 부족하면 부족하다고 말하되, 가능한 범위에서 패턴과 다음 질문을 제안한다.",
    "답변은 한국어로 자연스럽고 개인 비서처럼 필요한 말만 한다.",
    "반드시 JSON만 반환한다. 형식: {\"answer\":\"...\",\"summary\":\"...\",\"evidence\":[{\"id\":\"...\",\"title\":\"...\",\"date\":\"...\",\"label\":\"...\",\"reason\":\"...\"}],\"followups\":[\"...\"]}",
    "",
    `질문: ${question}`,
    `질문 처리 계획: intent=${questionPlan.intent}, domain=${questionPlan.domain}, range=${questionPlan.dateRange.label}, keywords=${questionPlan.keywords.join(", ") || "없음"}`,
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

function buildGeneralPrompt(question: string, messages: MemoryConversationMessage[]) {
  return [
    "너는 dailyOS의 개인 기록 대화 도우미다.",
    "이번 질문은 특정 개인 기록 조회가 아니라 일반 대화다. 기록을 검색했다고 말하지 말고, 없는 근거를 만들지 않는다.",
    "너의 역할은 사용자가 dailyOS에 쌓은 활동, 장소, 하루기록, 사진, 소비, 건강 데이터를 나중에 자연어로 돌아보고 분석하도록 돕는 것이다.",
    "친근하되 과장하지 말고, 한국어로 짧고 자연스럽게 답한다. 질문에 필요한 말만 한다.",
    "반드시 JSON만 반환한다. 형식: {\"answer\":\"...\",\"summary\":\"...\",\"evidence\":[],\"followups\":[\"...\"]}",
    "",
    "최근 대화:",
    messages.length > 0 ? messages.slice(-8).map((message) => `${message.role}: ${message.content}`).join("\n") : "없음",
    "",
    `사용자 질문: ${question}`,
  ].join("\n");
}

function shouldUseMemoryContext(question: string, questionPlan: ReturnType<typeof planMemoryQuestion>) {
  const normalized = question.toLocaleLowerCase("ko-KR");
  const compact = normalized.replace(/\s+/g, "");
  const addressesAssistant = /(너|넌|너는|니가|넌누구|너는누구|dailyos|데일리os|데일리오에스|챗봇|비서)/i.test(compact);
  const explicitRecordSignals = ["기록", "내가", "나는", "나랑", "내 ", "최근", "요즘", "오늘", "어제", "이번", "지난"];
  if (addressesAssistant && !explicitRecordSignals.some((signal) => normalized.includes(signal))) return false;
  if (questionPlan.intent === "analytics" || questionPlan.intent === "recall" || questionPlan.needsDeterministicAnswer) return true;

  const memorySignals = [
    "기록",
    "최근",
    "요즘",
    "오늘",
    "어제",
    "이번",
    "지난",
    "언제",
    "어디",
    "누구",
    "먹",
    "갔",
    "방문",
    "만났",
    "소비",
    "지출",
    "수입",
    "운동",
    "몸무게",
    "사진",
    "활동",
    "일정",
    "할일",
    "패턴",
    "분석",
    "정리",
  ];
  return memorySignals.some((signal) => normalized.includes(signal));
}

function buildProviderUnavailableAnswer(): MemoryChatResponse {
  return {
    answer: "지금 로컬 대화 모델에 연결하지 못했어요. Ollama 서버와 선택한 모델이 실행 중인지 확인한 뒤 다시 물어봐 주세요.",
    evidence: [],
    followups: [],
    mode: "local",
    summary: "로컬 모델 연결 필요",
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
