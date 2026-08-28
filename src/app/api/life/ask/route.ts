import { NextResponse } from "next/server";

type LifeAskRecord = {
  date: string;
  description: string;
  label: string;
  tags: string[];
  title: string;
  type: string;
};

type LifeAskAnalysis = {
  cards?: Array<{ label: string; meta?: string; value: string }>;
  evidence?: Array<{ date: string; description: string; title: string }>;
  focus?: string;
  inferenceHints?: string[];
  narrative?: string;
  overview?: string;
  patterns?: string[];
  promptContext?: string;
  suggestions?: string[];
};

type LifeAskRequest = {
  analysis?: LifeAskAnalysis;
  question?: string;
  records?: LifeAskRecord[];
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되어 있지 않습니다." }, { status: 500 });
  }

  const body = (await request.json()) as LifeAskRequest;
  const analysis = body.analysis;
  const question = body.question?.trim();
  const records = Array.isArray(body.records) ? body.records.slice(0, 80) : [];

  if (!question) {
    return NextResponse.json({ error: "질문을 입력해 주세요." }, { status: 400 });
  }

  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const prompt = buildMainPrompt(question, records, analysis);
    let answerResult = await generateGeminiAnswer({ apiKey, maxOutputTokens: 1400, model, prompt });

    if (!answerResult.answer || answerResult.finishReason === "MAX_TOKENS") {
      answerResult = await generateGeminiAnswer({
        apiKey,
        maxOutputTokens: 1000,
        model,
        prompt: buildFallbackPrompt(question, analysis),
      });
    }

    return NextResponse.json({ answer: answerResult.answer || "AI 응답을 생성하지 못했습니다." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI 응답 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

function buildMainPrompt(question: string, records: LifeAskRecord[], analysis?: LifeAskAnalysis) {
  const compactCards = analysis?.cards?.map((card) => `- ${card.label}: ${card.value}${card.meta ? ` (${card.meta})` : ""}`).join("\n") ?? "";
  const compactEvidence = analysis?.evidence?.map((item) => `- ${item.date} · ${item.title} · ${item.description}`).join("\n") ?? "";
  const compactRecords = records.map((record) => `- ${record.date} · ${record.type} · ${record.title} · ${record.description || record.tags.join(" · ") || record.label}`).join("\n");

  return [
    "당신은 사용자의 개인 라이프 DB를 해석하는 분석가다.",
    "질문에 한국어로 답하되, 문장이 중간에 끊기지 않게 짧고 완결적으로 쓴다.",
    "구조화된 분석 카드와 관련 기록만 근거로 답한다.",
    "모르는 내용은 단정하지 말고, 추론이면 반드시 '추정' 또는 '기록상'이라고 표시한다.",
    "즐거움·행복·가장 좋았던 일 같은 질문은 긍정 표현, 함께한 사람, 연결 사진, 하루기록, 음식/선물/축하 맥락을 근거로 추론한다.",
    "응답은 반드시 아래 4개 구획만 사용한다: [요약] [근거] [패턴] [제안]",
    "각 구획은 최대 2문장 또는 3개 bullet 이내로 간결하게 쓴다.",
    "특히 [요약]은 첫 문장에서 질문에 바로 답한다.",
    "",
    analysis?.promptContext ? `분석 컨텍스트:\n${analysis.promptContext}` : "",
    analysis?.narrative ? `기간 서사:\n${analysis.narrative}` : "",
    compactCards ? `핵심 카드:\n${compactCards}` : "",
    analysis?.patterns?.length ? `패턴 후보:\n- ${analysis.patterns.join("\n- ")}` : "",
    analysis?.suggestions?.length ? `제안 후보:\n- ${analysis.suggestions.join("\n- ")}` : "",
    analysis?.inferenceHints?.length ? `추론 힌트:\n- ${analysis.inferenceHints.join("\n- ")}` : "",
    compactEvidence ? `기록 근거:\n${compactEvidence}` : "",
    "",
    `질문:\n${question}`,
    compactRecords ? `관련 기록:\n${compactRecords}` : "",
  ].join("\n");
}

function buildFallbackPrompt(question: string, analysis?: LifeAskAnalysis) {
  return [
    "이전 응답이 길어질 수 있으니 더 짧고 완결적으로 다시 답하라.",
    "반드시 [요약] [근거] [패턴] [제안] 4구획만 사용한다.",
    "[요약] 첫 문장에서 질문에 바로 답하고, 즐거움 같은 감정 질문은 '추정'이라고 명시한다.",
    analysis?.promptContext ? `분석 컨텍스트:\n${analysis.promptContext}` : "",
    analysis?.inferenceHints?.length ? `추론 힌트:\n- ${analysis.inferenceHints.join("\n- ")}` : "",
    analysis?.evidence?.length ? `핵심 근거:\n- ${analysis.evidence.map((item) => `${item.date} · ${item.title}`).join("\n- ")}` : "",
    `질문:\n${question}`,
  ].join("\n");
}

async function generateGeminiAnswer({
  apiKey,
  maxOutputTokens,
  model,
  prompt,
}: {
  apiKey: string;
  maxOutputTokens: number;
  model: string;
  prompt: string;
}) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens,
        temperature: 0.4,
      },
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI 응답 생성 실패: ${errorText}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };
  const answer = data.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text).filter(Boolean).join("\n") ?? "";
  const finishReason = data.candidates?.[0]?.finishReason;
  return { answer, finishReason };
}
