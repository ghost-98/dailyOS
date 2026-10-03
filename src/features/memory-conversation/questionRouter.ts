import type { MemoryDocument } from "@/features/memory-conversation/types";

export type MemoryQuestionIntent = "analytics" | "recall" | "conversation";
export type MemoryAnalyticsDomain = "money" | "people" | "place" | "health" | "activity" | "general";

export type MemoryQuestionPlan = {
  dateRange: {
    end?: string;
    label: string;
    start?: string;
  };
  domain: MemoryAnalyticsDomain;
  intent: MemoryQuestionIntent;
  keywords: string[];
  needsDeterministicAnswer: boolean;
};

const DOMAIN_KEYWORDS: Record<MemoryAnalyticsDomain, string[]> = {
  activity: ["활동", "이동", "방문", "일정", "할일", "했던", "한 일"],
  general: ["기록", "패턴", "흐름", "요약", "정리"],
  health: ["운동", "건강", "몸무게", "체중", "러닝", "헬스", "수면"],
  money: ["돈", "소비", "지출", "수입", "결제", "얼마", "카드", "식비", "교통비"],
  people: ["누구", "사람", "친구", "동료", "가족", "만났", "함께"],
  place: ["어디", "장소", "위치", "카페", "식당", "회사", "집", "방문"],
};

export function planMemoryQuestion(question: string, documents: MemoryDocument[]): MemoryQuestionPlan {
  const normalizedQuestion = normalize(question);
  const domain = detectDomain(normalizedQuestion);
  const dateRange = detectDateRange(normalizedQuestion, documents);
  const analyticsSignals = ["얼마", "몇", "횟수", "가장", "많이", "비교", "추세", "패턴", "평균", "합계", "총", "분석", "정리"];
  const recallSignals = ["언제", "뭐였", "무엇", "어디", "누구", "찾아", "보여"];
  const hasAnalyticsSignal = analyticsSignals.some((signal) => normalizedQuestion.includes(signal));
  const hasRecallSignal = recallSignals.some((signal) => normalizedQuestion.includes(signal));
  const needsDeterministicAnswer = hasAnalyticsSignal || ["money", "people", "place", "health"].includes(domain);

  return {
    dateRange,
    domain,
    intent: needsDeterministicAnswer ? "analytics" : hasRecallSignal ? "recall" : "conversation",
    keywords: extractKeywords(normalizedQuestion),
    needsDeterministicAnswer,
  };
}

function detectDomain(question: string): MemoryAnalyticsDomain {
  const scored = Object.entries(DOMAIN_KEYWORDS).map(([domain, keywords]) => ({
    domain: domain as MemoryAnalyticsDomain,
    score: keywords.reduce((sum, keyword) => sum + (question.includes(keyword) ? 1 : 0), 0),
  }));
  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.score ? scored[0].domain : "general";
}

function detectDateRange(question: string, documents: MemoryDocument[]) {
  const dates = documents
    .map((document) => document.date)
    .filter(Boolean)
    .sort();
  const latestDate = dates.at(-1);
  if (!latestDate) return { label: "전체 기간" };

  const latest = new Date(`${latestDate}T00:00:00`);
  if (Number.isNaN(latest.getTime())) return { label: "전체 기간" };

  if (question.includes("오늘")) return singleDayRange(latestDate, "오늘");
  if (question.includes("어제")) return singleDayRange(shiftDate(latest, -1), "어제");
  if (question.includes("최근") || question.includes("요즘")) return relativeRange(latest, 30, "최근 30일");
  if (question.includes("이번 주")) return relativeRange(latest, 7, "최근 7일");
  if (question.includes("이번 달") || question.includes("이번달")) return monthRange(latestDate, "이번 달");
  if (question.includes("지난 달") || question.includes("지난달")) return monthRange(shiftMonth(latest, -1), "지난 달");

  const explicitMonth = question.match(/(20\d{2})[-.년\s]*(0?[1-9]|1[0-2])월?/);
  if (explicitMonth) {
    const month = `${explicitMonth[1]}-${explicitMonth[2].padStart(2, "0")}`;
    return { end: `${month}-31`, label: `${month}`, start: `${month}-01` };
  }

  return { label: "전체 기간" };
}

function extractKeywords(question: string) {
  const stopWords = new Set(["나는", "내가", "나랑", "기록", "기반", "최근", "요즘", "이번", "지난", "정리", "분석", "알려줘"]);
  return question
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 2 && !stopWords.has(term))
    .slice(0, 12);
}

function monthRange(date: string, label: string) {
  const month = date.slice(0, 7);
  return { end: `${month}-31`, label, start: `${month}-01` };
}

function relativeRange(latest: Date, days: number, label: string) {
  return { end: formatDate(latest), label, start: shiftDate(latest, -days + 1) };
}

function singleDayRange(date: string, label: string) {
  return { end: date, label, start: date };
}

function shiftMonth(date: Date, amount: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return formatDate(next);
}

function shiftDate(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return formatDate(next);
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}
