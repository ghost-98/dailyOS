import { NextResponse } from "next/server";

const allowedTypes = new Set(["application/pdf"]);
const maxFileSize = 10 * 1024 * 1024;
const extractionTimeoutMs = 75_000;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startedAt = Date.now();

  try {
    console.info(`[career-extract:${requestId}] request started`);
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
    const fileReadStartedAt = Date.now();
    const bytes = Buffer.from(await file.arrayBuffer());
    console.info(`[career-extract:${requestId}] file read ${Date.now() - fileReadStartedAt}ms size=${file.size}`);

    const response = await extractWithGemini({ bytes, companyName, file, jobRole, postingTitle, requestId });
    console.info(`[career-extract:${requestId}] request finished ${Date.now() - startedAt}ms`);
    return response;
  } catch (error) {
    console.error(`[career-extract:${requestId}] request failed ${Date.now() - startedAt}ms`, error);
    return NextResponse.json({ error: "PDF 분석 요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
  }
}

async function extractWithGemini({
  bytes,
  companyName,
  file,
  jobRole,
  postingTitle,
  requestId,
}: {
  bytes: Buffer;
  companyName: string;
  file: File;
  jobRole: string;
  postingTitle: string;
  requestId: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured." }, { status: 503 });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = buildExtractionPrompt({ companyName, jobRole, postingTitle });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), extractionTimeoutMs);
  const geminiStartedAt = Date.now();

  let response: Response;
  try {
    console.info(`[career-extract:${requestId}] gemini request started model=${model}`);
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
    console.info(`[career-extract:${requestId}] gemini response status=${response.status} ${Date.now() - geminiStartedAt}ms`);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn(`[career-extract:${requestId}] gemini timeout ${Date.now() - geminiStartedAt}ms`);
      return NextResponse.json({ error: "AI 분석 시간이 길어져 중단했습니다. PDF 용량을 줄이거나 필요한 페이지만 추려 다시 올려주세요." }, { status: 504 });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const parseStartedAt = Date.now();
  const payload = await response.json();
  console.info(`[career-extract:${requestId}] gemini json parsed ${Date.now() - parseStartedAt}ms`);

  if (!response.ok) {
    return NextResponse.json({ error: payload.error?.message ?? "Gemini extraction failed." }, { status: response.status });
  }

  const outputText = extractGeminiOutputText(payload);
  if (!outputText) {
    return NextResponse.json({ error: "Gemini response did not include JSON output." }, { status: 502 });
  }

  try {
    const extraction = JSON.parse(outputText) as Record<string, unknown>;
    return NextResponse.json({
      ...extraction,
      companyName: companyName.trim() || extraction.companyName,
      postingTitle: postingTitle.trim() || extraction.postingTitle,
      jobRole: jobRole.trim() || extraction.jobRole,
      summary: "",
      modelName: model,
    });
  } catch {
    return NextResponse.json({ error: "Gemini response JSON could not be parsed." }, { status: 502 });
  }
}

function buildExtractionPrompt({ companyName, jobRole, postingTitle }: { companyName: string; jobRole: string; postingTitle: string }) {
  return [
    "너는 채용공고 PDF에서 dailyOS에 필요한 핵심만 뽑는 추출기다.",
    "너무 세부적인 회사 설명, 블라인드 채용 안내, 유의사항, 법적 고지, 반환/이의신청 문구는 저장하지 않는다.",
    "반드시 다음 네 가지 중심으로만 추출한다: 1) 전형 일정 2) 지원자격 3) 우대/가점/자격증/어학 요건 4) 제출 마감 또는 제출물.",
    "steps에는 접수, 서류, 필기, 코딩테스트, 면접, 결과 발표, 입사/검진처럼 캘린더에 넣을 날짜만 넣는다. 최대 8개만 넣는다.",
    "requirements에는 지원 가능 여부 판단에 필요한 자격요건과 우대/가점 사항만 넣는다. 최대 8개만 넣는다.",
    "checkItems에는 사용자가 실제로 준비해야 할 제출물이나 마감 체크만 넣는다. 최대 4개만 넣고, 없으면 빈 배열로 둔다.",
    "날짜는 가능하면 ISO 형식으로 쓴다. 시간이 명시되면 +09:00 기준 ISO datetime으로 쓴다.",
    "각 항목의 sourceText에는 원문 근거를 짧게 남긴다.",
    "불확실하거나 사용자가 확인해야 하는 내용은 warnings에 넣는다.",
    `사용자가 미리 입력한 기업명: ${companyName || "(없음)"}`,
    `사용자가 미리 입력한 공고명: ${postingTitle || "(없음)"}`,
    `사용자가 미리 입력한 직무: ${jobRole || "(없음)"}`,
    "summary에는 회사 소개, 슬로건, 채용 홍보 문구를 넣지 말고 빈 문자열을 반환한다.",
    "jobRole은 ICT, 전기, 사무, 토목처럼 지원자가 실제 선택하는 직무/모집분야만 넣는다. 채용 수준이나 직급명은 jobRole에 넣지 않는다.",
    "연령 제한 없음, 병역, 신분증/수험표, 블라인드 채용, 채용서류 반환, 부정행위, 문의처 같은 일반 안내는 requirements와 checkItems에 넣지 않는다.",
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
