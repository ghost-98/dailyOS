import type { LifeAskAnalysis } from "@/features/life/askInsights";

type LifeAskRequestRecord = {
  date: string;
  description: string;
  label: string;
  tags: string[];
  title: string;
  type: string;
};

export async function requestLifeAskAnswer({
  analysis,
  question,
  records,
}: {
  analysis: LifeAskAnalysis;
  question: string;
  records: LifeAskRequestRecord[];
}) {
  const response = await fetch("/api/life/ask", {
    body: JSON.stringify({ analysis, question, records }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  const data = (await response.json()) as { answer?: string; error?: string };
  if (!response.ok) throw new Error(data.error ?? "AI 질문 처리에 실패했습니다.");
  return data.answer ?? "";
}
