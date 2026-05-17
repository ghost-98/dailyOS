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
    const extraction = normalizeExtraction(JSON.parse(outputText));
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
    "너는 채용공고 PDF에서 dailyOS에 필요한 채용관리 데이터만 구조화하는 추출기다.",
    "반환 JSON은 전형명(title), 전형종류(type), 시작일(startAt), 종료일(endAt), 메모(memo), 원문근거(sourceText)를 명확히 분리해야 한다.",
    "전형 일정은 접수기간, 서류전형/서류발표, 필기시험, 코딩테스트, 면접, 결과발표, 건강검진, 입사일처럼 사용자가 캘린더에서 관리할 날짜만 넣는다.",
    "기간이면 startAt과 endAt을 모두 넣고, 단일 날짜이면 startAt과 endAt에 같은 날짜를 넣는다. 시간이 없으면 해당 날짜의 00:00:00+09:00을 사용한다.",
    "title에는 '2차전형 필기전형', '면접전형', '최종 합격자 발표'처럼 전형명을 짧게 넣고, sourceText에는 PDF 원문 근거 문장을 넣는다.",
    "requirements에는 사용자가 지원 가능 여부와 서류 점수/가점 산정을 판단하는 데 필요한 내용만 넣는다.",
    "eligibility에는 필수 자격요건만 넣는다. 예: TOEIC 700점 이상, 기술 분야 전공자 또는 관련 분야 자격증 보유자, 특정 지역인재 지원 가능 조건.",
    "preferred에는 실제 배점이나 가점 계산에 필요한 우대사항만 넣는다. 예: 자격증 가점, 어학 환산식, 서류전형 배점, 우대가점, 이전지역인재 채용목표제.",
    "document에는 지원서/자기소개서/증빙서류처럼 제출 시기와 제출물이 명확한 것만 넣는다.",
    "exam/interview에는 필기 과목, NCS/전공 문항 수, 코딩테스트 과목, 면접 평가요소처럼 전형 준비에 필요한 평가정보만 넣는다.",
    "연령 제한 없음, 병역, 결격사유, 신분증/수험표, 블라인드 채용 유의사항, 채용서류 반환, 부정행위, 문의처, 회사 소개, 슬로건, 일반 유의사항은 requirements에 넣지 않는다.",
    "자격증/어학/가점 표가 PDF에 있으면 title은 짧게, content에는 점수 기준이나 배점 방식을 요약한다. 표 전체를 길게 복붙하지 않는다.",
    "summary에는 아무 것도 넣지 말고 빈 문자열을 반환한다.",
    "jobRole은 ICT, 전기, 사무, 토목처럼 지원자가 실제 선택하는 직무/모집분야만 넣는다. 채용 수준이나 직급명은 jobRole에 넣지 않는다.",
    "steps는 최대 10개, requirements는 최대 8개, checkItems는 최대 4개로 제한한다.",
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

type RawExtraction = {
  companyName?: unknown;
  postingTitle?: unknown;
  jobRole?: unknown;
  postingUrl?: unknown;
  summary?: unknown;
  steps?: unknown;
  requirements?: unknown;
  checkItems?: unknown;
  warnings?: unknown;
};

function normalizeExtraction(value: unknown) {
  const raw = (value && typeof value === "object" ? value : {}) as RawExtraction;

  return {
    companyName: asString(raw.companyName),
    postingTitle: asString(raw.postingTitle),
    jobRole: normalizeJobRole(asString(raw.jobRole)),
    postingUrl: asString(raw.postingUrl),
    summary: "",
    steps: normalizeSteps(raw.steps),
    requirements: normalizeRequirements(raw.requirements),
    checkItems: normalizeCheckItems(raw.checkItems),
    warnings: Array.isArray(raw.warnings) ? raw.warnings.map(asString).filter(Boolean).slice(0, 6) : [],
  };
}

function normalizeSteps(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const raw = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const title = asString(raw.title);
      const startAt = normalizeDateTime(asString(raw.startAt));
      const endAt = normalizeDateTime(asString(raw.endAt)) || startAt;
      return {
        type: normalizeStepType(asString(raw.type), title),
        title,
        startAt,
        endAt,
        memo: asString(raw.memo),
        sourceText: asString(raw.sourceText),
        confidence: Number(raw.confidence) || 0.7,
      };
    })
    .filter((step) => step.title && (step.startAt || step.endAt))
    .slice(0, 10);
}

function normalizeRequirements(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const raw = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const title = asString(raw.title);
      const content = asString(raw.content);
      return {
        category: normalizeRequirementCategoryByText(asString(raw.category), title, content),
        title,
        content,
        sourceText: asString(raw.sourceText),
        confidence: Number(raw.confidence) || 0.7,
      };
    })
    .filter((requirement) => requirement.title && requirement.content && !isGenericRequirement(requirement.title, requirement.content))
    .slice(0, 8);
}

function normalizeCheckItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const raw = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      return {
        title: asString(raw.title),
        category: normalizeRequirementCategory(asString(raw.category)),
        dueAt: normalizeDateTime(asString(raw.dueAt)),
        memo: asString(raw.memo),
        sourceText: asString(raw.sourceText),
        confidence: Number(raw.confidence) || 0.7,
      };
    })
    .filter((item) => item.title)
    .slice(0, 4);
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDateTime(value: string) {
  if (!value) return "";
  const compact = value.trim().replace(/\s+/, "T");
  const hasTime = /\d{4}-\d{2}-\d{2}[T\s]\d{1,2}:\d{2}/.test(value);
  const normalizedWithZone = compact.replace(/([T\s]\d{1,2}:\d{2}(?::\d{2})?)([+-]\d{2}:?\d{2}|Z)$/i, (_match, time, zone) => {
    const safeTime = time.length === 6 ? `${time}:00` : time;
    const safeZone = zone === "Z" || zone.includes(":") ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
    return `${safeTime}${safeZone}`;
  });
  if (hasTime && !Number.isNaN(new Date(normalizedWithZone).getTime())) return normalizedWithZone;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return value.includes("T") ? value : `${value}T00:00:00+09:00`;
  const dateOnly = value.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return dateOnly ? `${dateOnly}T00:00:00+09:00` : "";
}

function normalizeStepType(type: string, title: string) {
  const text = `${type} ${title}`.toLowerCase();
  if (text.includes("접수") || text.includes("지원")) return "application";
  if (text.includes("서류")) return "document";
  if (text.includes("필기") || text.includes("ncs")) return "written";
  if (text.includes("코딩")) return "coding_test";
  if (text.includes("과제")) return "assignment";
  if (text.includes("면접")) return "interview";
  if (text.includes("검진") || text.includes("신체")) return "medical";
  if (text.includes("결과") || text.includes("발표") || text.includes("합격자")) return "result";
  if (text.includes("입사") || text.includes("임용")) return "employment";
  return "etc";
}

function normalizeRequirementCategory(category: string) {
  if (["eligibility", "preferred", "document", "exam", "interview", "note"].includes(category)) return category;
  if (category.includes("가점") || category.includes("우대") || category.includes("배점")) return "preferred";
  if (category.includes("서류") || category.includes("제출")) return "document";
  if (category.includes("필기") || category.includes("시험")) return "exam";
  if (category.includes("면접")) return "interview";
  if (category.includes("자격") || category.includes("자격증") || category.includes("어학") || category.includes("전공")) return "eligibility";
  return "note";
}

function normalizeRequirementCategoryByText(category: string, title: string, content: string) {
  const normalized = normalizeRequirementCategory(category);
  const text = `${title} ${content}`;
  if (/가점|우대|배점|환산|상한점수|채용목표제/.test(text)) return "preferred";
  if (/TOEIC|OPIc|TEPS|JPT|HSK|어학|전공자|자격증\s*보유|지원자격|필수|이상/.test(text)) return "eligibility";
  return normalized;
}

function normalizeJobRole(value: string) {
  if (/직급|대졸|신입사원|채용공고|채용형|인턴/i.test(value)) return "";
  return value;
}

function isGenericRequirement(title: string, content: string) {
  const text = `${title} ${content}`;
  return /연령|병역|결격|신분증|수험표|블라인드|반환|이의신청|부정행위|청탁|문의|홈페이지|회사\s*소개|슬로건|정년|입사일부터\s*근무|허위|위변조|신원조사/.test(text);
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
