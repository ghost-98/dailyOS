import { NextResponse } from "next/server";

type LifeAskRecord = {
  date: string;
  description: string;
  label: string;
  tags: string[];
  title: string;
  type: string;
};

type LifeAskRequest = {
  question?: string;
  records?: LifeAskRecord[];
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY가 설정되어 있지 않습니다." }, { status: 500 });
  }

  const body = (await request.json()) as LifeAskRequest;
  const question = body.question?.trim();
  const records = Array.isArray(body.records) ? body.records.slice(0, 160) : [];

  if (!question) return NextResponse.json({ error: "질문을 입력해 주세요." }, { status: 400 });

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = [
    "너는 사용자의 개인 라이프 DB 분석가다.",
    "제공된 기록만 근거로 한국어로 답한다.",
    "확실하지 않은 내용은 추측이라고 표시한다.",
    "날짜·사람·장소·소비·건강의 연결성을 찾아준다.",
    "답변은 요약, 근거, 더 볼 질문 순서로 간결하게 작성한다.",
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
        maxOutputTokens: 900,
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

  return NextResponse.json({ answer: answer || "답변을 생성하지 못했습니다." });
}
