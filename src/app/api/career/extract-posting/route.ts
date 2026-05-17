import { NextResponse } from "next/server";

const allowedTypes = new Set(["application/pdf"]);
const maxFileSize = 10 * 1024 * 1024;
const extractionTimeoutMs = 75_000;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF 파일이 필요합니다." }, { status: 400 });
    }

    if (!allowedTypes.has(file.type)) {
      return NextResponse.json({ error: "PDF 파일만 분석할 수 있습니다." }, { status: 400 });
    }

    if (file.size > maxFileSize) {
      return NextResponse.json({ error: "PDF 파일은 10MB 이하로 올려주세요. 큰 공고는 필요한 페이지만 따로 저장해서 올리는 편이 안정적입니다." }, { status: 400 });
    }

    const companyName = String(formData.get("companyName") ?? "");
    const postingTitle = String(formData.get("postingTitle") ?? "");
    const jobRole = String(formData.get("jobRole") ?? "");
    const bytes = Buffer.from(await file.arrayBuffer());
    return extractWithGemini({ bytes, companyName, file, jobRole, postingTitle });
  } catch (error) {
    console.error("Failed to extract job posting PDF", error);
    return NextResponse.json({ error: "PDF 분석 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}

async function extractWithGemini({
  bytes,
  companyName,
  file,
  jobRole,
  postingTitle,
}: {
  bytes: Buffer;
  companyName: string;
  file: File;
  jobRole: string;
  postingTitle: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 503 });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = buildExtractionPrompt({ companyName, jobRole, postingTitle });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), extractionTimeoutMs);

  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: file.type,
                  data: bytes.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: extractionSchema,
        },
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "AI 분석 시간이 길어져 중단했습니다. PDF 용량을 줄이거나 필요한 페이지만 추려 다시 올려주세요." }, { status: 504 });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json();

  if (!response.ok) {
    return NextResponse.json({ error: payload.error?.message ?? "Gemini extraction failed." }, { status: response.status });
  }

  const outputText = extractGeminiOutputText(payload);
  if (!outputText) {
    return NextResponse.json({ error: "Gemini response did not include JSON output." }, { status: 502 });
  }

  try {
    return NextResponse.json({ ...JSON.parse(outputText), modelName: model });
  } catch {
    return NextResponse.json({ error: "Gemini response JSON could not be parsed." }, { status: 502 });
  }
}

function buildExtractionPrompt({ companyName, jobRole, postingTitle }: { companyName: string; jobRole: string; postingTitle: string }) {
  return [
    "너는 채용공고 PDF를 dailyOS의 취업 관리 데이터로 구조화하는 도우미다.",
    "PDF에서 확인 가능한 내용만 JSON으로 추출한다.",
    "날짜는 가능하면 ISO 형식으로 쓴다. 시간이 명시되면 +09:00 기준 ISO datetime으로 쓴다.",
    "전형 일정, 자격요건, 우대사항, 제출서류, 준비 항목은 원문 근거를 sourceText에 짧게 남긴다.",
    "불확실하거나 사용자가 확인해야 하는 내용은 warnings에 넣는다.",
    `사용자가 미리 입력한 기업명: ${companyName || "(없음)"}`,
    `사용자가 미리 입력한 공고명: ${postingTitle || "(없음)"}`,
    `사용자가 미리 입력한 직무: ${jobRole || "(없음)"}`,
    "반드시 schema에 맞는 JSON만 반환한다.",
  ].join("\n");
}

function extractGeminiOutputText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return null;

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const parts = (candidate as { content?: { parts?: unknown } }).content?.parts;
    if (!Array.isArray(parts)) continue;

    for (const part of parts) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") return text;
    }
  }

  return null;
}

const extractionSchema = {
  type: "object",
  properties: {
    companyName: { type: "string" },
    postingTitle: { type: "string" },
    jobRole: { type: "string" },
    postingUrl: { type: "string" },
    summary: { type: "string" },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["application", "document", "written", "coding_test", "assignment", "interview", "medical", "result", "employment", "etc"],
          },
          title: { type: "string" },
          startAt: { type: "string" },
          endAt: { type: "string" },
          memo: { type: "string" },
          sourceText: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["type", "title", "startAt", "endAt", "memo", "sourceText", "confidence"],
      },
    },
    requirements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["eligibility", "preferred", "document", "exam", "interview", "note"],
          },
          title: { type: "string" },
          content: { type: "string" },
          sourceText: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["category", "title", "content", "sourceText", "confidence"],
      },
    },
    checkItems: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          category: {
            type: "string",
            enum: ["eligibility", "preferred", "document", "exam", "interview", "note"],
          },
          dueAt: { type: "string" },
          memo: { type: "string" },
          sourceText: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["title", "category", "dueAt", "memo", "sourceText", "confidence"],
      },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["companyName", "postingTitle", "jobRole", "postingUrl", "summary", "steps", "requirements", "checkItems", "warnings"],
};
