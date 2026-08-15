import type { CalendarEvent } from "@/features/calendar/data";
import { formatWon } from "@/features/life/formatters";
import type { DailyLogRecord, ExpenseRecord, IncomeRecord, LifeActivityRecord, LifePhotoRecord, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

type AskFocus = "people" | "places" | "finance" | "health" | "activity" | "compare" | "general";

type AskRecord = {
  date: string;
  description: string;
  id: string;
  label: string;
  tags: string[];
  title: string;
  type: string;
};

type DateWindow = {
  end: string;
  label: string;
  start: string;
};

type NamedCount = {
  count: number;
  name: string;
};

type AskAnalysisInput = {
  activities: LifeActivityRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  incomes: IncomeRecord[];
  logs: DailyLogRecord[];
  photos: LifePhotoRecord[];
  question: string;
  scopedRecords: AskRecord[];
  tasks: TaskItem[];
  weights: WeightRecord[];
  workouts: WorkoutSession[];
};

type FocusAnalysisArgs = {
  comparison?: {
    current: WindowStats;
    label: string;
    previous: WindowStats;
  };
  dateRange: string;
  filtered: FilteredLifeData;
  focus: AskFocus;
  focusEntity?: string;
  topActivityTypes: NamedCount[];
  topExpenseCategories: Array<{ amount: number; name: string }>;
  topPeople: NamedCount[];
  topPlaces: NamedCount[];
  windowLabel: string;
};

type FilteredLifeData = {
  activities: LifeActivityRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  incomes: IncomeRecord[];
  logs: DailyLogRecord[];
  photos: LifePhotoRecord[];
  records: AskRecord[];
  tasks: TaskItem[];
  weights: WeightRecord[];
  workouts: WorkoutSession[];
};

type LifeAskFocusData = Pick<LifeAskAnalysis, "breakdowns" | "cards" | "focusDescription" | "focusTitle" | "overview" | "patterns" | "suggestions">;

type WindowStats = {
  activityCount: number;
  expense: number;
  income: number;
  photoCount: number;
  placeTop?: NamedCount;
  recordCount: number;
  workoutCount: number;
};

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

export type LifeAskLinkItem = {
  date: string;
  label: string;
  meta?: string;
};

export type LifeAskLinkGroup = {
  items: LifeAskLinkItem[];
  title: string;
};

export type LifeAskAnalysis = {
  breakdowns: LifeAskBreakdown[];
  cards: LifeAskInsightCard[];
  dateRange: string;
  evidence: LifeAskEvidenceItem[];
  followUpQuestions: string[];
  focus: AskFocus;
  focusDescription: string;
  focusTitle: string;
  linkGroups: LifeAskLinkGroup[];
  narrative: string;
  overview: string;
  patterns: string[];
  promptContext: string;
  suggestions: string[];
  windowLabel: string;
};

export function buildLifeAskAnalysis(input: AskAnalysisInput): LifeAskAnalysis {
  const focus = detectAskFocus(input.question);
  const detectedWindows = parseQuestionWindows(input.question);
  const effectiveWindow = pickPrimaryWindow(detectedWindows, input.scopedRecords.map((record) => record.date));
  const filtered = filterLifeDataByWindow(input, effectiveWindow);
  const topPeople = collectTopPeople(filtered).slice(0, 5);
  const topPlaces = collectTopPlaces(filtered).slice(0, 5);
  const topActivityTypes = getTopValues(filtered.activities.map((activity) => activity.category).filter(Boolean) as string[]).slice(0, 5);
  const topExpenseCategories = getTopExpenseCategories(filtered.expenses).slice(0, 5);
  const focusEntity =
    focus === "people"
      ? pickQuestionEntity(input.question, topPeople.map((item) => item.name))
      : focus === "places"
        ? pickQuestionEntity(input.question, topPlaces.map((item) => item.name))
        : undefined;
  const comparison = buildComparisonContext(input, detectedWindows, effectiveWindow);
  const focusData = buildFocusData({
    comparison,
    dateRange: `${effectiveWindow.start} ~ ${effectiveWindow.end}`,
    filtered,
    focus,
    focusEntity,
    topActivityTypes,
    topExpenseCategories,
    topPeople,
    topPlaces,
    windowLabel: effectiveWindow.label,
  });
  const narrative = buildAskNarrative({
    comparison,
    dateRange: `${effectiveWindow.start} ~ ${effectiveWindow.end}`,
    filtered,
    focus,
    focusEntity,
    topActivityTypes,
    topExpenseCategories,
    topPeople,
    topPlaces,
    windowLabel: effectiveWindow.label,
  });

  const evidence = filtered.records.slice(0, 8).map((record) => ({
    date: record.date,
    description: record.description || record.tags.join(" · ") || record.label,
    title: record.title,
  }));
  const linkGroups = buildAskLinkGroups(filtered, effectiveWindow, topPeople, topPlaces);
  const followUpQuestions = buildFollowUpQuestions(focus, effectiveWindow.label, topPeople, topPlaces, topActivityTypes, topExpenseCategories);

  const promptContext = [
    `질문 초점: ${focus}`,
    `해석 기간: ${effectiveWindow.label} (${effectiveWindow.start} ~ ${effectiveWindow.end})`,
    `핵심 제목: ${focusData.focusTitle}`,
    `핵심 요약: ${focusData.overview}`,
    `기간 서사: ${narrative}`,
    comparison
      ? `비교 기준: ${comparison.label} / 현재 ${comparison.current.recordCount}건 vs 이전 ${comparison.previous.recordCount}건`
      : "비교 기준: 단일 기간 해석",
    `카드: ${focusData.cards.map((card) => `${card.label}=${card.value}${card.meta ? `(${card.meta})` : ""}`).join(", ")}`,
    `패턴: ${focusData.patterns.join(" / ") || "패턴 부족"}`,
    `제안: ${focusData.suggestions.join(" / ") || "제안 없음"}`,
    `브레이크다운: ${focusData.breakdowns.map((section) => `${section.title}: ${section.items.join(" | ")}`).join(" || ")}`,
  ].join("\n");

  return {
    breakdowns: focusData.breakdowns,
    cards: focusData.cards,
    dateRange: `${effectiveWindow.start} ~ ${effectiveWindow.end}`,
    evidence,
    followUpQuestions,
    focus,
    focusDescription: focusData.focusDescription,
    focusTitle: focusData.focusTitle,
    linkGroups,
    narrative,
    overview: focusData.overview,
    patterns: focusData.patterns,
    promptContext,
    suggestions: focusData.suggestions,
    windowLabel: effectiveWindow.label,
  };
}

function buildFollowUpQuestions(
  focus: AskFocus,
  windowLabel: string,
  topPeople: NamedCount[],
  topPlaces: NamedCount[],
  topActivityTypes: NamedCount[],
  topExpenseCategories: Array<{ amount: number; name: string }>,
) {
  const questions = new Set<string>();
  questions.add(`${windowLabel}에 가장 두드러진 흐름 한 가지만 짚어줘`);

  if (topPeople[0]) questions.add(`${windowLabel}에 ${topPeople[0].name}와의 기록을 더 자세히 풀어줘`);
  if (topPlaces[0]) questions.add(`${windowLabel}에 ${topPlaces[0].name}이 왜 중요했는지 설명해줘`);
  if (topActivityTypes[0]) questions.add(`${windowLabel}에 ${topActivityTypes[0].name} 패턴이 왜 많았는지 정리해줘`);
  if (topExpenseCategories[0]) questions.add(`${windowLabel}에 ${topExpenseCategories[0].name} 지출이 커진 이유를 알려줘`);

  if (focus !== "compare") {
    questions.add(`${windowLabel}과 직전 기간을 비교하면 뭐가 가장 달라?`);
  }

  return [...questions].slice(0, 5);
}

function buildAskNarrative(args: FocusAnalysisArgs) {
  const recordCount = args.filtered.records.length;
  const activityCount = args.filtered.activities.length;
  const photoCount = args.filtered.photos.length;
  const logCount = args.filtered.logs.length;
  const expenseTotal = sumAmounts(args.filtered.expenses.map((item) => item.amount));
  const incomeTotal = sumAmounts(args.filtered.incomes.map((item) => item.amount));
  const net = incomeTotal - expenseTotal;
  const people = args.topPeople[0]?.name;
  const place = args.topPlaces[0]?.name;
  const activity = args.topActivityTypes[0]?.name;
  const density =
    recordCount >= 40 ? "기록 밀도가 높은 기간" :
    recordCount >= 16 ? "기록이 비교적 꾸준히 남은 기간" :
    "비교적 잔잔한 기간";
  const axis = [people ? `${people} 관계축` : null, place ? `${place} 장소축` : null, activity ? `${activity} 활동축` : null].filter(Boolean).join(", ");
  const memoryTone =
    photoCount + logCount > activityCount
      ? `사진과 기록 회고(${photoCount + logCount}건)가 활동 기록(${activityCount}건)과 비슷하거나 더 강하게 남아 있어요.`
      : `활동 기록(${activityCount}건)이 회고 기록(${photoCount + logCount}건)보다 앞서며 움직임이 더 또렷해요.`;
  const financeTone =
    net > 0 ? `자금 흐름은 ${formatWon(net)} 순유입이에요.` :
    net < 0 ? `자금 흐름은 ${formatWon(net)} 순지출이에요.` :
    "자금 흐름은 대체로 균형적이에요.";
  const compareTone = args.comparison
    ? `${args.comparison.label} 비교도 가능해서 변화 방향까지 읽을 수 있어요.`
    : "현재는 단일 기간 흐름에 집중한 해석이 적합해요.";

  return `${args.windowLabel}은(는) ${density}예요. ${axis ? `${axis}이(가) 중심으로 보이고, ` : ""}${memoryTone} ${financeTone} ${compareTone}`;
}

function buildFocusData(args: FocusAnalysisArgs): LifeAskFocusData {
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

function buildPeopleFocus(args: FocusAnalysisArgs): LifeAskFocusData {
  const personName = args.focusEntity || args.topPeople[0]?.name;
  const relatedActivities = args.filtered.activities.filter((activity) => splitCompanions(activity.companions).includes(personName ?? ""));
  const relatedEvents = args.filtered.events.filter((event) => splitCompanions(event.companions).includes(personName ?? ""));
  const relatedTasks = args.filtered.tasks.filter((task) => splitCompanions(task.companions).includes(personName ?? ""));
  const relatedPhotos = args.filtered.photos.filter((photo) => photo.linkedTargetTitle?.includes(personName ?? "") || (photo.caption ?? "").includes(personName ?? ""));
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
          personName ? `${personName} 관련 기록 ${relatedActivities.length + relatedEvents.length + relatedTasks.length}건` : "질문에서 특정 인물을 찾지 못함",
          places[0] ? `가장 자주 연결된 장소는 ${places[0].name}` : "장소 연결은 아직 옅음",
          activityTypes[0] ? `대표 활동은 ${activityTypes[0].name}` : "활동 유형은 아직 분산됨",
        ],
      },
      {
        title: "사진·근거",
        items: [
          `관련 사진 ${relatedPhotos.length}장`,
          relatedActivities[0]?.memo ? `최근 메모 맥락: ${relatedActivities[0].memo}` : "활동 메모는 아직 적음",
          args.comparison ? `${args.comparison.label} 비교가 가능함` : "현재는 단일 기간 해석",
        ],
      },
    ],
    cards: [
      { label: "핵심 인물", value: personName || "없음" },
      { label: "관련 기록", value: `${relatedActivities.length + relatedEvents.length + relatedTasks.length}건` },
      { label: "관련 사진", value: `${relatedPhotos.length}장` },
      { label: "대표 장소", value: places[0]?.name || "없음", meta: places[0] ? `${places[0].count}회` : undefined },
    ],
    focusDescription: "사람 질문에서는 누구와의 관계가 어떤 장소와 활동 패턴으로 쌓이는지 해석합니다.",
    focusTitle: personName ? `${personName} 관계 분석` : "관계 분석",
    overview: personName
      ? `${personName}와의 기록은 ${args.windowLabel} 안에서 장소와 활동 유형이 함께 묶여 보여, 관계의 성격을 읽기 좋은 상태입니다.`
      : "관계 질문이지만 특정 인물이 선명하지 않아 전체 관계축 중심으로 해석합니다.",
    patterns: [
      personName ? `${personName}와의 만남은 특정 장소·활동 패턴으로 수렴하는 경향이 있습니다.` : "관계 데이터가 여러 인물에게 분산되어 있습니다.",
      places[0] ? `${places[0].name}이 관계의 대표 배경 장소로 보입니다.` : "대표 장소가 아직 강하게 드러나지 않습니다.",
      activityTypes[0] ? `${activityTypes[0].name} 맥락에서 관계 기록이 가장 많이 남습니다.` : "활동 유형은 아직 다양하게 분산됩니다.",
    ].filter(Boolean),
    suggestions: [
      personName ? `${personName} 관련 기록은 장소·사진·지출까지 같이 보면 더 입체적인 관계 분석이 가능합니다.` : "질문에 사람 이름을 직접 넣으면 더 강한 관계 분석이 가능합니다.",
      args.comparison ? "같은 인물을 다른 기간과 비교하면 관계 변화까지 읽을 수 있습니다." : "함께한 사람 입력이 꾸준할수록 관계 분석 품질이 크게 올라갑니다.",
    ],
  };
}

function buildPlacesFocus(args: FocusAnalysisArgs): LifeAskFocusData {
  const placeName = args.focusEntity || args.topPlaces[0]?.name;
  const relatedActivities = args.filtered.activities.filter((activity) => activity.placeName === placeName);
  const relatedEvents = args.filtered.events.filter((event) => event.place?.name === placeName);
  const relatedTasks = args.filtered.tasks.filter((task) => task.place?.name === placeName);
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
          placeName ? `${placeName} 관련 기록 ${relatedActivities.length + relatedEvents.length + relatedTasks.length}건` : "질문에서 특정 장소를 찾지 못함",
          relatedActivityTypes[0] ? `대표 활동은 ${relatedActivityTypes[0].name}` : "활동 유형은 아직 분산됨",
          relatedPeople[0] ? `가장 자주 연결된 사람은 ${relatedPeople[0].name}` : "특정 사람 축은 아직 옅음",
        ],
      },
      {
        title: "방문 맥락",
        items: [
          args.topExpenseCategories[0] ? `지출은 ${args.topExpenseCategories[0].name} 카테고리 영향이 큼` : "지출 카테고리 데이터 부족",
          args.filtered.photos.filter((photo) => photo.linkedTargetTitle?.includes(placeName ?? "")).length > 0 ? "사진까지 함께 남는 장소" : "사진 연결은 아직 적음",
          args.comparison ? `${args.comparison.label} 비교로 장소 변화도 읽을 수 있음` : "현재는 단일 기간 해석",
        ],
      },
    ],
    cards: [
      { label: "대표 장소", value: placeName || "없음" },
      { label: "관련 기록", value: `${relatedActivities.length + relatedEvents.length + relatedTasks.length}건` },
      { label: "대표 사람", value: relatedPeople[0]?.name || "없음" },
      { label: "대표 활동", value: relatedActivityTypes[0]?.name || "없음" },
    ],
    focusDescription: "장소 질문에서는 방문 횟수보다 그 장소가 어떤 사람·활동·소비와 묶이는지 읽습니다.",
    focusTitle: placeName ? `${placeName} 장소 분석` : "장소 분석",
    overview: placeName
      ? `${placeName}은(는) ${args.windowLabel} 안에서 특정 활동과 사람 맥락이 반복되는 생활 축인지 확인하는 것이 핵심입니다.`
      : "장소 질문이지만 특정 장소가 선명하지 않아 전체 장소축 중심으로 해석합니다.",
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

function buildFinanceFocus(args: FocusAnalysisArgs): LifeAskFocusData {
  const expensiveDays = getTopValues(args.filtered.expenses.map((expense) => expense.date)).slice(0, 3);

  return {
    breakdowns: [
      {
        title: "자금 흐름",
        items: [
          `총 수입 ${formatWon(sumAmounts(args.filtered.incomes.map((item) => item.amount)))}`,
          `총 지출 ${formatWon(sumAmounts(args.filtered.expenses.map((item) => item.amount)))}`,
          `순흐름 ${formatWon(sumAmounts(args.filtered.incomes.map((item) => item.amount)) - sumAmounts(args.filtered.expenses.map((item) => item.amount)))}`,
        ],
      },
      {
        title: "지출 집중",
        items: [
          args.topExpenseCategories[0] ? `가장 큰 지출 카테고리는 ${args.topExpenseCategories[0].name}` : "지출 카테고리 데이터 부족",
          expensiveDays[0] ? `가장 기록이 몰린 날짜는 ${expensiveDays[0].name}` : "날짜 집중도는 아직 약함",
          args.topPlaces[0] ? `대표 장소축은 ${args.topPlaces[0].name}` : "장소축은 아직 약함",
        ],
      },
    ],
    cards: [
      { label: "총 수입", value: formatWon(sumAmounts(args.filtered.incomes.map((item) => item.amount))) },
      { label: "총 지출", value: formatWon(sumAmounts(args.filtered.expenses.map((item) => item.amount))) },
      { label: "순흐름", value: formatWon(sumAmounts(args.filtered.incomes.map((item) => item.amount)) - sumAmounts(args.filtered.expenses.map((item) => item.amount))) },
      { label: "주요 카테고리", value: args.topExpenseCategories[0]?.name || "없음" },
    ],
    focusDescription: "소비 질문에서는 금액 합계보다 어떤 활동·장소·사람과 연결된 비용인지 읽는 게 중요합니다.",
    focusTitle: "자금 흐름 분석",
    overview: `현재 기간(${args.windowLabel})의 자금 흐름은 ${sumAmounts(args.filtered.incomes.map((item) => item.amount)) - sumAmounts(args.filtered.expenses.map((item) => item.amount)) >= 0 ? "순유입" : "순지출"} 상태이며, 소비 맥락 분해가 중요합니다.`,
    patterns: [
      args.topExpenseCategories[0] ? `${args.topExpenseCategories[0].name} 카테고리 비중이 가장 큽니다.` : "대표 지출 카테고리가 아직 분명하지 않습니다.",
      args.topPlaces[0] ? `${args.topPlaces[0].name} 같은 장소 축과 소비가 함께 움직일 수 있습니다.` : "지출과 장소의 연결은 아직 약합니다.",
      args.comparison ? `${args.comparison.label} 비교가 가능해 소비 증감 방향을 더 읽을 수 있습니다.` : "현재는 단일 기간 소비 흐름입니다.",
    ].filter(Boolean),
    suggestions: [
      "지출을 사람·장소·활동 기준으로 다시 묶으면 소비 패턴이 훨씬 선명해집니다.",
      args.comparison ? "비교 질문에서는 카테고리별 증감을 같이 보면 더 강합니다." : "비교 기준을 명시하면 소비 변화 해석이 더 강해집니다.",
    ],
  };
}

function buildHealthFocus(args: FocusAnalysisArgs): LifeAskFocusData {
  const latestWeight = args.filtered.weights[0];
  const oldestWeight = args.filtered.weights[args.filtered.weights.length - 1];
  const weightDiff = latestWeight && oldestWeight ? latestWeight.weightKg - oldestWeight.weightKg : undefined;
  const totalWorkoutMinutes = args.filtered.workouts.reduce((sum, workout) => sum + workout.durationMinutes, 0);

  return {
    breakdowns: [
      {
        title: "건강 흐름",
        items: [
          `운동 ${args.filtered.workouts.length}회`,
          `총 운동 시간 ${totalWorkoutMinutes}분`,
          latestWeight ? `최근 몸무게 ${latestWeight.weightKg}kg` : "몸무게 기록 없음",
        ],
      },
      {
        title: "생활 연결",
        items: [
          args.topActivityTypes[0] ? `대표 활동은 ${args.topActivityTypes[0].name}` : "활동 유형 분산",
          args.topPlaces[0] ? `주요 장소는 ${args.topPlaces[0].name}` : "장소 흐름 약함",
          typeof weightDiff === "number" ? `몸무게 변화 ${weightDiff > 0 ? "+" : ""}${weightDiff.toFixed(1)}kg` : "몸무게 변화 계산 어려움",
        ],
      },
    ],
    cards: [
      { label: "운동", value: `${args.filtered.workouts.length}회` },
      { label: "총 운동 시간", value: `${totalWorkoutMinutes}분` },
      { label: "최근 몸무게", value: latestWeight ? `${latestWeight.weightKg}kg` : "없음" },
      { label: "몸무게 변화", value: typeof weightDiff === "number" ? `${weightDiff > 0 ? "+" : ""}${weightDiff.toFixed(1)}kg` : "알 수 없음" },
    ],
    focusDescription: "건강 질문에서는 운동·몸무게 자체보다 다른 생활 기록과의 동반 흐름을 봐야 합니다.",
    focusTitle: "건강 흐름 분석",
    overview: `건강 데이터는 ${args.windowLabel} 기준으로 ${args.filtered.workouts.length > 0 || args.filtered.weights.length > 0 ? "해석 가능한 수준" : "초기 수준"}이며, 생활 맥락과 함께 읽어야 가치가 커집니다.`,
    patterns: [
      args.filtered.workouts.length > 0 ? "운동 기록이 존재해 생활 패턴과의 상관을 읽을 수 있습니다." : "운동 기록이 적어 건강 해석 폭이 좁습니다.",
      latestWeight ? "몸무게 기록이 있어 건강 흐름을 시계열로 볼 수 있습니다." : "몸무게 기록이 아직 충분하지 않습니다.",
      args.comparison ? `${args.comparison.label} 비교로 건강 변화 방향도 볼 수 있습니다.` : "현재는 단일 기간 해석입니다.",
    ].filter(Boolean),
    suggestions: [
      "건강 해석 품질을 높이려면 운동·몸무게와 함께 수면/컨디션 기록도 쌓이면 좋습니다.",
      "건강 질문은 날짜 범위를 좁히거나 비교 기준을 주면 훨씬 선명해집니다.",
    ],
  };
}

function buildCompareFocus(args: FocusAnalysisArgs): LifeAskFocusData {
  if (!args.comparison) {
    return {
      breakdowns: [
        {
          title: "비교 준비",
          items: ["질문에서 두 기간을 명확히 읽지 못했습니다.", "예: 지난달과 이번달 비교해줘", "예: 7월과 8월의 차이 알려줘"],
        },
      ],
      cards: [
        { label: "비교 상태", value: "기간 부족" },
        { label: "검토 기록", value: `${args.filtered.records.length}건` },
      ],
      focusDescription: "비교 질문은 두 개 이상의 기간이 필요합니다.",
      focusTitle: "기간 비교 분석",
      overview: "비교 질문이지만 현재는 비교할 기간이 선명하지 않아 단일 기록 흐름만 읽을 수 있습니다.",
      patterns: ["비교를 위해서는 기간 표현이 더 구체적이어야 합니다."],
      suggestions: ["예: 지난달과 이번달 비교해줘", "예: 2026년 7월과 2026년 8월의 차이 알려줘"],
    };
  }

  const { current, label, previous } = args.comparison;
  const recordDiff = current.recordCount - previous.recordCount;
  const financeDiff = (current.income - current.expense) - (previous.income - previous.expense);

  return {
    breakdowns: [
      {
        title: "기록 밀도 비교",
        items: [
          `현재 기간 ${current.recordCount}건`,
          `비교 기간 ${previous.recordCount}건`,
          `차이 ${recordDiff > 0 ? "+" : ""}${recordDiff}건`,
        ],
      },
      {
        title: "변화 포인트",
        items: [
          `활동 수 ${current.activityCount} vs ${previous.activityCount}`,
          `사진 수 ${current.photoCount} vs ${previous.photoCount}`,
          `순흐름 차이 ${formatWon(financeDiff)}`,
        ],
      },
    ],
    cards: [
      { label: "현재 기간", value: `${current.recordCount}건`, meta: label },
      { label: "비교 기간", value: `${previous.recordCount}건` },
      { label: "활동 증감", value: `${current.activityCount - previous.activityCount > 0 ? "+" : ""}${current.activityCount - previous.activityCount}건` },
      { label: "순흐름 차이", value: formatWon(financeDiff) },
    ],
    focusDescription: "비교 질문에서는 두 기간의 기록 밀도, 활동량, 사진량, 자금 흐름 차이를 읽습니다.",
    focusTitle: "기간 비교 분석",
    overview: `${label} 비교 기준으로 보면 기록 밀도와 활동량, 자금 흐름 차이 중 무엇이 가장 크게 달라졌는지가 핵심입니다.`,
    patterns: [
      recordDiff !== 0 ? `기록 밀도는 ${recordDiff > 0 ? "현재 기간" : "비교 기간"}이 더 높습니다.` : "기록 밀도는 두 기간이 비슷합니다.",
      current.photoCount !== previous.photoCount ? `사진량 차이는 ${current.photoCount > previous.photoCount ? "현재 기간" : "비교 기간"}이 더 큽니다.` : "사진량은 두 기간이 비슷합니다.",
      financeDiff !== 0 ? `자금 흐름은 ${financeDiff > 0 ? "현재 기간이 더 긍정적" : "비교 기간이 더 긍정적"}입니다.` : "자금 흐름은 큰 차이가 없습니다.",
    ],
    suggestions: [
      "비교 질문은 기준이 명확할수록 해석 품질이 크게 올라갑니다.",
      "다음 단계에서는 카테고리별 증감과 장소/사람 축 변화까지 붙이면 더 강해집니다.",
    ],
  };
}

function buildActivityFocus(args: FocusAnalysisArgs): LifeAskFocusData {
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
          `사진 ${args.filtered.photos.length}장`,
          `하루기록 ${args.filtered.logs.length}건`,
          args.topExpenseCategories[0] ? `비용은 ${args.topExpenseCategories[0].name} 축이 큼` : "비용 축은 약함",
        ],
      },
    ],
    cards: [
      { label: "대표 활동", value: args.topActivityTypes[0]?.name || "없음", meta: args.topActivityTypes[0] ? `${args.topActivityTypes[0].count}회` : undefined },
      { label: "대표 장소", value: args.topPlaces[0]?.name || "없음" },
      { label: "대표 사람", value: args.topPeople[0]?.name || "없음" },
      { label: "사진", value: `${args.filtered.photos.length}장` },
    ],
    focusDescription: "활동 질문에서는 무엇을 했는지보다 어떤 축으로 반복됐는지 읽는 것이 중요합니다.",
    focusTitle: "활동 패턴 분석",
    overview: `${args.windowLabel} 기준으로 ${args.topActivityTypes[0]?.name || "특정 활동"} 중심 패턴이 가장 강하게 보이며, 장소와 관계 데이터가 의미를 보강합니다.`,
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

function buildGeneralFocus(args: FocusAnalysisArgs): LifeAskFocusData {
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
          `검토 기록 ${args.filtered.records.length}건`,
          `사진 ${args.filtered.photos.length}장`,
          `하루기록 ${args.filtered.logs.length}건`,
        ],
      },
    ],
    cards: [
      { label: "검토 기록", value: `${args.filtered.records.length}건` },
      { label: "대표 사람", value: args.topPeople[0]?.name || "없음" },
      { label: "대표 장소", value: args.topPlaces[0]?.name || "없음" },
      { label: "순흐름", value: formatWon(sumAmounts(args.filtered.incomes.map((item) => item.amount)) - sumAmounts(args.filtered.expenses.map((item) => item.amount))) },
    ],
    focusDescription: "일반 질문에서는 사람·장소·활동·소비 중 무엇이 가장 강한 축인지 먼저 읽습니다.",
    focusTitle: "전체 흐름 분석",
    overview: `${args.windowLabel} 기준 기록을 바탕으로 사람·장소·활동·소비 축을 함께 읽는 기본 해석 단계입니다.`,
    patterns: [
      args.topPeople[0] ? `${args.topPeople[0].name}이 관계축 중심입니다.` : "관계축은 아직 옅습니다.",
      args.topPlaces[0] ? `${args.topPlaces[0].name}이 장소축 중심입니다.` : "장소축은 아직 옅습니다.",
      args.topActivityTypes[0] ? `${args.topActivityTypes[0].name}이 활동축 중심입니다.` : "활동축은 아직 옅습니다.",
    ].filter(Boolean),
    suggestions: [
      "질문에 사람·장소·기간을 더 구체적으로 넣으면 해석 깊이가 크게 올라갑니다.",
      args.comparison ? "비교 포인트를 더 구체화하면 변화 해석이 더 강해집니다." : "비교 기준을 함께 주면 더 강한 해석이 가능합니다.",
    ],
  };
}

function buildComparisonContext(input: AskAnalysisInput, detectedWindows: DateWindow[], effectiveWindow: DateWindow) {
  const explicitComparison = detectedWindows.length >= 2 ? detectedWindows.slice(0, 2) : undefined;
  if (explicitComparison) {
    const [currentWindow, previousWindow] = explicitComparison;
    return {
      current: buildWindowStats(filterLifeDataByWindow(input, currentWindow)),
      label: `${previousWindow.label} vs ${currentWindow.label}`,
      previous: buildWindowStats(filterLifeDataByWindow(input, previousWindow)),
    };
  }

  if (detectAskFocus(input.question) !== "compare") return undefined;

  const inferredPreviousWindow = buildPreviousWindow(effectiveWindow);
  return {
    current: buildWindowStats(filterLifeDataByWindow(input, effectiveWindow)),
    label: `${inferredPreviousWindow.label} vs ${effectiveWindow.label}`,
    previous: buildWindowStats(filterLifeDataByWindow(input, inferredPreviousWindow)),
  };
}

function buildWindowStats(filtered: FilteredLifeData): WindowStats {
  return {
    activityCount: filtered.activities.length,
    expense: sumAmounts(filtered.expenses.map((item) => item.amount)),
    income: sumAmounts(filtered.incomes.map((item) => item.amount)),
    photoCount: filtered.photos.length,
    placeTop: collectTopPlaces(filtered)[0],
    recordCount: filtered.records.length,
    workoutCount: filtered.workouts.length,
  };
}

function filterLifeDataByWindow(input: AskAnalysisInput, window: DateWindow): FilteredLifeData {
  return {
    activities: input.activities.filter((item) => item.date >= window.start && item.date <= window.end),
    events: input.events.filter((item) => item.date <= window.end && (item.endDate ?? item.date) >= window.start),
    expenses: input.expenses.filter((item) => item.date >= window.start && item.date <= window.end),
    incomes: input.incomes.filter((item) => item.date >= window.start && item.date <= window.end),
    logs: input.logs.filter((item) => item.date >= window.start && item.date <= window.end),
    photos: input.photos.filter((item) => item.date >= window.start && item.date <= window.end),
    records: input.scopedRecords.filter((item) => item.date >= window.start && item.date <= window.end),
    tasks: input.tasks.filter((item) => item.scheduledDate <= window.end && (item.dueDate ?? item.scheduledDate) >= window.start),
    weights: input.weights.filter((item) => item.date >= window.start && item.date <= window.end),
    workouts: input.workouts.filter((item) => item.date >= window.start && item.date <= window.end),
  };
}

function parseQuestionWindows(question: string) {
  const normalized = question.toLowerCase();
  const windows: DateWindow[] = [];
  const today = getTodayDate();

  if (containsAny(normalized, ["이번달", "이번 달"])) {
    windows.push(createMonthWindow(today.getFullYear(), today.getMonth(), "이번달"));
  }
  if (containsAny(normalized, ["지난달", "지난 달"])) {
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    windows.push(createMonthWindow(previousMonth.getFullYear(), previousMonth.getMonth(), "지난달"));
  }
  if (containsAny(normalized, ["이번주", "이번 주"])) {
    windows.push(createWeekWindow(today, "이번주"));
  }
  if (containsAny(normalized, ["지난주", "지난 주"])) {
    const previousWeekDate = new Date(today);
    previousWeekDate.setDate(previousWeekDate.getDate() - 7);
    windows.push(createWeekWindow(previousWeekDate, "지난주"));
  }

  for (const match of normalized.matchAll(/최근\s*(\d+)\s*(일|주|개월|달)/g)) {
    const amount = Number(match[1]);
    const unit = match[2];
    if (!Number.isFinite(amount) || amount <= 0) continue;
    windows.push(createRelativeWindow(today, amount, unit));
  }

  const explicitMonths = [...normalized.matchAll(/(20\d{2})\s*년\s*(1[0-2]|0?[1-9])\s*월/g)];
  explicitMonths.forEach((match) => {
    windows.push(createMonthWindow(Number(match[1]), Number(match[2]) - 1, `${match[1]}년 ${Number(match[2])}월`));
  });

  const monthOnlyMatches = [...normalized.matchAll(/(?:^|\s)(1[0-2]|0?[1-9])\s*월/g)];
  monthOnlyMatches.forEach((match) => {
    windows.push(createMonthWindow(today.getFullYear(), Number(match[1]) - 1, `${Number(match[1])}월`));
  });

  const explicitDates = [...normalized.matchAll(/(20\d{2})[.\-/년\s]+(1[0-2]|0?[1-9])[.\-/월\s]+([12]\d|3[01]|0?[1-9])\s*일?/g)];
  explicitDates.forEach((match) => {
    const start = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
    windows.push({ end: start, label: start, start });
  });

  return dedupeWindows(windows);
}

function pickPrimaryWindow(windows: DateWindow[], recordDates: string[]) {
  if (windows.length > 0) return windows[0];
  const range = getDateRangeBounds(recordDates);
  return {
    end: range.end,
    label: "질문 관련 기간",
    start: range.start,
  };
}

function buildPreviousWindow(window: DateWindow): DateWindow {
  const start = parseDate(window.start);
  const end = parseDate(window.end);
  const spanDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const previousEnd = new Date(start);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - spanDays + 1);

  return {
    end: formatDateKey(previousEnd),
    label: `${window.label} 이전 구간`,
    start: formatDateKey(previousStart),
  };
}

function createMonthWindow(year: number, monthIndex: number, label: string): DateWindow {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return {
    end: formatDateKey(end),
    label,
    start: formatDateKey(start),
  };
}

function createWeekWindow(date: Date, label: string): DateWindow {
  const start = new Date(date);
  const weekday = start.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(start.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    end: formatDateKey(end),
    label,
    start: formatDateKey(start),
  };
}

function createRelativeWindow(today: Date, amount: number, unit: string): DateWindow {
  const end = new Date(today);
  const start = new Date(today);

  if (unit === "일") {
    start.setDate(start.getDate() - amount + 1);
    return { end: formatDateKey(end), label: `최근 ${amount}일`, start: formatDateKey(start) };
  }

  if (unit === "주") {
    start.setDate(start.getDate() - amount * 7 + 1);
    return { end: formatDateKey(end), label: `최근 ${amount}주`, start: formatDateKey(start) };
  }

  start.setMonth(start.getMonth() - amount);
  start.setDate(1);
  return { end: formatDateKey(end), label: `최근 ${amount}${unit}`, start: formatDateKey(start) };
}

function dedupeWindows(windows: DateWindow[]) {
  const unique = new Map<string, DateWindow>();
  windows.forEach((window) => unique.set(`${window.start}:${window.end}:${window.label}`, window));
  return [...unique.values()];
}

function detectAskFocus(question: string): AskFocus {
  const normalized = question.toLowerCase();
  if (containsAny(normalized, ["비교", "전보다", "대비", "차이", "vs"])) return "compare";
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

function collectTopPeople(input: Pick<FilteredLifeData, "activities" | "events" | "tasks"> | AskAnalysisInput) {
  return getTopValues([
    ...input.activities.flatMap((activity) => splitCompanions(activity.companions)),
    ...input.events.flatMap((event) => splitCompanions(event.companions)),
    ...input.tasks.flatMap((task) => splitCompanions(task.companions)),
  ]);
}

function collectTopPlaces(input: Pick<FilteredLifeData, "activities" | "events" | "tasks"> | AskAnalysisInput) {
  return getTopValues([
    ...input.activities.map((activity) => activity.placeName).filter(Boolean),
    ...input.events.map((event) => event.place?.name).filter(Boolean),
    ...input.tasks.map((task) => task.place?.name).filter(Boolean),
  ] as string[]);
}

function buildAskLinkGroups(
  filtered: FilteredLifeData,
  effectiveWindow: DateWindow,
  topPeople: NamedCount[],
  topPlaces: NamedCount[],
): LifeAskLinkGroup[] {
  const recordGroups = new Map<string, AskRecord[]>();
  filtered.records.forEach((record) => {
    const list = recordGroups.get(record.date) ?? [];
    list.push(record);
    recordGroups.set(record.date, list);
  });

  const periodItems = Array.from(recordGroups.entries())
    .sort(([leftDate], [rightDate]) => rightDate.localeCompare(leftDate))
    .slice(0, 3)
    .map(([date, records]) => ({
      date,
      label: `${date} 기록 보기`,
      meta: `${records.length}건`,
    }));

  const peopleItems = topPeople
    .map((person) => findPersonAnchorDate(person.name, filtered))
    .filter((item): item is LifeAskLinkItem => Boolean(item))
    .slice(0, 3);

  const placeItems = topPlaces
    .map((place) => findPlaceAnchorDate(place.name, filtered))
    .filter((item): item is LifeAskLinkItem => Boolean(item))
    .slice(0, 3);

  const evidenceItems = filtered.records.slice(0, 3).map((record) => ({
    date: record.date,
    label: record.title,
    meta: record.description || record.label,
  }));

  return [
    {
      title: "기간 바로가기",
      items:
        periodItems.length > 0
          ? periodItems
          : [
              {
                date: effectiveWindow.start,
                label: effectiveWindow.label,
                meta: `${effectiveWindow.start} ~ ${effectiveWindow.end}`,
              },
            ],
    },
    ...(peopleItems.length > 0 ? [{ title: "사람 기준", items: peopleItems }] : []),
    ...(placeItems.length > 0 ? [{ title: "장소 기준", items: placeItems }] : []),
    ...(evidenceItems.length > 0 ? [{ title: "기록 근거", items: evidenceItems }] : []),
  ];
}

function findPersonAnchorDate(name: string, filtered: FilteredLifeData): LifeAskLinkItem | null {
  const activity = filtered.activities.find((item) => splitCompanions(item.companions).includes(name));
  if (activity) {
    return {
      date: activity.date,
      label: name,
      meta: activity.title || activity.category || "활동 기록",
    };
  }

  const event = filtered.events.find((item) => splitCompanions(item.companions).includes(name));
  if (event) {
    return {
      date: event.date,
      label: name,
      meta: event.title || "이벤트 기록",
    };
  }

  const task = filtered.tasks.find((item) => splitCompanions(item.companions).includes(name));
  if (task) {
    return {
      date: task.scheduledDate,
      label: name,
      meta: task.title || "할 일 기록",
    };
  }

  return null;
}

function findPlaceAnchorDate(name: string, filtered: FilteredLifeData): LifeAskLinkItem | null {
  const activity = filtered.activities.find((item) => item.placeName === name);
  if (activity) {
    return {
      date: activity.date,
      label: name,
      meta: activity.title || activity.category || "활동 기록",
    };
  }

  const event = filtered.events.find((item) => item.place?.name === name);
  if (event) {
    return {
      date: event.date,
      label: name,
      meta: event.title || "이벤트 기록",
    };
  }

  const task = filtered.tasks.find((item) => item.place?.name === name);
  if (task) {
    return {
      date: task.scheduledDate,
      label: name,
      meta: task.title || "할 일 기록",
    };
  }

  return null;
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
  return candidates.find((candidate) => normalizedQuestion.includes(candidate.toLowerCase()));
}

function getDateRangeBounds(dates: string[]) {
  if (dates.length === 0) {
    const today = formatDateKey(getTodayDate());
    return { end: today, start: today };
  }

  const sorted = [...dates].sort();
  return { end: sorted[sorted.length - 1], start: sorted[0] };
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

function getTodayDate() {
  return new Date();
}

function sumAmounts(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0);
}
