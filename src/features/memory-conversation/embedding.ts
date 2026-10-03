const GEMINI_EMBEDDING_DIMENSIONS = 768;
const GEMINI_EMBEDDING_MAX_INPUT = 12000;
const DEFAULT_EMBEDDING_MODELS = ["gemini-embedding-2", "gemini-embedding-001", "text-embedding-004"];

const geminiApiKey = process.env.GEMINI_API_KEY;
const configuredEmbeddingModel = process.env.GEMINI_EMBEDDING_MODEL;

export function isEmbeddingConfigured() {
  return Boolean(geminiApiKey);
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
      failures.push(`${model}: ${response.status} ${await readErrorBody(response)}`);
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
