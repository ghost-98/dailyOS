import type { CalendarEvent } from "@/features/calendar/data";
import { formatWon } from "@/features/life/formatters";
import type { DailyLogRecord, ExpenseRecord, IncomeRecord, LifeActivityRecord, LifePhotoRecord, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

type AskFocus = "people" | "places" | "finance" | "health" | "activity" | "compare" | "general";

export type LifeAskInsightCard = {
  label: string;
  meta?: string;
  value: string;
};

export type LifeAskEvidenceItem = {
  date: string;
  description: string;
  title: string;
};

export type LifeAskAnalysis = {
  cards: LifeAskInsightCard[];
  evidence: LifeAskEvidenceItem[];
  focus: AskFocus;
  overview: string;
  patterns: string[];
  promptContext: string;
  suggestions: string[];
};

type AskAnalysisInput = {
  activities: LifeActivityRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  incomes: IncomeRecord[];
  logs: DailyLogRecord[];
  photos: LifePhotoRecord[];
  question: string;
  scopedRecords: Array<{
    date: string;
    description: string;
    id: string;
    label: string;
    tags: string[];
    title: string;
    type: string;
  }>;
  tasks: TaskItem[];
  weights: WeightRecord[];
  workouts: WorkoutSession[];
};

export function buildLifeAskAnalysis({
  activities,
  events,
  expenses,
  incomes,
  logs,
  photos,
  question,
  scopedRecords,
  tasks,
  weights,
  workouts,
}: AskAnalysisInput): LifeAskAnalysis {
  const focus = detectAskFocus(question);
  const topPeople = getTopValues([
    ...activities.flatMap((activity) => splitCompanions(activity.companions)),
    ...events.flatMap((event) => splitCompanions(event.companions)),
    ...tasks.flatMap((task) => splitCompanions(task.companions)),
  ]).slice(0, 4);
  const topPlaces = getTopValues([
    ...activities.map((activity) => activity.placeName).filter(Boolean),
    ...events.map((event) => event.place?.name).filter(Boolean),
    ...tasks.map((task) => task.place?.name).filter(Boolean),
  ] as string[]).slice(0, 4);
  const topActivityTypes = getTopValues(activities.map((activity) => activity.category).filter(Boolean) as string[]).slice(0, 4);
  const topExpenseCategories = getTopExpenseCategories(expenses).slice(0, 4);
  const finance = {
    expense: expenses.reduce((sum, item) => sum + item.amount, 0),
    income: incomes.reduce((sum, item) => sum + item.amount, 0),
  };
  const logCount = logs.length;
  const health = {
    lastWeight: weights[0]?.weightKg,
    workouts: workouts.length,
  };
  const evidence = scopedRecords
    .slice(0, 6)
    .map((record) => ({
      date: record.date,
      description: record.description || record.tags.join(" · ") || record.label,
      title: record.title,
    }));

  const cards = buildInsightCards(focus, {
    expenses,
    finance,
    health,
    photos,
    scopedRecords,
    topActivityTypes,
    topPeople,
    topPlaces,
  });

  const patterns = buildPatterns({
    activities,
    expenses,
    finance,
    photos,
    topActivityTypes,
    topExpenseCategories,
    topPeople,
    topPlaces,
    workouts,
  });

  const suggestions = buildSuggestions(focus, { finance, topActivityTypes, topPeople, topPlaces, workouts });
  const overview = buildOverview(focus, {
    cards,
    finance,
    photos,
    scopedRecords,
    topPeople,
    topPlaces,
    workouts,
  });

  const promptContext = [
    `질문 초점: ${focus}`,
    `검토 기록 수: ${scopedRecords.length}건`,
    `대표 사람: ${topPeople.map((item) => `${item.name} ${item.count}회`).join(", ") || "없음"}`,
    `대표 장소: ${topPlaces.map((item) => `${item.name} ${item.count}회`).join(", ") || "없음"}`,
    `대표 활동: ${topActivityTypes.map((item) => `${item.name} ${item.count}회`).join(", ") || "없음"}`,
    `수입/지출: 수입 ${formatWon(finance.income)}, 지출 ${formatWon(finance.expense)}`,
    `운동/사진/하루기록: 운동 ${workouts.length}회, 사진 ${photos.length}장, 하루기록 ${logCount}건`,
    `요약: ${overview}`,
    `패턴: ${patterns.join(" / ") || "패턴 부족"}`,
    `제안: ${suggestions.join(" / ") || "제안 없음"}`,
  ].join("\n");

  return {
    cards,
    evidence,
    focus,
    overview,
    patterns,
    promptContext,
    suggestions,
  };
}

function buildInsightCards(
  focus: AskFocus,
  input: {
    expenses: ExpenseRecord[];
    finance: { expense: number; income: number };
    health: { lastWeight?: number; workouts: number };
    photos: LifePhotoRecord[];
    scopedRecords: AskAnalysisInput["scopedRecords"];
    topActivityTypes: Array<{ count: number; name: string }>;
    topPeople: Array<{ count: number; name: string }>;
    topPlaces: Array<{ count: number; name: string }>;
  },
) {
  const baseCards: LifeAskInsightCard[] = [
    { label: "검토 기록", value: `${input.scopedRecords.length}건` },
    { label: "사진", value: `${input.photos.length}장` },
    { label: "지출", value: formatWon(input.finance.expense) },
    { label: "수입", value: formatWon(input.finance.income) },
  ];

  if (focus === "people") {
    return [
      { label: "핵심 인물", value: input.topPeople[0]?.name || "없음", meta: input.topPeople[0] ? `${input.topPeople[0].count}회` : undefined },
      { label: "대표 장소", value: input.topPlaces[0]?.name || "없음" },
      { label: "지출", value: formatWon(input.finance.expense) },
      { label: "사진", value: `${input.photos.length}장` },
    ];
  }

  if (focus === "places") {
    return [
      { label: "대표 장소", value: input.topPlaces[0]?.name || "없음", meta: input.topPlaces[0] ? `${input.topPlaces[0].count}회` : undefined },
      { label: "함께한 사람", value: input.topPeople[0]?.name || "없음" },
      { label: "대표 활동", value: input.topActivityTypes[0]?.name || "없음" },
      { label: "지출", value: formatWon(input.finance.expense) },
    ];
  }

  if (focus === "finance") {
    return [
      { label: "총 수입", value: formatWon(input.finance.income) },
      { label: "총 지출", value: formatWon(input.finance.expense) },
      { label: "순흐름", value: formatWon(input.finance.income - input.finance.expense) },
      { label: "지출 건수", value: `${input.expenses.length}건` },
    ];
  }

  if (focus === "health") {
    return [
      { label: "운동", value: `${input.health.workouts}회` },
      { label: "최근 몸무게", value: input.health.lastWeight ? `${input.health.lastWeight}kg` : "없음" },
      { label: "사진", value: `${input.photos.length}장` },
      { label: "대표 활동", value: input.topActivityTypes[0]?.name || "없음" },
    ];
  }

  return baseCards;
}

function buildPatterns(input: {
  activities: LifeActivityRecord[];
  expenses: ExpenseRecord[];
  finance: { expense: number; income: number };
  photos: LifePhotoRecord[];
  topActivityTypes: Array<{ count: number; name: string }>;
  topExpenseCategories: Array<{ amount: number; name: string }>;
  topPeople: Array<{ count: number; name: string }>;
  topPlaces: Array<{ count: number; name: string }>;
  workouts: WorkoutSession[];
}) {
  const patterns: string[] = [];

  if (input.topPeople[0]) patterns.push(`${input.topPeople[0].name}와의 기록이 가장 자주 반복됩니다.`);
  if (input.topPlaces[0]) patterns.push(`${input.topPlaces[0].name} 축의 방문이 가장 두드러집니다.`);
  if (input.topActivityTypes[0]) patterns.push(`${input.topActivityTypes[0].name} 유형 활동이 가장 많습니다.`);
  if (input.topExpenseCategories[0]) patterns.push(`지출은 ${input.topExpenseCategories[0].name} 카테고리에 가장 크게 몰립니다.`);
  if (input.photos.length >= input.activities.length && input.photos.length > 0) patterns.push("사진이 많이 남은 날일수록 사건성이 큰 기록일 가능성이 높습니다.");
  if (input.workouts.length > 0 && input.finance.expense > 0) patterns.push("운동 기록과 소비 기록이 같은 기간 안에 함께 존재합니다.");

  return patterns.slice(0, 4);
}

function buildSuggestions(
  focus: AskFocus,
  input: {
    finance: { expense: number; income: number };
    topActivityTypes: Array<{ count: number; name: string }>;
    topPeople: Array<{ count: number; name: string }>;
    topPlaces: Array<{ count: number; name: string }>;
    workouts: WorkoutSession[];
  },
) {
  const suggestions: string[] = [];

  if (focus === "people" && input.topPeople[0]) {
    suggestions.push(`${input.topPeople[0].name} 관련 기록은 장소·지출·사진을 같이 묶어 비교하면 관계 패턴이 더 잘 드러납니다.`);
  }
  if (focus === "places" && input.topPlaces[0]) {
    suggestions.push(`${input.topPlaces[0].name} 방문 전후의 소비와 만난 사람을 같이 보면 장소의 성격이 더 분명해집니다.`);
  }
  if (focus === "finance" && input.finance.expense > input.finance.income) {
    suggestions.push("이 기간은 순지출이어서 사람·장소·활동 기준으로 어디서 지출이 커졌는지 나눠보는 게 좋습니다.");
  }
  if (focus === "health" && input.workouts.length === 0) {
    suggestions.push("건강 흐름은 운동·수면·활동량 중 하나라도 더 쌓이면 해석 정확도가 크게 올라갑니다.");
  }
  if (input.topActivityTypes[0]) {
    suggestions.push(`${input.topActivityTypes[0].name} 활동이 반복되므로 이 패턴의 시간대·장소·지출을 루틴으로 따로 보는 것이 유효합니다.`);
  }

  return suggestions.slice(0, 3);
}

function buildOverview(
  focus: AskFocus,
  input: {
    cards: LifeAskInsightCard[];
    finance: { expense: number; income: number };
    photos: LifePhotoRecord[];
    scopedRecords: AskAnalysisInput["scopedRecords"];
    topPeople: Array<{ count: number; name: string }>;
    topPlaces: Array<{ count: number; name: string }>;
    workouts: WorkoutSession[];
  },
) {
  if (input.scopedRecords.length === 0) return "아직 질문과 연결된 기록이 충분하지 않습니다.";

  if (focus === "people") {
    return input.topPeople[0]
      ? `${input.topPeople[0].name} 중심의 기록이 가장 많이 잡히고, 장소와 사진까지 함께 남아 관계 흐름을 읽기 좋은 상태입니다.`
      : "사람 흐름을 묻는 질문이지만 함께한 사람 데이터는 아직 옅습니다.";
  }

  if (focus === "places") {
    return input.topPlaces[0]
      ? `${input.topPlaces[0].name} 축의 흔적이 가장 강하고, 그 장소를 중심으로 활동과 소비 문맥이 모이고 있습니다.`
      : "장소 질문이지만 아직 특정 장소 축이 선명하게 드러나진 않습니다.";
  }

  if (focus === "finance") {
    const net = input.finance.income - input.finance.expense;
    return `이 질문 범위의 자금 흐름은 ${net >= 0 ? "순유입" : "순지출"} 상태이며, 단순 금액보다 어떤 사람·장소·활동과 묶여 있는지가 중요합니다.`;
  }

  if (focus === "health") {
    return `건강 질문 범위에서 운동 ${input.workouts.length}회, 사진 ${input.photos.length}장, 관련 기록 ${input.scopedRecords.length}건이 잡혀 생활 흐름과 같이 읽을 수 있습니다.`;
  }

  return `이 질문 범위에는 ${input.scopedRecords.length}건의 기록이 연결되고, 사람·장소·소비·사진의 공통 패턴을 읽을 수 있는 기반이 있습니다.`;
}

function detectAskFocus(question: string): AskFocus {
  const normalized = question.toLowerCase();
  if (containsAny(normalized, ["비교", "전보다", "대비", "차이"])) return "compare";
  if (containsAny(normalized, ["누구", "사람", "친구", "만났"])) return "people";
  if (containsAny(normalized, ["장소", "어디", "갔", "방문"])) return "places";
  if (containsAny(normalized, ["지출", "수입", "돈", "소비"])) return "finance";
  if (containsAny(normalized, ["건강", "운동", "몸무게", "수면"])) return "health";
  if (containsAny(normalized, ["활동", "무엇", "뭐", "했"])) return "activity";
  return "general";
}

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function splitCompanions(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTopValues(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([name, count]) => ({ count, name }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

function getTopExpenseCategories(expenses: ExpenseRecord[]) {
  const labels: Record<ExpenseRecord["category"], string> = {
    culture: "문화",
    education: "교육",
    etc: "기타",
    food: "식비",
    health: "건강",
    housing: "주거",
    shopping: "쇼핑",
    transport: "교통",
  };

  const totals = new Map<ExpenseRecord["category"], number>();
  expenses.forEach((expense) => totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount));
  return [...totals.entries()]
    .map(([category, amount]) => ({ amount, name: labels[category] }))
    .sort((left, right) => right.amount - left.amount);
}
