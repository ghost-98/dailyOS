import type { MemoryQuestionPlan } from "@/features/memory-conversation/questionRouter";
import type { MemoryChatResponse, MemoryDocument, MemoryEvidence, MemorySummary } from "@/features/memory-conversation/types";

type CountItem = {
  count: number;
  name: string;
};

type MoneyFact = {
  amount: number;
  date: string;
  document: MemoryDocument;
};

export function buildAnalyticsMemoryAnswer(question: string, plan: MemoryQuestionPlan, documents: MemoryDocument[], summaries: MemorySummary[]): MemoryChatResponse | null {
  const scopedDocuments = filterByDateRange(documents, plan);
  if (scopedDocuments.length === 0) return null;

  if (plan.domain === "money") return buildMoneyAnswer(question, plan, scopedDocuments, summaries);
  if (plan.domain === "people") return buildPeopleAnswer(question, plan, scopedDocuments);
  if (plan.domain === "place") return buildPlaceAnswer(question, plan, scopedDocuments);
  if (plan.domain === "health") return buildHealthAnswer(question, plan, scopedDocuments);
  if (plan.intent === "analytics") return buildGeneralAnalyticsAnswer(question, plan, scopedDocuments);
  return null;
}

function buildMoneyAnswer(question: string, plan: MemoryQuestionPlan, documents: MemoryDocument[], summaries: MemorySummary[]): MemoryChatResponse {
  const moneyFacts = documents
    .filter((document) => document.kind === "expense" || document.kind === "income" || /지출|수입|원|결제|소비/.test(document.text))
    .flatMap(extractMoneyFacts);
  const expenseFacts = moneyFacts.filter((fact) => fact.document.kind !== "income");
  const incomeFacts = moneyFacts.filter((fact) => fact.document.kind === "income");
  const totalExpense = sum(expenseFacts.map((fact) => fact.amount));
  const totalIncome = sum(incomeFacts.map((fact) => fact.amount));
  const topExpenses = [...expenseFacts].sort((left, right) => right.amount - left.amount).slice(0, 5);
  const byTitle = topCounts(expenseFacts.map((fact) => fact.document.title)).slice(0, 5);
  const basis = expenseFacts.length > 0 ? expenseFacts : moneyFacts;

  const answer = [
    `${plan.dateRange.label} 기준으로 금액이 확인되는 기록 ${moneyFacts.length}건을 계산했어요.`,
    totalExpense > 0 ? `확인된 지출 합계는 ${formatWon(totalExpense)}입니다.` : "",
    totalIncome > 0 ? `확인된 수입 합계는 ${formatWon(totalIncome)}입니다.` : "",
    byTitle.length > 0 ? `반복적으로 보이는 지출 제목은 ${byTitle.map((item) => `${item.name} ${item.count}건`).join(", ")}입니다.` : "",
    topExpenses.length > 0 ? `큰 지출은 ${topExpenses.map((fact) => `${fact.date} ${fact.document.title} ${formatWon(fact.amount)}`).join(" / ")}입니다.` : "",
    summaries[0]?.text ? `요약 메모리상 흐름: ${summaries[0].text}` : "",
  ].filter(Boolean).join("\n");

  return {
    answer,
    evidence: buildEvidence(basis.map((fact) => fact.document), question, "금액 계산에 직접 사용한 기록"),
    followups: ["월별로 비교해줘", "가장 큰 지출만 자세히 봐줘", "반복 지출을 찾아줘", "소비를 줄일 수 있는 지점을 알려줘"],
    mode: "local",
    summary: `${plan.dateRange.label} 금액 기록 ${moneyFacts.length}건 분석`,
  };
}

function buildPeopleAnswer(question: string, plan: MemoryQuestionPlan, documents: MemoryDocument[]): MemoryChatResponse {
  const peopleCounts = topCounts(documents.flatMap((document) => readStringArray(document.metadata.people))).slice(0, 8);
  const relatedDocuments = documents.filter((document) => readStringArray(document.metadata.people).length > 0);
  const answer = [
    `${plan.dateRange.label} 기준으로 사람 정보가 있는 기록 ${relatedDocuments.length}건을 봤어요.`,
    peopleCounts.length > 0 ? `가장 자주 등장한 사람은 ${peopleCounts.map((item) => `${item.name} ${item.count}건`).join(", ")}입니다.` : "사람 이름이 구조화된 기록은 아직 적습니다.",
    relatedDocuments.slice(0, 5).map((document) => `- ${document.date} · ${document.title} · ${readStringArray(document.metadata.people).join(", ")}`).join("\n"),
  ].filter(Boolean).join("\n");

  return {
    answer,
    evidence: buildEvidence(relatedDocuments, question, "사람 분석에 사용한 기록"),
    followups: ["사람별로 최근 만난 장소를 알려줘", "가장 자주 본 사람과의 기록만 모아줘", "지난 달과 비교해줘", "사람별 소비도 같이 봐줘"],
    mode: "local",
    summary: `${plan.dateRange.label} 사람 기록 ${relatedDocuments.length}건 분석`,
  };
}

function buildPlaceAnswer(question: string, plan: MemoryQuestionPlan, documents: MemoryDocument[]): MemoryChatResponse {
  const placeCounts = topCounts(documents.flatMap((document) => readStringArray(document.metadata.places))).slice(0, 8);
  const relatedDocuments = documents.filter((document) => readStringArray(document.metadata.places).length > 0);
  const answer = [
    `${plan.dateRange.label} 기준으로 장소 정보가 있는 기록 ${relatedDocuments.length}건을 봤어요.`,
    placeCounts.length > 0 ? `가장 자주 등장한 장소는 ${placeCounts.map((item) => `${item.name} ${item.count}건`).join(", ")}입니다.` : "장소가 구조화된 기록은 아직 적습니다.",
    relatedDocuments.slice(0, 5).map((document) => `- ${document.date} · ${document.title} · ${readStringArray(document.metadata.places).join(", ")}`).join("\n"),
  ].filter(Boolean).join("\n");

  return {
    answer,
    evidence: buildEvidence(relatedDocuments, question, "장소 분석에 사용한 기록"),
    followups: ["장소별로 함께한 사람을 알려줘", "최근 자주 간 장소만 봐줘", "이동 기록과 같이 분석해줘", "지난 달과 비교해줘"],
    mode: "local",
    summary: `${plan.dateRange.label} 장소 기록 ${relatedDocuments.length}건 분석`,
  };
}

function buildHealthAnswer(question: string, plan: MemoryQuestionPlan, documents: MemoryDocument[]): MemoryChatResponse {
  const healthDocuments = documents.filter((document) => /운동|건강|몸무게|체중|러닝|헬스|workout|weight/i.test([document.label, document.title, document.text].join(" ")));
  const answer = [
    `${plan.dateRange.label} 기준으로 건강/운동 관련 기록 ${healthDocuments.length}건을 봤어요.`,
    healthDocuments.length > 0 ? healthDocuments.slice(0, 8).map((document) => `- ${document.date} · ${document.label} · ${document.title}: ${document.text}`).join("\n") : "건강/운동 기록이 아직 충분하지 않습니다.",
  ].join("\n");

  return {
    answer,
    evidence: buildEvidence(healthDocuments, question, "건강 흐름 분석에 사용한 기록"),
    followups: ["운동 빈도를 주별로 나눠줘", "몸무게 흐름을 같이 봐줘", "운동한 날의 다른 기록도 알려줘", "최근 30일만 다시 분석해줘"],
    mode: "local",
    summary: `${plan.dateRange.label} 건강/운동 기록 ${healthDocuments.length}건 분석`,
  };
}

function buildGeneralAnalyticsAnswer(question: string, plan: MemoryQuestionPlan, documents: MemoryDocument[]): MemoryChatResponse {
  const labelCounts = topCounts(documents.map((document) => document.label)).slice(0, 8);
  const answer = [
    `${plan.dateRange.label} 기준으로 관련 기록 ${documents.length}건을 분석했어요.`,
    `기록 유형은 ${labelCounts.map((item) => `${item.name} ${item.count}건`).join(", ") || "아직 뚜렷하지 않음"}입니다.`,
    documents.slice(0, 6).map((document) => `- ${document.date} · ${document.label} · ${document.title}`).join("\n"),
  ].join("\n");

  return {
    answer,
    evidence: buildEvidence(documents, question, "분석에 사용한 기록"),
    followups: ["사람 기준으로 나눠줘", "장소 기준으로 나눠줘", "최근 기록만 다시 봐줘", "반복되는 패턴을 찾아줘"],
    mode: "local",
    summary: `${plan.dateRange.label} 기록 ${documents.length}건 분석`,
  };
}

function filterByDateRange(documents: MemoryDocument[], plan: MemoryQuestionPlan) {
  return documents.filter((document) => {
    if (document.kind.endsWith("_summary")) return false;
    if (plan.dateRange.start && document.date < plan.dateRange.start) return false;
    if (plan.dateRange.end && document.date > plan.dateRange.end) return false;
    return true;
  });
}

function extractMoneyFacts(document: MemoryDocument): MoneyFact[] {
  const text = [document.title, document.text, readStringArray(document.metadata.facts).join(" ")].join(" ");
  const matches = [...text.matchAll(/([\d,]+)\s*원/g)];
  return matches.flatMap((match) => {
    const amount = Number(match[1]?.replaceAll(",", ""));
    if (!Number.isFinite(amount) || amount <= 0) return [];
    return [{ amount, date: document.date, document }];
  });
}

function buildEvidence(documents: MemoryDocument[], question: string, reason: string): MemoryEvidence[] {
  const seen = new Set<string>();
  return documents.filter((document) => {
    if (seen.has(document.id)) return false;
    seen.add(document.id);
    return true;
  }).slice(0, 8).map((document) => ({
    date: document.date,
    focusId: document.focusId,
    id: document.id,
    label: document.label,
    reason: question ? reason : "답변의 직접 근거 기록",
    title: document.title,
  }));
}

function topCounts(values: string[]): CountItem[] {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([name, count]) => ({ count, name }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, "ko-KR"));
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function formatWon(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}
