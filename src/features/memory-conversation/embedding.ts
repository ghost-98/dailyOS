const GEMINI_EMBEDDING_DIMENSIONS = 768;
const geminiApiKey = process.env.GEMINI_API_KEY;
const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";

export function isEmbeddingConfigured() {
  return Boolean(geminiApiKey);
}

export async function embedMemoryText(text: string) {
  if (!geminiApiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text: text.slice(0, 12000) }] },
      model: `models/${embeddingModel}`,
      taskType: "RETRIEVAL_DOCUMENT",
    }),
  });
  if (!response.ok) throw new Error(`Gemini embedding API error: ${response.status}`);
  const data = await response.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values)) throw new Error("Gemini embedding 응답이 비어 있습니다.");
  const embedding = values.map((value) => Number(value));
  if (embedding.length !== GEMINI_EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding 차원이 ${embedding.length}입니다. Supabase vector(${GEMINI_EMBEDDING_DIMENSIONS})와 맞지 않습니다.`);
  }
  return embedding;
}

export async function embedMemoryQuery(text: string) {
  if (!geminiApiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${geminiApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text: text.slice(0, 12000) }] },
      model: `models/${embeddingModel}`,
      taskType: "RETRIEVAL_QUERY",
    }),
  });
  if (!response.ok) throw new Error(`Gemini query embedding API error: ${response.status}`);
  const data = await response.json();
  const values = data?.embedding?.values;
  if (!Array.isArray(values)) throw new Error("Gemini query embedding 응답이 비어 있습니다.");
  const embedding = values.map((value) => Number(value));
  if (embedding.length !== GEMINI_EMBEDDING_DIMENSIONS) {
    throw new Error(`Query embedding 차원이 ${embedding.length}입니다. Supabase vector(${GEMINI_EMBEDDING_DIMENSIONS})와 맞지 않습니다.`);
  }
  return embedding;
}

export function toPgVector(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}
