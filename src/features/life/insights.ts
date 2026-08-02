import type { CalendarEvent } from "@/features/calendar/data";
import { formatWon } from "@/features/life/formatters";
import { getActivityPlaceRef } from "@/features/life/places";
import type { LifePlaceRef } from "@/features/life/places";
import type { DailyLogRecord, ExpenseRecord, LifeActivityRecord, LifePhotoRecord, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

export type LifeContextBundle = {
  date: string;
  expenses: ExpenseRecord[];
  key: string;
  label: string;
  logs: DailyLogRecord[];
  meta?: string;
  photos: LifePhotoRecord[];
  place?: LifePlaceRef;
  targetId: string;
  targetType: "schedule" | "todo" | "event" | "activity";
  title: string;
};


export type LifeSearchItem = {
  date: string;
  description: string;
  id: string;
  label: string;
  tags: string[];
  title: string;
  type: "schedule" | "todo" | "event" | "activity" | "expense" | "daily_log" | "photo" | "workout" | "weight";
};

const LIFE_ASK_RECORD_LIMIT = 220;

type PersonSummary = {
  expenseTotal: number;
  expenses: ExpenseRecord[];
  items: LifeSearchItem[];
  logs: DailyLogRecord[];
  name: string;
  photos: LifePhotoRecord[];
  places: string[];
};

export function buildLifeContextBundles(
  date: string,
  events: CalendarEvent[],
  tasks: TaskItem[],
  activities: LifeActivityRecord[],
  expenses: ExpenseRecord[],
  logs: DailyLogRecord[],
  photos: LifePhotoRecord[],
): LifeContextBundle[] {
  const eventBundles = events
    .filter((event) => event.type === "schedule" || event.type === "event")
    .map((event) => {
      const targetType = event.type === "event" ? "event" : "schedule";
      return {
        expenses: expenses.filter((expense) => expense.targetType === targetType && expense.targetId === event.id),
        date,
        key: `${targetType}:${event.id}`,
        label: getPhotoTargetTypeLabel(targetType),
        logs: logs.filter((log) => log.linkedTargetType === targetType && log.linkedTargetId === event.id),
        meta: formatContextMeta(date, event.date, event.endDate, event.time, event.endTime, event.isAllDay, event.companions),
        photos: photos.filter((photo) => photo.linkedTargetType === targetType && photo.linkedTargetId === event.id),
        place: event.place,
        targetId: event.id,
        targetType,
        title: event.title,
      } satisfies LifeContextBundle;
    });

  const taskBundles = tasks.map((task) => ({
    date,
    expenses: expenses.filter((expense) => expense.targetType === "todo" && expense.targetId === task.id),
    key: `todo:${task.id}`,
    label: "할일",
    logs: logs.filter((log) => log.linkedTargetType === "todo" && log.linkedTargetId === task.id),
    meta: formatContextMeta(date, task.scheduledDate, task.dueDate, task.startTime, task.endTime, task.isAllDay, task.companions),
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

function getContextScore(bundle: LifeContextBundle) {
  return bundle.expenses.length + bundle.logs.length + bundle.photos.length + (bundle.place ? 1 : 0);
}

export function formatContextMeta(date: string, startDate: string, endDate?: string, startTime?: string, endTime?: string, isAllDay = true, companions?: string) {
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

export function buildPeopleSummaries(events: CalendarEvent[], tasks: TaskItem[], activities: LifeActivityRecord[], expenses: ExpenseRecord[], logs: DailyLogRecord[], photos: LifePhotoRecord[]) {
  const people = new Map<string, PersonSummary>();

  const ensurePerson = (name: string) => {
    const current = people.get(name);
    if (current) return current;
    const nextPerson: PersonSummary = { expenseTotal: 0, expenses: [], items: [], logs: [], name, photos: [], places: [] };
    people.set(name, nextPerson);
    return nextPerson;
  };

  for (const event of events.filter((item) => item.type === "schedule" || item.type === "event")) {
    const targetType = event.type === "event" ? "event" : "schedule";
    for (const name of parseCompanions(event.companions)) {
      const person = ensurePerson(name);
      const linkedExpenses = expenses.filter((expense) => expense.targetType === targetType && expense.targetId === event.id);
      const linkedLogs = logs.filter((log) => log.linkedTargetType === targetType && log.linkedTargetId === event.id);
      const linkedPhotos = photos.filter((photo) => photo.linkedTargetType === targetType && photo.linkedTargetId === event.id);
      person.items.push({
        date: event.date,
        description: formatContextMeta(event.date, event.date, event.endDate, event.time, event.endTime, event.isAllDay, event.companions),
        id: `${name}-${targetType}-${event.id}`,
        label: targetType === "event" ? "이벤트" : "일정",
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
        description: formatContextMeta(task.scheduledDate, task.scheduledDate, task.dueDate, task.startTime, task.endTime, task.isAllDay, task.companions),
        id: `${name}-todo-${task.id}`,
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

export function buildLifeSearchItems(
  events: CalendarEvent[],
  tasks: TaskItem[],
  activities: LifeActivityRecord[],
  expenses: ExpenseRecord[],
  logs: DailyLogRecord[],
  photos: LifePhotoRecord[],
  weights: WeightRecord[],
  workouts: WorkoutSession[],
): LifeSearchItem[] {
  return [
    ...events
      .filter((event) => event.type === "schedule" || event.type === "event")
      .map((event) => ({
        date: event.date,
        description: formatContextMeta(event.date, event.date, event.endDate, event.time, event.endTime, event.isAllDay, event.companions),
        id: `${event.type}-${event.id}`,
        label: event.type === "event" ? "이벤트" : "일정",
        tags: [event.meta, event.place?.name, event.place?.address, event.companions, event.expenseAmount ? formatWon(event.expenseAmount) : ""].filter(Boolean) as string[],
        title: event.title,
        type: event.type === "event" ? ("event" as const) : ("schedule" as const),
      })),
    ...tasks.map((task) => ({
      date: task.scheduledDate,
      description: formatContextMeta(task.scheduledDate, task.scheduledDate, task.dueDate, task.startTime, task.endTime, task.isAllDay, task.companions),
      id: `todo-${task.id}`,
      label: "할일",
      tags: [task.status, task.priority, task.memo, task.place?.name, task.place?.address, task.companions, task.expenseAmount ? formatWon(task.expenseAmount) : ""].filter(Boolean) as string[],
      title: task.title,
      type: "todo" as const,
    })),
    ...activities.map((activity) => ({
      date: activity.date,
      description: [formatActivityTime(activity), activity.placeName, activity.companions ? `함께한 사람 · ${activity.companions}` : null, activity.food ? `음식 · ${activity.food}` : null, activity.memo].filter(Boolean).join(" · "),
      id: `activity-${activity.id}`,
      label: "활동",
      tags: [activity.placeName, activity.placeAddress, activity.companions, activity.food, activity.memo, activity.expenseAmount ? formatWon(activity.expenseAmount) : ""].filter(Boolean) as string[],
      title: activity.title,
      type: "activity" as const,
    })),
    ...expenses.map((expense) => ({
      date: expense.date,
      description: [expense.category, formatWon(expense.amount), expense.memo].filter(Boolean).join(" · "),
      id: `expense-${expense.id}`,
      label: "지출",
      tags: [expense.category, expense.memo, expense.targetType, expense.targetId].filter(Boolean) as string[],
      title: expense.title,
      type: "expense" as const,
    })),
    ...logs.map((log) => ({
      date: log.date,
      description: log.content,
      id: `daily-log-${log.id}`,
      label: "하루기록",
      tags: [log.linkedTargetTitle, log.linkedTargetType].filter(Boolean) as string[],
      title: log.linkedTargetTitle ? `하루기록 · ${log.linkedTargetTitle}` : "하루기록",
      type: "daily_log" as const,
    })),
    ...photos.map((photo) => ({
      date: photo.date,
      description: [photo.caption, photo.fileName, photo.mimeType].filter(Boolean).join(" · "),
      id: `photo-${photo.id}`,
      label: "사진",
      tags: [photo.linkedTargetTitle, photo.linkedTargetType, photo.fileName, photo.mimeType].filter(Boolean) as string[],
      title: photo.caption || photo.fileName,
      type: "photo" as const,
    })),
    ...workouts.map((workout) => ({
      date: workout.date,
      description: [workout.distanceKm ? `${workout.distanceKm}km` : null, formatRunDuration(workout.durationSeconds ?? workout.durationMinutes * 60), workout.memo].filter(Boolean).join(" · "),
      id: `workout-${workout.id}`,
      label: workout.type === "running" ? "러닝" : "운동",
      tags: [workout.type, workout.condition, workout.memo].filter(Boolean) as string[],
      title: workout.type === "running" ? "러닝 기록" : "운동 기록",
      type: "workout" as const,
    })),
    ...weights.map((weight) => ({
      date: weight.date,
      description: [weight.measuredFasted ? "공복" : null, weight.memo].filter(Boolean).join(" · "),
      id: `weight-${weight.id}`,
      label: "몸무게",
      tags: [String(weight.weightKg), weight.memo].filter(Boolean) as string[],
      title: `${weight.weightKg}kg`,
      type: "weight" as const,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

export function selectRelevantLifeAskRecords(question: string, records: LifeSearchItem[]) {
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

  const selected = new Map<string, LifeSearchItem>();
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

function getLifeAskTypeScore(question: string, type: LifeSearchItem["type"]) {
  if ((question.includes("사진") || question.includes("영상")) && type === "photo") return 4;
  if ((question.includes("소비") || question.includes("지출") || question.includes("돈")) && type === "expense") return 4;
  if ((question.includes("운동") || question.includes("러닝") || question.includes("건강")) && (type === "workout" || type === "weight")) return 4;
  if ((question.includes("누구") || question.includes("사람") || question.includes("친구")) && (type === "schedule" || type === "todo" || type === "event" || type === "activity")) return 3;
  if ((question.includes("장소") || question.includes("어디")) && (type === "schedule" || type === "todo" || type === "event" || type === "activity")) return 3;
  if ((question.includes("활동") || question.includes("뭐했") || question.includes("무엇")) && type === "activity") return 4;
  return 0;
}

function getPhotoTargetTypeLabel(type?: LifePhotoRecord["linkedTargetType"]) {
  if (type === "schedule") return "??";
  if (type === "todo") return "??";
  if (type === "event") return "???";
  if (type === "activity") return "??";
  return "??";
}

function formatActivityTime(activity: Pick<LifeActivityRecord, "endTime" | "isAllDay" | "startTime">) {
  if (activity.isAllDay || !activity.startTime) return "?? ??";
  return activity.endTime ? `${activity.startTime}-${activity.endTime}` : activity.startTime;
}

function formatRunDuration(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  return `${minutes}? ${seconds}?`;
}
