import { NextResponse } from "next/server";

const allowedTypes = new Set(["application/pdf"]);
const maxFileSize = 50 * 1024 * 1024;

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
  }

  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ error: "Only PDF files are supported for AI extraction." }, { status: 400 });
  }

  if (file.size > maxFileSize) {
    return NextResponse.json({ error: "PDF file must be 50MB or smaller." }, { status: 400 });
  }

  const companyName = String(formData.get("companyName") ?? "");
  const postingTitle = String(formData.get("postingTitle") ?? "");
  const jobRole = String(formData.get("jobRole") ?? "");
  const bytes = Buffer.from(await file.arrayBuffer());
  return extractWithGemini({ bytes, companyName, file, jobRole, postingTitle });
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
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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
    "너는 한국어 채용공고를 dailyOS 데이터로 정리하는 추출기다.",
    "추측하지 말고 PDF 원문에 있는 정보만 JSON으로 추출해라.",
    "날짜는 가능하면 ISO 형식으로 작성하라. 시간이 있으면 +09:00을 포함한 ISO datetime으로 작성하라.",
    "모든 날짜/자격/준비물에는 sourceText에 근거 원문을 짧게 넣어라.",
    "확실하지 않은 값은 비워두고 warnings에 남겨라.",
    `사용자가 미리 입력한 기업명: ${companyName || "(없음)"}`,
    `사용자가 미리 입력한 공고명: ${postingTitle || "(없음)"}`,
    `사용자가 미리 입력한 직무: ${jobRole || "(없음)"}`,
    "반드시 제공된 JSON schema와 호환되는 JSON만 반환해라.",
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
