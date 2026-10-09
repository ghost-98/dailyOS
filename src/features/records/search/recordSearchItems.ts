import type { CalendarEvent } from "@/features/calendar/data";
import { formatActivityTime, formatRunDuration, formatWeightMeasurementMeta, formatWon, getLinkedTargetTypeLabel, formatRecordContextMeta } from "@/features/records/format/recordFormatters";
import type { DailyLogRecord, ExpenseRecord, IncomeRecord, LifeActivityRecord, LifePhotoRecord, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";
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

type RecordSearchFact = {
  kind: RecordSearchFactKind;
  text: string;
};

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
