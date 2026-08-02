import type { TaskPriority, TaskStatus } from "@/types/domain";
import type { CalendarCategory, ExternalCalendarCategory } from "@/features/calendar/types";

export const categoryDisplayOrder: CalendarCategory[] = ["schedule", "todo", "event"];

export const categoryLabels: Record<CalendarCategory, string> = {
  schedule: "일정",
  event: "이벤트",
  todo: "할 일",
};

export const eventTone: Record<CalendarCategory, "violet" | "green" | "pink"> = {
  schedule: "violet",
  event: "pink",
  todo: "green",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "할 일",
  inProgress: "진행 중",
  done: "완료",
};

export const taskPriorityLabels: Record<TaskPriority, string> = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};

export const taskPriorityTone: Record<TaskPriority, "pink" | "amber" | "muted"> = {
  high: "pink",
  normal: "amber",
  low: "muted",
};

export function formatShortDate(dateKey: string) {
  return `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8, 10))}`;
}

export function formatPlanDateTime(startDate: string, endDate?: string, startTime?: string, endTime?: string, isAllDay = true) {
  const dateLabel = endDate && endDate !== startDate ? `${formatShortDate(startDate)}-${formatShortDate(endDate)}` : formatShortDate(startDate);
  if (isAllDay) return `${dateLabel} · 하루종일`;
  if (startTime && endTime) return `${dateLabel} · ${startTime}-${endTime}`;
  if (startTime) return `${dateLabel} · ${startTime}`;
  return dateLabel;
}

export function isExternalTimelineType(type: CalendarCategory | ExternalCalendarCategory): type is ExternalCalendarCategory {
  return type === "activity" || type === "expense" || type === "workout" || type === "weight" || type === "daily_log" || type === "photo";
}

export function getCalendarSummaryLabel(type: CalendarCategory | ExternalCalendarCategory) {
  if (type === "activity") return "활동";
  if (type === "expense") return "지출";
  if (type === "workout") return "운동";
  if (type === "weight") return "몸무게";
  if (type === "daily_log") return "기록";
  if (type === "photo") return "사진";
  return categoryLabels[type];
}
