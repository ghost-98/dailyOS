import type { TaskPriority, TaskStatus } from "@/types/domain";
import type { CalendarCategory, ExternalCalendarCategory } from "@/features/calendar/types";

export const categoryDisplayOrder: CalendarCategory[] = ["schedule", "todo", "event"];

export const categoryLabels: Record<CalendarCategory, string> = {
  schedule: "??",
  event: "???",
  todo: "??",
};

export const eventTone: Record<CalendarCategory, "violet" | "green" | "pink"> = {
  schedule: "violet",
  event: "pink",
  todo: "green",
};

export const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "??",
  inProgress: "?? ?",
  done: "??",
};

export const taskPriorityLabels: Record<TaskPriority, string> = {
  high: "??",
  normal: "??",
  low: "??",
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
  if (isAllDay) return `${dateLabel} ? ????`;
  if (startTime && endTime) return `${dateLabel} ? ${startTime}-${endTime}`;
  if (startTime) return `${dateLabel} ? ${startTime}`;
  return dateLabel;
}

export function isExternalTimelineType(type: CalendarCategory | ExternalCalendarCategory): type is ExternalCalendarCategory {
  return type === "activity" || type === "expense" || type === "workout" || type === "weight" || type === "daily_log" || type === "photo";
}

export function getCalendarSummaryLabel(type: CalendarCategory | ExternalCalendarCategory) {
  if (type === "activity") return "??";
  if (type === "expense") return "???";
  if (type === "workout") return "??";
  if (type === "weight") return "???";
  if (type === "daily_log") return "??";
  if (type === "photo") return "??";
  return categoryLabels[type];
}
