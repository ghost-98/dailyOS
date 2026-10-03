const GEMINI_EMBEDDING_DIMENSIONS = 768;
const GEMINI_EMBEDDING_MAX_INPUT = 12000;
const DEFAULT_EMBEDDING_MODELS = ["gemini-embedding-2", "gemini-embedding-001"];

const geminiApiKey = process.env.GEMINI_API_KEY;
const configuredEmbeddingModel = process.env.GEMINI_EMBEDDING_MODEL;

export function isEmbeddingConfigured() {
  return Boolean(geminiApiKey);
}

export class MemoryEmbeddingUnavailableError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "MemoryEmbeddingUnavailableError";
  }
}

export function isMemoryEmbeddingUnavailableError(error: unknown) {
  return error instanceof MemoryEmbeddingUnavailableError;
}

export async function embedMemoryText(text: string) {
  return embedMemoryInput(`retrieval_document:\n${text}`, "문서");
}

export async function embedMemoryQuery(text: string) {
  return embedMemoryInput(`retrieval_query:\n${text}`, "질문");
}

export function toPgVector(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

async function embedMemoryInput(text: string, label: string) {
  const apiKey = geminiApiKey;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  const models = configuredEmbeddingModel ? [configuredEmbeddingModel] : DEFAULT_EMBEDDING_MODELS;
  const failures: string[] = [];

  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        content: { parts: [{ text: text.slice(0, GEMINI_EMBEDDING_MAX_INPUT) }] },
        output_dimensionality: GEMINI_EMBEDDING_DIMENSIONS,
      }),
    });

    if (!response.ok) {
      const errorBody = await readErrorBody(response);
      if (response.status === 429) {
        throw new MemoryEmbeddingUnavailableError(createQuotaMessage(errorBody), response.status);
      }
      if (response.status !== 404) {
        throw new MemoryEmbeddingUnavailableError(`Gemini 임베딩 API를 사용할 수 없습니다. 상태 코드: ${response.status}`, response.status);
      }
      failures.push(`${model}: ${response.status} ${errorBody}`);
      continue;
    }

    const data = await response.json();
    const values = data?.embedding?.values ?? data?.embeddings?.[0]?.values;
    if (!Array.isArray(values)) {
      failures.push(`${model}: 빈 embedding 응답`);
      continue;
    }

    const embedding = values.map((value) => Number(value));
    if (embedding.length !== GEMINI_EMBEDDING_DIMENSIONS) {
      failures.push(`${model}: ${embedding.length}차원 응답`);
      continue;
    }

    return embedding;
  }

  throw new Error(`Gemini ${label} embedding API error. 시도한 모델: ${failures.join(" | ")}`);
}

async function readErrorBody(response: Response) {
  const body = await response.text().catch(() => "");
  return body.slice(0, 500);
}

function createQuotaMessage(body: string) {
  const retryAfter = body.match(/Please retry in ([^.\n]+)/)?.[1]?.trim();
  return retryAfter
    ? `Gemini 임베딩 무료 할당량을 초과했습니다. 약 ${retryAfter} 후 다시 동기화됩니다.`
    : "Gemini 임베딩 무료 할당량을 초과했습니다. 잠시 후 다시 동기화됩니다.";
}
