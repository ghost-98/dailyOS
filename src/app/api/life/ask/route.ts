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
  const records = Array.isArray(body.records) ? body.records.slice(0, 160) : [];

  if (!question) {
    return NextResponse.json({ error: "질문을 입력해주세요." }, { status: 400 });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = [
    "너는 사용자의 개인 라이프 DB를 해석하는 분석가다.",
    "구조화된 분석 카드와 관련 기록만 근거로 답한다.",
    "모르는 내용은 추측하지 말고, 가능성 또는 해석이라고 분리해서 말한다.",
    "답변은 반드시 '요약', '근거', '패턴', '제안' 네 구획으로 나눠 간결하게 작성한다.",
    "숫자만 나열하지 말고 사용자에게 왜 중요한지 설명한다.",
    "",
    analysis?.promptContext ? `분석 컨텍스트:\n${analysis.promptContext}` : "",
    analysis?.cards?.length ? `핵심 카드:\n${JSON.stringify(analysis.cards, null, 2)}` : "",
    analysis?.patterns?.length ? `패턴 후보:\n${analysis.patterns.join("\n")}` : "",
    analysis?.suggestions?.length ? `제안 후보:\n${analysis.suggestions.join("\n")}` : "",
    analysis?.evidence?.length ? `근거 후보:\n${JSON.stringify(analysis.evidence, null, 2)}` : "",
    "",
    JSON.stringify({ question, records }, null, 2),
  ].join("\n");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        maxOutputTokens: 1000,
      },
    }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json({ error: `AI 응답 생성 실패: ${errorText}` }, { status: response.status });
  }

  const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const answer = data.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).map((part) => part.text).filter(Boolean).join("\n") ?? "";

  return NextResponse.json({ answer: answer || "AI 답변을 생성하지 못했습니다." });
}
