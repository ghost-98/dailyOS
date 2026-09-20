import type { CalendarEvent } from "@/features/calendar/data";
import { formatRunDuration, formatWeightMeasurementMeta, formatWon, getLinkedTargetTypeLabel } from "@/features/records/format/recordFormatters";
import { getActivityPlaceRef } from "@/features/records/place/recordPlaces";
import { formatActivityTime } from "@/features/records/format/recordFormatters";
import type { RecordPlaceRef } from "@/features/records/place/recordPlaces";
import type { DailyLogRecord, ExpenseRecord, IncomeRecord, LifeActivityRecord, LifePhotoRecord, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";
import { createRecordFocusId } from "@/features/records/navigation/recordDeepLink";

export type RecordContextBundle = {
  date: string;
  expenses: ExpenseRecord[];
  key: string;
  label: string;
  logs: DailyLogRecord[];
  meta?: string;
  photos: LifePhotoRecord[];
  place?: RecordPlaceRef;
  targetId: string;
  targetType: "todo" | "event" | "activity";
  title: string;
};


export type RecordSearchItem = {
  date: string;
  description: string;
  facts?: RecordSearchFact[];
  focusId?: string;
  id: string;
  label: string;
  tags: string[];
  title: string;
  type: "todo" | "event" | "activity" | "expense" | "income" | "daily_log" | "photo" | "workout" | "weight";
};

export type RecordSearchFactKind = "food" | "memo" | "money" | "people" | "photo" | "place" | "status" | "tag" | "time" | "workout";

export type RecordSearchFact = {
  kind: RecordSearchFactKind;
  text: string;
};

const LIFE_ASK_RECORD_LIMIT = 220;

type PersonSummary = {
  expenseTotal: number;
  expenses: ExpenseRecord[];
  items: RecordSearchItem[];
  logs: DailyLogRecord[];
  name: string;
  photos: LifePhotoRecord[];
  places: string[];
};

export function buildRecordContextBundles(
  date: string,
  events: CalendarEvent[],
  tasks: TaskItem[],
  activities: LifeActivityRecord[],
  expenses: ExpenseRecord[],
  logs: DailyLogRecord[],
  photos: LifePhotoRecord[],
): RecordContextBundle[] {
  const eventBundles = events
    .filter((event) => event.type === "event")
    .map((event) => {
      const targetType = "event";
      return {
        expenses: expenses.filter((expense) => expense.targetType === targetType && expense.targetId === event.id),
        date,
        key: `${targetType}:${event.id}`,
        label: getPhotoTargetTypeLabel(targetType),
        logs: logs.filter((log) => log.linkedTargetType === targetType && log.linkedTargetId === event.id),
        meta: formatRecordContextMeta(date, event.date, event.endDate, event.time, event.endTime, event.isAllDay, event.companions),
        photos: photos.filter((photo) => photo.linkedTargetType === targetType && photo.linkedTargetId === event.id),
        place: event.place,
        targetId: event.id,
        targetType,
        title: event.title,
      } satisfies RecordContextBundle;
    });

  const taskBundles = tasks.map((task) => ({
    date,
    expenses: expenses.filter((expense) => expense.targetType === "todo" && expense.targetId === task.id),
    key: `todo:${task.id}`,
    label: "할일",
    logs: logs.filter((log) => log.linkedTargetType === "todo" && log.linkedTargetId === task.id),
    meta: formatRecordContextMeta(date, task.scheduledDate, task.dueDate, task.startTime, task.endTime, task.isAllDay, task.companions),
    photos: photos.filter((photo) => photo.linkedTargetType === "todo" && photo.linkedTargetId === task.id),
    place: task.place,
    targetId: task.id,
    targetType: "todo" as const,
    title: task.title,
  }));

  const activityBundles = activities.map((activity) => ({
    date,
    expenses: expenses.filter((expense) => expense.targetType === "activity" && expense.targetId === activity.id),
    key: `activity:${activity.id}`,
    label: "활동",
    logs: logs.filter((log) => log.linkedTargetType === "activity" && log.linkedTargetId === activity.id),
    meta: [formatActivityTime(activity), activity.category, activity.companions ? `함께한 사람 · ${activity.companions}` : null, activity.food ? `음식 · ${activity.food}` : null].filter(Boolean).join(" · "),
    photos: photos.filter((photo) => photo.linkedTargetType === "activity" && photo.linkedTargetId === activity.id),
    place: getActivityPlaceRef(activity) ?? undefined,
    targetId: activity.id,
    targetType: "activity" as const,
    title: activity.title,
  }));

  return [...eventBundles, ...taskBundles, ...activityBundles].sort((a, b) => getContextScore(b) - getContextScore(a));
}

function getContextScore(bundle: RecordContextBundle) {
  return bundle.expenses.length + bundle.logs.length + bundle.photos.length + (bundle.place ? 1 : 0);
}

export function formatRecordContextMeta(date: string, startDate: string, endDate?: string, startTime?: string, endTime?: string, isAllDay = true, companions?: string) {
  const range = endDate && endDate !== startDate ? `${startDate}~${endDate}` : date;
  const time = isAllDay ? "하루종일" : endTime ? `${startTime ?? "시간 미정"}-${endTime}` : startTime ?? "시간 미정";
  return [range, time, companions ? `함께한 사람 · ${companions}` : null].filter(Boolean).join(" · ");
}

export function parseCompanions(value?: string) {
  return (value ?? "")
    .split(/[,，、·]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getTopCounts(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .map(([name, count]) => ({ count, name }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function getTopExpenseCategories(expenses: ExpenseRecord[]) {
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
    .sort((a, b) => b.amount - a.amount);
}

export function buildRecordPeopleSummaries(events: CalendarEvent[], tasks: TaskItem[], activities: LifeActivityRecord[], expenses: ExpenseRecord[], logs: DailyLogRecord[], photos: LifePhotoRecord[]) {
  const people = new Map<string, PersonSummary>();

  const ensurePerson = (name: string) => {
    const current = people.get(name);
    if (current) return current;
    const nextPerson: PersonSummary = { expenseTotal: 0, expenses: [], items: [], logs: [], name, photos: [], places: [] };
    people.set(name, nextPerson);
    return nextPerson;
  };

  for (const event of events.filter((item) => item.type === "event")) {
    const targetType = "event";
    for (const name of parseCompanions(event.companions)) {
      const person = ensurePerson(name);
      const linkedExpenses = expenses.filter((expense) => expense.targetType === targetType && expense.targetId === event.id);
      const linkedLogs = logs.filter((log) => log.linkedTargetType === targetType && log.linkedTargetId === event.id);
      const linkedPhotos = photos.filter((photo) => photo.linkedTargetType === targetType && photo.linkedTargetId === event.id);
      person.items.push({
        date: event.date,
        description: formatRecordContextMeta(event.date, event.date, event.endDate, event.time, event.endTime, event.isAllDay, event.companions),
        id: `${name}-${targetType}-${event.id}`,
        focusId: createRecordFocusId(targetType, event.id),
        label: "이벤트",
        tags: [event.place?.name, event.meta].filter(Boolean) as string[],
        title: event.title,
        type: targetType,
      });
      person.expenses.push(...linkedExpenses);
      person.logs.push(...linkedLogs);
      person.photos.push(...linkedPhotos);
      if (event.place?.name) person.places.push(event.place.name);
    }
  }

  for (const task of tasks) {
    for (const name of parseCompanions(task.companions)) {
      const person = ensurePerson(name);
      const linkedExpenses = expenses.filter((expense) => expense.targetType === "todo" && expense.targetId === task.id);
      const linkedLogs = logs.filter((log) => log.linkedTargetType === "todo" && log.linkedTargetId === task.id);
      const linkedPhotos = photos.filter((photo) => photo.linkedTargetType === "todo" && photo.linkedTargetId === task.id);
      person.items.push({
        date: task.scheduledDate,
        description: formatRecordContextMeta(task.scheduledDate, task.scheduledDate, task.dueDate, task.startTime, task.endTime, task.isAllDay, task.companions),
        id: `${name}-todo-${task.id}`,
        focusId: createRecordFocusId("todo", task.id),
        label: "할일",
        tags: [task.place?.name, task.memo].filter(Boolean) as string[],
        title: task.title,
        type: "todo",
      });
      person.expenses.push(...linkedExpenses);
      person.logs.push(...linkedLogs);
      person.photos.push(...linkedPhotos);
      if (task.place?.name) person.places.push(task.place.name);
    }
  }

  for (const activity of activities) {
    for (const name of parseCompanions(activity.companions)) {
      const person = ensurePerson(name);
      const linkedExpenses = expenses.filter((expense) => expense.targetType === "activity" && expense.targetId === activity.id);
      const linkedLogs = logs.filter((log) => log.linkedTargetType === "activity" && log.linkedTargetId === activity.id);
      const linkedPhotos = photos.filter((photo) => photo.linkedTargetType === "activity" && photo.linkedTargetId === activity.id);
      person.items.push({
        date: activity.date,
        description: [formatActivityTime(activity), activity.placeName, activity.food, activity.memo].filter(Boolean).join(" · "),
        id: `${name}-activity-${activity.id}`,
        focusId: createRecordFocusId("activity", activity.id),
        label: "활동",
        tags: [activity.placeName, activity.food, activity.memo].filter(Boolean) as string[],
        title: activity.title,
        type: "activity",
      });
      person.expenses.push(...linkedExpenses);
      person.logs.push(...linkedLogs);
      person.photos.push(...linkedPhotos);
      if (activity.placeName) person.places.push(activity.placeName);
    }
  }

  return [...people.values()]
    .map((person) => ({
      ...person,
      expenseTotal: person.expenses.reduce((sum, expense) => sum + expense.amount, 0),
      items: person.items.sort((a, b) => b.date.localeCompare(a.date)),
      places: [...new Set(person.places)],
    }))
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
}

export function buildRecordSearchItems(
  events: CalendarEvent[],
  tasks: TaskItem[],
  activities: LifeActivityRecord[],
  expenses: ExpenseRecord[],
  incomes: IncomeRecord[],
  logs: DailyLogRecord[],
  photos: LifePhotoRecord[],
  weights: WeightRecord[],
  workouts: WorkoutSession[],
): RecordSearchItem[] {
  return [
    ...events
      .filter((event) => event.type === "event")
      .map((event) => ({
        date: event.date,
        description: formatRecordContextMeta(event.date, event.date, event.endDate, event.time, event.endTime, event.isAllDay, event.companions),
        facts: cleanSearchFacts([
          searchFact("time", formatRecordContextMeta(event.date, event.date, event.endDate, event.time, event.endTime, event.isAllDay)),
          searchFact("place", formatPlaceText(event.place?.name, event.place?.address)),
          searchFact("people", formatCompanionsText(event.companions)),
          searchFact("money", event.expenseAmount ? formatWon(event.expenseAmount) : undefined),
          searchFact("memo", event.meta),
        ]),
        id: `${event.type}-${event.id}`,
        label: "이벤트",
        tags: [event.meta, event.place?.name, event.place?.address, event.companions, event.expenseAmount ? formatWon(event.expenseAmount) : ""].filter(Boolean) as string[],
        title: event.title,
        type: "event" as const,
      })),
    ...tasks.map((task) => ({
      date: task.scheduledDate,
      description: formatRecordContextMeta(task.scheduledDate, task.scheduledDate, task.dueDate, task.startTime, task.endTime, task.isAllDay, task.companions),
      facts: cleanSearchFacts([
        searchFact("status", formatTaskStatus(task.status, task.priority)),
        searchFact("time", formatRecordContextMeta(task.scheduledDate, task.scheduledDate, task.dueDate, task.startTime, task.endTime, task.isAllDay)),
        searchFact("place", formatPlaceText(task.place?.name, task.place?.address)),
        searchFact("people", formatCompanionsText(task.companions)),
        searchFact("money", task.expenseAmount ? formatWon(task.expenseAmount) : undefined),
        searchFact("memo", task.memo),
      ]),
      id: `todo-${task.id}`,
      label: "할일",
      tags: [task.status, task.priority, task.memo, task.place?.name, task.place?.address, task.companions, task.expenseAmount ? formatWon(task.expenseAmount) : ""].filter(Boolean) as string[],
      title: task.title,
      type: "todo" as const,
    })),
    ...activities.map((activity) => ({
      date: activity.date,
      description: [formatActivityTime(activity), activity.placeName, activity.companions ? `함께한 사람 · ${activity.companions}` : null, activity.food ? `음식 · ${activity.food}` : null, activity.memo].filter(Boolean).join(" · "),
      facts: cleanSearchFacts([
        searchFact("time", formatActivityTime(activity)),
        searchFact("place", formatPlaceText(activity.placeName, activity.placeAddress)),
        searchFact("people", formatCompanionsText(activity.companions)),
        searchFact("food", activity.food ? `음식 · ${activity.food}` : undefined),
        searchFact("money", activity.expenseAmount ? formatWon(activity.expenseAmount) : undefined),
        searchFact("memo", activity.memo),
      ]),
      id: `activity-${activity.id}`,
      label: "활동",
      tags: [activity.placeName, activity.placeAddress, activity.companions, activity.food, activity.memo, activity.expenseAmount ? formatWon(activity.expenseAmount) : ""].filter(Boolean) as string[],
      title: activity.title,
      type: "activity" as const,
    })),
    ...expenses.map((expense) => ({
      date: expense.date,
      description: [expense.category, formatWon(expense.amount), expense.memo].filter(Boolean).join(" · "),
      facts: cleanSearchFacts([
        searchFact("money", formatWon(expense.amount)),
        searchFact("tag", EXPENSE_CATEGORY_LABELS[expense.category]),
        searchFact("tag", expense.targetType ? `연결 · ${getLinkedTargetTypeLabel(expense.targetType)}` : undefined),
        searchFact("memo", expense.memo),
      ]),
      id: `expense-${expense.id}`,
      label: "지출",
      tags: [expense.category, expense.memo, expense.targetType, expense.targetId].filter(Boolean) as string[],
      title: expense.title,
      type: "expense" as const,
    })),
    ...incomes.map((income) => ({
      date: income.date,
      description: [income.category, formatWon(income.amount), income.memo].filter(Boolean).join(" · "),
      facts: cleanSearchFacts([
        searchFact("money", formatWon(income.amount)),
        searchFact("tag", INCOME_CATEGORY_LABELS[income.category]),
        searchFact("memo", income.memo),
      ]),
      id: `income-${income.id}`,
      label: "수입",
      tags: [income.category, income.memo].filter(Boolean) as string[],
      title: income.title,
      type: "income" as const,
    })),
    ...logs.map((log) => ({
      date: log.date,
      description: log.content,
      facts: cleanSearchFacts([
        searchFact("memo", log.content),
        searchFact("tag", log.linkedTargetTitle ? `연결 · ${log.linkedTargetTitle}` : undefined),
        searchFact("tag", log.linkedTargetType ? getLinkedTargetTypeLabel(log.linkedTargetType) : undefined),
      ]),
      id: `daily-log-${log.id}`,
      label: "하루기록",
      tags: [log.linkedTargetTitle, log.linkedTargetType].filter(Boolean) as string[],
      title: log.linkedTargetTitle ? `하루기록 · ${log.linkedTargetTitle}` : "하루기록",
      type: "daily_log" as const,
    })),
    ...photos.map((photo) => ({
      date: photo.date,
      description: [photo.caption, photo.fileName, photo.mimeType].filter(Boolean).join(" · "),
      facts: cleanSearchFacts([
        searchFact("photo", photo.caption || photo.fileName),
        searchFact("tag", photo.linkedTargetTitle ? `연결 · ${photo.linkedTargetTitle}` : undefined),
        searchFact("tag", photo.linkedTargetType ? getLinkedTargetTypeLabel(photo.linkedTargetType) : undefined),
        searchFact("tag", photo.mimeType),
      ]),
      id: `photo-${photo.id}`,
      label: "사진",
      tags: [photo.linkedTargetTitle, photo.linkedTargetType, photo.fileName, photo.mimeType].filter(Boolean) as string[],
      title: photo.caption || photo.fileName,
      type: "photo" as const,
    })),
    ...workouts.map((workout) => ({
      date: workout.date,
      description: [workout.distanceKm ? `${workout.distanceKm}km` : null, formatRunDuration(workout.durationSeconds ?? workout.durationMinutes * 60), workout.memo].filter(Boolean).join(" · "),
      facts: cleanSearchFacts([
        searchFact("time", workout.isAllDay ? "하루종일" : workout.startTime),
        searchFact("workout", [WORKOUT_TYPE_LABELS[workout.type], workout.distanceKm ? `${workout.distanceKm}km` : null, formatRunDuration(workout.durationSeconds ?? workout.durationMinutes * 60)].filter(Boolean).join(" · ")),
        searchFact("status", WORKOUT_CONDITION_LABELS[workout.condition]),
        searchFact("memo", workout.memo),
      ]),
      id: `workout-${workout.id}`,
      label: workout.type === "running" ? "러닝" : "운동",
      tags: [workout.type, workout.condition, workout.memo].filter(Boolean) as string[],
      title: workout.type === "running" ? "러닝 기록" : "운동 기록",
      type: "workout" as const,
    })),
    ...weights.map((weight) => ({
      date: weight.date,
      description: [formatWeightMeasurementMeta(weight.measuredAtTime, weight.measuredFasted), weight.memo].filter(Boolean).join(" · "),
      facts: cleanSearchFacts([
        searchFact("status", `${weight.weightKg}kg`),
        searchFact("time", formatWeightMeasurementMeta(weight.measuredAtTime, weight.measuredFasted)),
        searchFact("memo", weight.memo),
      ]),
      id: `weight-${weight.id}`,
      label: "몸무게",
      tags: [String(weight.weightKg), weight.memo].filter(Boolean) as string[],
      title: `${weight.weightKg}kg`,
      type: "weight" as const,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

const EXPENSE_CATEGORY_LABELS: Record<ExpenseRecord["category"], string> = {
  culture: "문화",
  education: "교육",
  etc: "기타",
  food: "식비",
  health: "건강",
  housing: "주거",
  shopping: "쇼핑",
  transport: "교통",
};

const INCOME_CATEGORY_LABELS: Record<IncomeRecord["category"], string> = {
  business: "사업",
  etc: "기타",
  gift: "선물",
  investment: "투자",
  refund: "환급",
  salary: "급여",
  side: "부수입",
};

const WORKOUT_TYPE_LABELS: Record<WorkoutSession["type"], string> = {
  bodyweight: "맨몸운동",
  etc: "운동",
  running: "러닝",
  stretching: "스트레칭",
  weight: "웨이트",
};

const WORKOUT_CONDITION_LABELS: Record<WorkoutSession["condition"], string> = {
  good: "컨디션 좋음",
  low: "컨디션 낮음",
  normal: "컨디션 보통",
};

function searchFact(kind: RecordSearchFactKind, text?: string | null): RecordSearchFact | undefined {
  const trimmed = text?.trim();
  return trimmed ? { kind, text: trimmed } : undefined;
}

function cleanSearchFacts(facts: Array<RecordSearchFact | undefined>) {
  const seen = new Set<string>();
  return facts.filter((fact): fact is RecordSearchFact => {
    if (!fact) return false;
    const key = `${fact.kind}:${fact.text.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatPlaceText(name?: string, address?: string) {
  return [name, address].filter(Boolean).join(" · ") || undefined;
}

function formatCompanionsText(companions?: string) {
  return companions ? `함께한 사람 · ${companions}` : undefined;
}

function formatTaskStatus(status: TaskItem["status"], priority: TaskItem["priority"]) {
  const statusLabel = status === "done" ? "완료" : status === "inProgress" ? "진행 중" : "할 일";
  const priorityLabel = priority === "high" ? "높은 우선순위" : priority === "low" ? "낮은 우선순위" : undefined;
  return [statusLabel, priorityLabel].filter(Boolean).join(" · ");
}

export function selectRelevantRecordAskRecords(question: string, records: RecordSearchItem[]) {
  const normalizedQuestion = question.trim().toLowerCase();
  if (!normalizedQuestion) return records.slice(0, LIFE_ASK_RECORD_LIMIT);

  const monthKeys = getQuestionMonthKeys(normalizedQuestion);
  const dateKeys = getQuestionDateKeys(normalizedQuestion);
  const terms = getQuestionTerms(normalizedQuestion);
  const scored = records
    .map((record) => {
      const searchableText = [record.date, record.label, record.title, record.description, record.tags.join(" ")].join(" ").toLowerCase();
      const monthScore = monthKeys.some((monthKey) => record.date.startsWith(monthKey) || record.date.slice(5, 7) === monthKey) ? 10 : 0;
      const dateScore = dateKeys.some((dateKey) => record.date === dateKey) ? 16 : 0;
      const termScore = terms.reduce((score, term) => score + (searchableText.includes(term) ? 2 : 0), 0);
      const typeScore = getLifeAskTypeScore(normalizedQuestion, record.type);
      return { record, score: monthScore + dateScore + termScore + typeScore };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.record.date.localeCompare(a.record.date))
    .map((item) => item.record);

  if (scored.length === 0) return records.slice(0, LIFE_ASK_RECORD_LIMIT);

  const selected = new Map<string, RecordSearchItem>();
  scored.forEach((record) => selected.set(record.id, record));
  records.slice(0, 60).forEach((record) => selected.set(record.id, record));
  return [...selected.values()].slice(0, LIFE_ASK_RECORD_LIMIT);
}

function getQuestionMonthKeys(question: string) {
  const monthKeys = new Set<string>();
  for (const match of question.matchAll(/(20\d{2})\s*[년\-./]?\s*(1[0-2]|0?[1-9])\s*월?/g)) {
    monthKeys.add(`${match[1]}-${match[2].padStart(2, "0")}`);
  }
  for (const match of question.matchAll(/(?:^|[^0-9])(1[0-2]|0?[1-9])\s*월/g)) {
    monthKeys.add(match[1].padStart(2, "0"));
  }
  return [...monthKeys];
}

function getQuestionDateKeys(question: string) {
  const dateKeys = new Set<string>();
  for (const match of question.matchAll(/(20\d{2})[년\-./\s]+(1[0-2]|0?[1-9])[월\-./\s]+([12]\d|3[01]|0?[1-9])\s*일?/g)) {
    dateKeys.add(`${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`);
  }
  return [...dateKeys];
}

function getQuestionTerms(question: string) {
  const stopWords = new Set(["그때", "어땠어", "어때", "했던", "같은데", "자주", "최근", "이번", "지난", "나", "내가", "기록", "흐름"]);
  return question
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !stopWords.has(term) && !/^\d+$/.test(term));
}

function getLifeAskTypeScore(question: string, type: RecordSearchItem["type"]) {
  if ((question.includes("사진") || question.includes("영상")) && type === "photo") return 4;
  if ((question.includes("소비") || question.includes("지출") || question.includes("돈")) && type === "expense") return 4;
  if ((question.includes("수입") || question.includes("월급") || question.includes("입금")) && type === "income") return 4;
  if ((question.includes("운동") || question.includes("러닝") || question.includes("건강")) && (type === "workout" || type === "weight")) return 4;
  if ((question.includes("누구") || question.includes("사람") || question.includes("친구")) && (type === "todo" || type === "event" || type === "activity")) return 3;
  if ((question.includes("장소") || question.includes("어디")) && (type === "todo" || type === "event" || type === "activity")) return 3;
  if ((question.includes("활동") || question.includes("뭐했") || question.includes("무엇")) && type === "activity") return 4;
  return 0;
}

function getPhotoTargetTypeLabel(type?: LifePhotoRecord["linkedTargetType"]) {
  return getLinkedTargetTypeLabel(type);
}

