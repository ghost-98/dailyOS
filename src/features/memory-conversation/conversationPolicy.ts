import type { MemoryDocument } from "@/features/memory-conversation/types";

export type MemoryQuestionIntent = "analytics" | "recall" | "conversation";
export type MemoryAnalyticsDomain = "money" | "people" | "place" | "health" | "activity" | "general";
export type ConversationRoute = "general_chat" | "memory_recall" | "memory_analytics";

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

export type ConversationPolicyDecision = {
  plan: MemoryQuestionPlan;
  reason: string;
  route: ConversationRoute;
  useMemory: boolean;
};

const DOMAIN_KEYWORDS: Record<MemoryAnalyticsDomain, string[]> = {
  activity: ["활동", "이동", "방문", "일정", "할일", "했던", "한 일"],
  general: ["기록", "패턴", "흐름", "요약", "정리"],
  health: ["운동", "건강", "몸무게", "체중", "러닝", "헬스", "수면"],
  money: ["돈", "소비", "지출", "수입", "결제", "얼마", "카드", "식비", "교통비"],
  people: ["누구", "사람", "친구", "동료", "가족", "만났", "함께"],
  place: ["어디", "장소", "위치", "카페", "식당", "회사", "집", "방문"],
};

const ANALYTICS_SIGNALS = ["얼마", "몇 번", "횟수", "가장", "많이", "비교", "추세", "패턴", "평균", "합계", "총", "분석", "정리"];
const RECALL_SIGNALS = ["언제", "언제먹", "먹었", "먹은", "뭐였", "무엇", "어디", "였지", "더라", "누구", "찾아", "보여"];
const USER_MEMORY_MARKERS = ["내가", "나는", "나랑", "내 ", "나의", "기록", "최근", "요즘", "오늘", "어제", "이번", "지난"];
const MEMORY_TOPIC_SIGNALS = [
  "기록",
  "최근",
  "요즘",
  "오늘",
  "어제",
  "이번",
  "지난",
  "언제",
  "어디",
  "누구",
  "먹",
  "갔",
  "방문",
  "만났",
  "소비",
  "지출",
  "수입",
  "운동",
  "몸무게",
  "사진",
  "활동",
  "일정",
  "할일",
  "패턴",
  "분석",
  "정리",
];

export function decideConversationRoute(question: string, documents: MemoryDocument[]): ConversationPolicyDecision {
  const normalizedQuestion = normalize(question);
  const plan = planMemoryQuestion(question, documents);
  const userMemoryMarkers = getMatchedSignals(normalizedQuestion, USER_MEMORY_MARKERS);

  if (isMetaConversationTurn(normalizedQuestion)) {
    return {
      plan,
      reason: "meta_conversation_turn",
      route: "general_chat",
      useMemory: false,
    };
  }

  if (isAssistantDirectedQuestion(normalizedQuestion) && userMemoryMarkers.length === 0) {
    return {
      plan,
      reason: "assistant_directed_general_question",
      route: "general_chat",
      useMemory: false,
    };
  }

  if (plan.needsDeterministicAnswer) {
    return {
      plan,
      reason: "deterministic_analytics_signal",
      route: "memory_analytics",
      useMemory: true,
    };
  }

  if (plan.intent === "recall") {
    return {
      plan,
      reason: "memory_recall_signal",
      route: "memory_recall",
      useMemory: true,
    };
  }

  const memorySignals = getMatchedSignals(normalizedQuestion, MEMORY_TOPIC_SIGNALS);
  if (memorySignals.length > 0) {
    return {
      plan,
      reason: `memory_topic_signal:${memorySignals.slice(0, 3).join(",")}`,
      route: plan.intent === "analytics" ? "memory_analytics" : "memory_recall",
      useMemory: true,
    };
  }

  return {
    plan,
    reason: "no_memory_signal",
    route: "general_chat",
    useMemory: false,
  };
}

export function planMemoryQuestion(question: string, documents: MemoryDocument[]): MemoryQuestionPlan {
  const normalizedQuestion = normalize(question);
  const domain = detectDomain(normalizedQuestion);
  const dateRange = detectDateRange(normalizedQuestion, documents);
  const hasAnalyticsSignal = ANALYTICS_SIGNALS.some((signal) => normalizedQuestion.includes(signal));
  const hasRecallSignal = RECALL_SIGNALS.some((signal) => normalizedQuestion.includes(signal));
  const needsDeterministicAnswer = hasAnalyticsSignal && !hasRecallSignal;

  return {
    dateRange,
    domain,
    intent: hasRecallSignal ? "recall" : needsDeterministicAnswer ? "analytics" : "conversation",
    keywords: extractKeywords(normalizedQuestion),
    needsDeterministicAnswer,
  };
}

function isAssistantDirectedQuestion(question: string) {
  const compact = question.replace(/\s+/g, "");
  return /(너|넌|너는|니가|dailyos|데일리os|데일리오에스|챗봇|비서|너뭐|넌뭐)/i.test(compact);
}

function isMetaConversationTurn(question: string) {
  return /물어볼게|물어볼께|질문할게|질문할께|물어보려고|질문하려고|궁금한게 있어|궁금한 게 있어|하나 물어|한번 물어/.test(question);
}

function getMatchedSignals(question: string, signals: string[]) {
  return signals.filter((signal) => question.includes(signal));
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
    return { end: getMonthEndDate(month), label: `${month}`, start: `${month}-01` };
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
  return { end: getMonthEndDate(month), label, start: `${month}-01` };
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

function getMonthEndDate(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return `${month}-01`;
  return new Date(year, monthNumber, 0).toISOString().slice(0, 10);
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}
