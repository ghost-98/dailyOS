import type { TaskPriority, TaskStatus } from "@/types/domain";
import type { CalendarCategory } from "@/features/calendar/types";

export const categoryDisplayOrder: CalendarCategory[] = ["todo", "event"];

export const categoryLabels: Record<CalendarCategory, string> = {
  event: "이벤트",
  todo: "할 일",
};

export const eventTone: Record<CalendarCategory, "green" | "pink"> = {
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

function formatShortDate(dateKey: string) {
  return `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8, 10))}`;
}

export function formatPlanDateTime(startDate: string, endDate?: string, startTime?: string, endTime?: string, isAllDay = true) {
  const dateLabel = endDate && endDate !== startDate ? `${formatShortDate(startDate)}-${formatShortDate(endDate)}` : formatShortDate(startDate);
  if (isAllDay) return `${dateLabel} · 하루종일`;
  if (startTime && endTime) return `${dateLabel} · ${startTime}-${endTime}`;
  if (startTime) return `${dateLabel} · ${startTime}`;
  return dateLabel;
}







