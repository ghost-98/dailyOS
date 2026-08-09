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

export type LifeAskBreakdown = {
  items: string[];
  title: string;
};

export type LifeAskAnalysis = {
  breakdowns: LifeAskBreakdown[];
  cards: LifeAskInsightCard[];
  evidence: LifeAskEvidenceItem[];
  focus: AskFocus;
  focusDescription: string;
  focusTitle: string;
  overview: string;
  patterns: string[];
  promptContext: string;
  suggestions: string[];
};

type LifeAskFocusData = Pick<LifeAskAnalysis, "breakdowns" | "cards" | "focusDescription" | "focusTitle" | "overview" | "patterns" | "suggestions">;

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

type NamedCount = { count: number; name: string };

export function buildLifeAskAnalysis(input: AskAnalysisInput): LifeAskAnalysis {
  const focus = detectAskFocus(input.question);
  const topPeople = collectTopPeople(input).slice(0, 5);
  const topPlaces = collectTopPlaces(input).slice(0, 5);
  const topActivityTypes = getTopValues(input.activities.map((activity) => activity.category).filter(Boolean) as string[]).slice(0, 5);
  const topExpenseCategories = getTopExpenseCategories(input.expenses).slice(0, 5);
  const finance = {
    expense: input.expenses.reduce((sum, item) => sum + item.amount, 0),
    income: input.incomes.reduce((sum, item) => sum + item.amount, 0),
    net: input.incomes.reduce((sum, item) => sum + item.amount, 0) - input.expenses.reduce((sum, item) => sum + item.amount, 0),
  };
  const dateRange = getDateRange(input.scopedRecords.map((record) => record.date));

  const focusEntity =
    focus === "people"
      ? pickQuestionEntity(input.question, topPeople.map((item) => item.name))
      : focus === "places"
        ? pickQuestionEntity(input.question, topPlaces.map((item) => item.name))
        : undefined;

  const evidence = input.scopedRecords.slice(0, 8).map((record) => ({
    date: record.date,
    description: record.description || record.tags.join(" · ") || record.label,
    title: record.title,
  }));

  const focusData = buildFocusData({
    dateRange,
    finance,
    focus,
    focusEntity,
    input,
    topActivityTypes,
    topExpenseCategories,
    topPeople,
    topPlaces,
  });

  const promptContext = [
    `질문 초점: ${focus}`,
    `초점 라벨: ${focusData.focusTitle}`,
    `기간 범위: ${dateRange}`,
    `검토 기록 수: ${input.scopedRecords.length}건`,
    `핵심 요약: ${focusData.overview}`,
    `카드: ${focusData.cards.map((card) => `${card.label}=${card.value}${card.meta ? `(${card.meta})` : ""}`).join(", ")}`,
    `패턴: ${focusData.patterns.join(" / ") || "패턴 부족"}`,
    `제안: ${focusData.suggestions.join(" / ") || "제안 없음"}`,
    `브레이크다운: ${focusData.breakdowns.map((section) => `${section.title}: ${section.items.join(" | ")}`).join(" || ")}`,
  ].join("\n");

  return {
    breakdowns: focusData.breakdowns,
    cards: focusData.cards,
    evidence,
    focus,
    focusDescription: focusData.focusDescription,
    focusTitle: focusData.focusTitle,
    overview: focusData.overview,
    patterns: focusData.patterns,
    promptContext,
    suggestions: focusData.suggestions,
  };
}

function buildFocusData(args: {
  dateRange: string;
  finance: { expense: number; income: number; net: number };
  focus: AskFocus;
  focusEntity?: string;
  input: AskAnalysisInput;
  topActivityTypes: NamedCount[];
  topExpenseCategories: Array<{ amount: number; name: string }>;
  topPeople: NamedCount[];
  topPlaces: NamedCount[];
}): LifeAskFocusData {
  switch (args.focus) {
    case "people":
      return buildPeopleFocus(args);
    case "places":
      return buildPlacesFocus(args);
    case "finance":
      return buildFinanceFocus(args);
    case "health":
      return buildHealthFocus(args);
    case "compare":
      return buildCompareFocus(args);
    case "activity":
      return buildActivityFocus(args);
    default:
      return buildGeneralFocus(args);
  }
}

function buildPeopleFocus(args: Parameters<typeof buildGeneralFocus>[0]) {
  const personName = args.focusEntity || args.topPeople[0]?.name;
  const relatedActivities = args.input.activities.filter((activity) => splitCompanions(activity.companions).includes(personName ?? ""));
  const relatedEvents = args.input.events.filter((event) => splitCompanions(event.companions).includes(personName ?? ""));
  const relatedTasks = args.input.tasks.filter((task) => splitCompanions(task.companions).includes(personName ?? ""));
  const relatedPhotos = args.input.photos.filter((photo) => photo.linkedTargetTitle?.includes(personName ?? "") || (photo.caption ?? "").includes(personName ?? ""));
  const places = getTopValues([
    ...relatedActivities.map((activity) => activity.placeName).filter(Boolean),
    ...relatedEvents.map((event) => event.place?.name).filter(Boolean),
    ...relatedTasks.map((task) => task.place?.name).filter(Boolean),
  ] as string[]).slice(0, 4);
  const activityTypes = getTopValues(relatedActivities.map((activity) => activity.category).filter(Boolean) as string[]).slice(0, 4);

  return {
    breakdowns: [
      {
        title: "관계 흐름",
        items: [
          personName ? `${personName} 관련 기록 ${relatedActivities.length + relatedEvents.length + relatedTasks.length}건` : "질문에서 특정 인물을 명확히 찾지 못함",
          places[0] ? `가장 자주 연결된 장소는 ${places[0].name}` : "장소 연결은 아직 옅음",
          activityTypes[0] ? `대표 활동은 ${activityTypes[0].name}` : "활동 유형은 아직 분산됨",
        ],
      },
      {
        title: "사진·기록",
        items: [
          `관련 사진 ${relatedPhotos.length}장`,
          relatedActivities[0]?.memo ? `최근 메모 맥락: ${relatedActivities[0].memo}` : "활동 메모는 아직 적음",
          args.topPeople[0] ? `전체 관계축 최상위는 ${args.topPeople[0].name}` : "관계축 상위 인물 없음",
        ],
      },
    ],
    cards: [
      { label: "핵심 인물", value: personName || "없음" },
      { label: "관련 기록", value: `${relatedActivities.length + relatedEvents.length + relatedTasks.length}건` },
      { label: "관련 사진", value: `${relatedPhotos.length}장` },
      { label: "대표 장소", value: places[0]?.name || "없음", meta: places[0] ? `${places[0].count}회` : undefined },
    ],
    focusDescription: "사람 질문에서는 누가 중심인지, 함께한 장소와 활동이 어떤 관계 패턴을 만드는지 읽습니다.",
    focusTitle: personName ? `${personName} 관계 분석` : "관계 분석",
    overview: personName
      ? `${personName}와 관련된 기록은 장소와 활동 유형이 함께 묶여 보여서, 단순 만남 횟수보다 관계의 성격을 읽기 좋은 상태입니다.`
      : "관계 질문이지만 특정 인물이 충분히 선명하지 않아 전체 관계축 중심으로 해석합니다.",
    patterns: [
      personName ? `${personName}와의 만남은 특정 장소·활동 패턴으로 수렴하는 경향이 있습니다.` : "관계 데이터가 여러 인물에게 분산되어 있습니다.",
      places[0] ? `${places[0].name}이 관계의 대표 배경 장소로 보입니다.` : "대표 장소가 아직 강하게 드러나지 않습니다.",
      activityTypes[0] ? `${activityTypes[0].name} 맥락에서 관계 기록이 가장 많이 남습니다.` : "활동 유형은 아직 다양하게 분산됩니다.",
    ].filter(Boolean),
    suggestions: [
      personName ? `${personName} 관련 기록은 장소·사진·지출까지 같이 묶어 보면 더 입체적으로 해석됩니다.` : "질문에 사람 이름을 직접 넣으면 더 선명한 관계 분석이 가능합니다.",
      "함께한 사람 입력이 꾸준할수록 관계 변화 분석 품질이 크게 올라갑니다.",
    ],
  };
}

function buildPlacesFocus(args: Parameters<typeof buildGeneralFocus>[0]) {
  const placeName = args.focusEntity || args.topPlaces[0]?.name;
  const relatedActivities = args.input.activities.filter((activity) => activity.placeName === placeName);
  const relatedEvents = args.input.events.filter((event) => event.place?.name === placeName);
  const relatedTasks = args.input.tasks.filter((task) => task.place?.name === placeName);
  const relatedPeople = getTopValues([
    ...relatedActivities.flatMap((activity) => splitCompanions(activity.companions)),
    ...relatedEvents.flatMap((event) => splitCompanions(event.companions)),
    ...relatedTasks.flatMap((task) => splitCompanions(task.companions)),
  ]).slice(0, 4);
  const relatedActivityTypes = getTopValues(relatedActivities.map((activity) => activity.category).filter(Boolean) as string[]).slice(0, 4);

  return {
    breakdowns: [
      {
        title: "장소 성격",
        items: [
          placeName ? `${placeName} 관련 기록 ${relatedActivities.length + relatedEvents.length + relatedTasks.length}건` : "질문에서 특정 장소를 명확히 찾지 못함",
          relatedActivityTypes[0] ? `대표 활동은 ${relatedActivityTypes[0].name}` : "활동 유형은 아직 분산됨",
          relatedPeople[0] ? `가장 자주 연결된 사람은 ${relatedPeople[0].name}` : "특정 사람 축은 아직 옅음",
        ],
      },
      {
        title: "방문 맥락",
        items: [
          args.topExpenseCategories[0] ? `전체 지출은 ${args.topExpenseCategories[0].name} 카테고리 영향이 큼` : "지출 카테고리 데이터가 부족함",
          args.input.photos.filter((photo) => photo.linkedTargetTitle?.includes(placeName ?? "")).length > 0 ? "사진까지 함께 남는 장소" : "사진 연결은 아직 적음",
          placeName ? `${placeName}는 단순 방문 수보다 누가/무엇 때문에 갔는지가 핵심` : "장소 맥락 해석을 위한 연결이 더 필요함",
        ],
      },
    ],
    cards: [
      { label: "대표 장소", value: placeName || "없음" },
      { label: "관련 기록", value: `${relatedActivities.length + relatedEvents.length + relatedTasks.length}건` },
      { label: "대표 사람", value: relatedPeople[0]?.name || "없음" },
      { label: "대표 활동", value: relatedActivityTypes[0]?.name || "없음" },
    ],
    focusDescription: "장소 질문에서는 방문 횟수보다 그 장소가 어떤 사람·활동·소비와 묶이는지 봅니다.",
    focusTitle: placeName ? `${placeName} 장소 분석` : "장소 분석",
    overview: placeName
      ? `${placeName}은(는) 단순 방문지라기보다 특정 활동과 사람 맥락이 반복되는 생활 축인지 확인하는 게 중요합니다.`
      : "장소 질문이지만 특정 장소가 선명하지 않아 전체 방문 축 중심으로 해석합니다.",
    patterns: [
      placeName ? `${placeName} 관련 기록은 활동과 관계 데이터가 같이 붙을 때 의미가 커집니다.` : "대표 장소 없이 방문 데이터가 분산됩니다.",
      relatedPeople[0] ? `${relatedPeople[0].name}와 함께한 장소 맥락이 가장 강합니다.` : "장소와 연결되는 핵심 사람이 아직 옅습니다.",
      relatedActivityTypes[0] ? `${relatedActivityTypes[0].name} 목적 방문이 중심으로 보입니다.` : "방문 목적은 아직 다양하게 흩어져 있습니다.",
    ].filter(Boolean),
    suggestions: [
      placeName ? `${placeName} 방문 전후의 소비와 사진을 같이 보면 장소의 성격이 더 선명해집니다.` : "질문에 장소 이름을 직접 넣으면 더 강한 장소 분석이 가능합니다.",
      "장소는 사람·시간대·소비와 묶일수록 가치 있는 인사이트가 됩니다.",
    ],
  };
}

function buildFinanceFocus(args: Parameters<typeof buildGeneralFocus>[0]) {
  const expensiveDays = getTopValues(args.input.expenses.map((expense) => expense.date)).slice(0, 3);

  return {
    breakdowns: [
      {
        title: "자금 흐름",
        items: [
          `총 수입 ${formatWon(args.finance.income)}`,
          `총 지출 ${formatWon(args.finance.expense)}`,
          `순흐름 ${formatWon(args.finance.net)}`,
        ],
      },
      {
        title: "지출 집중 구간",
        items: [
          args.topExpenseCategories[0] ? `가장 큰 지출 카테고리는 ${args.topExpenseCategories[0].name}` : "지출 카테고리 데이터 부족",
          expensiveDays[0] ? `가장 기록이 몰린 날짜는 ${expensiveDays[0].name}` : "날짜 집중도는 아직 약함",
          args.topPlaces[0] ? `지출은 ${args.topPlaces[0].name} 축과 연결될 가능성이 큼` : "장소축은 아직 약함",
        ],
      },
    ],
    cards: [
      { label: "총 수입", value: formatWon(args.finance.income) },
      { label: "총 지출", value: formatWon(args.finance.expense) },
      { label: "순흐름", value: formatWon(args.finance.net) },
      { label: "주요 카테고리", value: args.topExpenseCategories[0]?.name || "없음" },
    ],
    focusDescription: "소비 질문에서는 금액 합계보다 어떤 활동·장소·사람과 연결된 지출인지가 더 중요합니다.",
    focusTitle: "자금 흐름 분석",
    overview: `현재 질문 범위의 자금 흐름은 ${args.finance.net >= 0 ? "순유입" : "순지출"} 상태이며, 어느 카테고리와 어떤 생활 맥락에 몰렸는지를 보는 단계입니다.`,
    patterns: [
      args.topExpenseCategories[0] ? `${args.topExpenseCategories[0].name} 카테고리 지출 비중이 가장 큽니다.` : "대표 지출 카테고리가 아직 분명하지 않습니다.",
      args.topPlaces[0] ? `${args.topPlaces[0].name} 같은 장소 축이 소비와 함께 움직일 가능성이 높습니다.` : "지출과 장소의 연결은 아직 약합니다.",
      args.topPeople[0] ? `${args.topPeople[0].name} 같은 관계축과 비용이 함께 움직이는지 볼 가치가 있습니다.` : "사람 축과의 소비 연결은 아직 약합니다.",
    ].filter(Boolean),
    suggestions: [
      "다음 단계에서는 지출을 사람·장소·활동 기준으로 다시 묶어보면 소비 패턴이 훨씬 선명해집니다.",
      args.finance.net < 0 ? "순지출 구간이므로 어떤 활동이 비용 상승을 끌었는지 함께 보는 것이 좋습니다." : "순유입 상태라도 소비 구조가 건강한지 따로 점검할 가치가 있습니다.",
    ],
  };
}

function buildHealthFocus(args: Parameters<typeof buildGeneralFocus>[0]) {
  const latestWeight = args.input.weights[0];
  const oldestWeight = args.input.weights[args.input.weights.length - 1];
  const weightDiff = latestWeight && oldestWeight ? latestWeight.weightKg - oldestWeight.weightKg : undefined;
  const totalWorkoutMinutes = args.input.workouts.reduce((sum, workout) => sum + workout.durationMinutes, 0);

  return {
    breakdowns: [
      {
        title: "건강 흐름",
        items: [
          `운동 ${args.input.workouts.length}회`,
          `총 운동 시간 ${totalWorkoutMinutes}분`,
          latestWeight ? `최근 몸무게 ${latestWeight.weightKg}kg` : "몸무게 기록 없음",
        ],
      },
      {
        title: "생활과의 연결",
        items: [
          args.topActivityTypes[0] ? `대표 활동은 ${args.topActivityTypes[0].name}` : "활동 유형 분산",
          args.topPlaces[0] ? `주요 장소는 ${args.topPlaces[0].name}` : "장소 흐름 약함",
          typeof weightDiff === "number" ? `몸무게 변화 ${weightDiff > 0 ? "+" : ""}${weightDiff.toFixed(1)}kg` : "몸무게 변화 계산 어려움",
        ],
      },
    ],
    cards: [
      { label: "운동", value: `${args.input.workouts.length}회` },
      { label: "총 운동 시간", value: `${totalWorkoutMinutes}분` },
      { label: "최근 몸무게", value: latestWeight ? `${latestWeight.weightKg}kg` : "없음" },
      { label: "몸무게 변화", value: typeof weightDiff === "number" ? `${weightDiff > 0 ? "+" : ""}${weightDiff.toFixed(1)}kg` : "알 수 없음" },
    ],
    focusDescription: "건강 질문에서는 운동·몸무게 자체보다 다른 생활 기록과의 동반 흐름을 봐야 합니다.",
    focusTitle: "건강 흐름 분석",
    overview: `건강 데이터는 아직 ${args.input.workouts.length > 0 || args.input.weights.length > 0 ? "해석 가능한 수준" : "초기 수준"}이며, 활동·장소·소비와 같이 읽을 때 가치가 커집니다.`,
    patterns: [
      args.input.workouts.length > 0 ? "운동 기록이 존재해 생활 패턴과의 상관을 읽을 수 있습니다." : "운동 기록이 적어 건강 해석 폭이 좁습니다.",
      latestWeight ? "몸무게 기록이 있어 건강 흐름을 시계열로 볼 수 있습니다." : "몸무게 기록이 아직 충분하지 않습니다.",
      args.topActivityTypes[0] ? `${args.topActivityTypes[0].name} 활동과 건강 데이터의 관계를 더 볼 가치가 있습니다.` : "생활 활동과 건강 데이터 연결은 아직 약합니다.",
    ].filter(Boolean),
    suggestions: [
      "건강 해석 품질을 높이려면 운동·몸무게와 함께 수면/컨디션 기록도 들어오면 좋습니다.",
      "건강 질문은 날짜 범위를 좁혀서 비교하면 훨씬 선명해집니다.",
    ],
  };
}

function buildCompareFocus(args: Parameters<typeof buildGeneralFocus>[0]) {
  const orderedDates = [...new Set(args.input.scopedRecords.map((record) => record.date))].sort();
  const pivot = Math.floor(orderedDates.length / 2);
  const beforeDates = new Set(orderedDates.slice(0, pivot));
  const afterDates = new Set(orderedDates.slice(pivot));
  const beforeCount = args.input.scopedRecords.filter((record) => beforeDates.has(record.date)).length;
  const afterCount = args.input.scopedRecords.filter((record) => afterDates.has(record.date)).length;

  return {
    breakdowns: [
      {
        title: "전반 비교",
        items: [
          `앞 구간 기록 ${beforeCount}건`,
          `뒤 구간 기록 ${afterCount}건`,
          beforeCount !== afterCount ? `기록 밀도는 ${afterCount > beforeCount ? "뒤 구간" : "앞 구간"}이 더 높음` : "기록 밀도는 비슷함",
        ],
      },
      {
        title: "축 변화",
        items: [
          args.topPeople[0] ? `관계축 핵심은 ${args.topPeople[0].name}` : "관계축 데이터 약함",
          args.topPlaces[0] ? `장소축 핵심은 ${args.topPlaces[0].name}` : "장소축 데이터 약함",
          args.topActivityTypes[0] ? `활동축 핵심은 ${args.topActivityTypes[0].name}` : "활동축 데이터 약함",
        ],
      },
    ],
    cards: [
      { label: "앞 구간", value: `${beforeCount}건` },
      { label: "뒤 구간", value: `${afterCount}건` },
      { label: "순흐름", value: formatWon(args.finance.net) },
      { label: "대표 변화축", value: args.topActivityTypes[0]?.name || "없음" },
    ],
    focusDescription: "비교 질문에서는 기간을 나눠 기록 밀도와 핵심 축이 어떻게 달라지는지 봅니다.",
    focusTitle: "기간 비교 분석",
    overview: "비교 질문은 현재 범위 안에서 앞 구간과 뒤 구간의 기록 밀도, 활동 축, 관계 축 차이를 읽는 방식으로 해석합니다.",
    patterns: [
      beforeCount !== afterCount ? `기록 밀도는 ${afterCount > beforeCount ? "뒤" : "앞"} 구간에 더 몰려 있습니다.` : "기록 밀도는 두 구간이 비슷합니다.",
      args.topPlaces[0] ? `${args.topPlaces[0].name} 같은 장소 축이 전체 비교에서 중심입니다.` : "장소 변화축은 아직 약합니다.",
      args.topPeople[0] ? `${args.topPeople[0].name} 같은 관계축이 비교의 기준점이 될 수 있습니다.` : "관계 변화축은 아직 약합니다.",
    ].filter(Boolean),
    suggestions: [
      "비교 질문은 '지난달 vs 이번달'처럼 기준 기간을 명시하면 훨씬 강해집니다.",
      "다음 단계에서는 비교 전용 차트/증감 카드로 확장하는 것이 좋습니다.",
    ],
  };
}

function buildActivityFocus(args: Parameters<typeof buildGeneralFocus>[0]) {
  return {
    breakdowns: [
      {
        title: "활동 흐름",
        items: [
          args.topActivityTypes[0] ? `가장 많은 활동은 ${args.topActivityTypes[0].name}` : "대표 활동 유형 없음",
          args.topPlaces[0] ? `대표 장소는 ${args.topPlaces[0].name}` : "대표 장소 없음",
          args.topPeople[0] ? `함께한 사람 중심은 ${args.topPeople[0].name}` : "사람 축은 아직 약함",
        ],
      },
      {
        title: "보조 맥락",
        items: [
          `사진 ${args.input.photos.length}장`,
          `하루기록 ${args.input.logs.length}건`,
          args.topExpenseCategories[0] ? `비용은 ${args.topExpenseCategories[0].name} 축이 큼` : "비용 축은 약함",
        ],
      },
    ],
    cards: [
      { label: "대표 활동", value: args.topActivityTypes[0]?.name || "없음", meta: args.topActivityTypes[0] ? `${args.topActivityTypes[0].count}회` : undefined },
      { label: "대표 장소", value: args.topPlaces[0]?.name || "없음" },
      { label: "대표 사람", value: args.topPeople[0]?.name || "없음" },
      { label: "사진", value: `${args.input.photos.length}장` },
    ],
    focusDescription: "활동 질문에서는 무엇을 했는지보다 어떤 축으로 반복됐는지 읽는 게 중요합니다.",
    focusTitle: "활동 패턴 분석",
    overview: `활동 질문 범위에서는 ${args.topActivityTypes[0]?.name || "특정 활동"} 중심 패턴이 가장 강하게 보이고, 장소와 관계 데이터가 그 의미를 보강합니다.`,
    patterns: [
      args.topActivityTypes[0] ? `${args.topActivityTypes[0].name} 활동이 가장 자주 반복됩니다.` : "대표 활동 패턴은 아직 분산됩니다.",
      args.topPlaces[0] ? `${args.topPlaces[0].name}이 활동의 중심 장소축입니다.` : "장소축은 아직 약합니다.",
      args.topPeople[0] ? `${args.topPeople[0].name}이 활동과 가장 자주 연결됩니다.` : "관계축은 아직 약합니다.",
    ].filter(Boolean),
    suggestions: [
      "활동 질문은 시간대·장소·함께한 사람을 같이 볼 때 해석 가치가 커집니다.",
      "다음 단계에서는 활동 세션 단위로 묶어 에피소드 분석을 붙이는 것이 좋습니다.",
    ],
  };
}

function buildGeneralFocus(args: {
  dateRange: string;
  finance: { expense: number; income: number; net: number };
  focus: AskFocus;
  focusEntity?: string;
  input: AskAnalysisInput;
  topActivityTypes: NamedCount[];
  topExpenseCategories: Array<{ amount: number; name: string }>;
  topPeople: NamedCount[];
  topPlaces: NamedCount[];
}) {
  return {
    breakdowns: [
      {
        title: "핵심 축",
        items: [
          args.topPeople[0] ? `사람 축은 ${args.topPeople[0].name}` : "사람 축 약함",
          args.topPlaces[0] ? `장소 축은 ${args.topPlaces[0].name}` : "장소 축 약함",
          args.topActivityTypes[0] ? `활동 축은 ${args.topActivityTypes[0].name}` : "활동 축 약함",
        ],
      },
      {
        title: "기록 밀도",
        items: [
          `검토 기록 ${args.input.scopedRecords.length}건`,
          `사진 ${args.input.photos.length}장`,
          `하루기록 ${args.input.logs.length}건`,
        ],
      },
    ],
    cards: [
      { label: "검토 기록", value: `${args.input.scopedRecords.length}건` },
      { label: "대표 사람", value: args.topPeople[0]?.name || "없음" },
      { label: "대표 장소", value: args.topPlaces[0]?.name || "없음" },
      { label: "순흐름", value: formatWon(args.finance.net) },
    ],
    focusDescription: "일반 질문에서는 사람·장소·활동·소비 중 무엇이 가장 강한 축인지 먼저 읽습니다.",
    focusTitle: "전체 흐름 분석",
    overview: `현재 질문 범위는 ${args.dateRange} 중심 기록을 바탕으로 사람·장소·활동·소비 축을 함께 읽는 기본 해석 단계입니다.`,
    patterns: [
      args.topPeople[0] ? `${args.topPeople[0].name}이 관계축 중심입니다.` : "관계축은 아직 옅습니다.",
      args.topPlaces[0] ? `${args.topPlaces[0].name}이 장소축 중심입니다.` : "장소축은 아직 옅습니다.",
      args.topActivityTypes[0] ? `${args.topActivityTypes[0].name}이 활동축 중심입니다.` : "활동축은 아직 옅습니다.",
    ].filter(Boolean),
    suggestions: [
      "질문에 사람·장소·기간을 더 구체적으로 넣으면 해석 깊이가 확 올라갑니다.",
      "다음 단계에서는 에피소드 단위로 묶어 더 놀라운 답변을 만들 수 있습니다.",
    ],
  };
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

function collectTopPeople(input: AskAnalysisInput) {
  return getTopValues([
    ...input.activities.flatMap((activity) => splitCompanions(activity.companions)),
    ...input.events.flatMap((event) => splitCompanions(event.companions)),
    ...input.tasks.flatMap((task) => splitCompanions(task.companions)),
  ]);
}

function collectTopPlaces(input: AskAnalysisInput) {
  return getTopValues([
    ...input.activities.map((activity) => activity.placeName).filter(Boolean),
    ...input.events.map((event) => event.place?.name).filter(Boolean),
    ...input.tasks.map((task) => task.place?.name).filter(Boolean),
  ] as string[]);
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

function pickQuestionEntity(question: string, candidates: string[]) {
  const normalizedQuestion = question.toLowerCase();
  const matched = candidates.find((candidate) => normalizedQuestion.includes(candidate.toLowerCase()));
  return matched;
}

function getDateRange(dates: string[]) {
  if (dates.length === 0) return "기록 없음";
  const sorted = [...dates].sort();
  return sorted[0] === sorted[sorted.length - 1] ? sorted[0] : `${sorted[0]} ~ ${sorted[sorted.length - 1]}`;
}
