import { categoryDisplayOrder } from "@/features/calendar/presentation";
import type { CalendarEvent } from "@/features/calendar/data";
import type { CalendarCategory, DayTimelineItem, ExternalCalendarCategory, ExternalCalendarItem } from "@/features/calendar/types";
import type { EventType, TaskItem } from "@/types/domain";

export function getCategories(allowedTypes?: EventType[]): CalendarCategory[] {
  const source = allowedTypes ?? categoryDisplayOrder;
  return categoryDisplayOrder.filter((type) => source.includes(type));
}

export function createEventTimelineItem(event: CalendarEvent): DayTimelineItem {
  return {
    event,
    id: `event-${event.id}`,
    sortMinutes: getTimelineSortMinutes(event.time, event.isAllDay),
    timeLabel: getTimelineTimeLabel(event.time, event.isAllDay),
    type: "event",
  };
}

export function createTaskTimelineItem(task: TaskItem): DayTimelineItem {
  return {
    id: `todo-${task.id}`,
    sortMinutes: getTimelineSortMinutes(task.startTime, task.isAllDay),
    task,
    timeLabel: getTimelineTimeLabel(task.startTime, task.isAllDay),
    type: "todo",
  };
}

export function createExternalTimelineItem(external: ExternalCalendarItem): DayTimelineItem {
  const photoTime = external.type === "photo" ? getPhotoTakenTime(external.takenAt) : null;
  const sortMinutes =
    photoTime !== null
      ? photoTime
      : external.startTime
        ? getTimelineSortMinutes(external.startTime, external.isAllDay)
        : 24 * 60 + getTimelineTypeOrder(external.type);
  const timeLabel =
    photoTime !== null
      ? formatMinutesToTimeLabel(photoTime)
      : external.startTime && !external.isAllDay
        ? getTimelineTimeLabel(external.startTime, external.isAllDay)
        : "기록";

  return {
    external,
    id: `${external.type}-${external.id}`,
    sortMinutes,
    timeLabel,
    type: external.type,
  };
}

export function summarizeDay(events: CalendarEvent[], tasks: TaskItem[], categories: CalendarCategory[], externalItems: ExternalCalendarItem[]) {
  const eventCount = categories.includes("event") ? events.filter((event) => event.type === "event").length : 0;
  const todoCount = categories.includes("todo") ? tasks.length : 0;
  const recordCount = externalItems.filter((item) => item.type === "activity" || item.type === "expense" || item.type === "income" || item.type === "daily_log" || item.type === "photo").length;
  return {
    eventCount,
    recordCount,
    todoCount,
    totalCount: eventCount + todoCount + recordCount,
  };
}

function getTimelineSortMinutes(time?: string, isAllDay = true) {
  if (isAllDay || !time) return 24 * 60;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 24 * 60;
  return hours * 60 + minutes;
}

export function getTimelineTimeLabel(time?: string, isAllDay = true) {
  if (isAllDay) return "하루종일";
  return time || "시간 미정";
}

function getPhotoTakenTime(takenAt?: string) {
  if (!takenAt) return null;
  const date = new Date(takenAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function formatMinutesToTimeLabel(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function getTimelineTypeOrder(type: CalendarCategory | ExternalCalendarCategory) {
  const order: Record<CalendarCategory | ExternalCalendarCategory, number> = {
    todo: 1,
    event: 2,
    activity: 3,
    expense: 3,
    income: 3,
    workout: 4,
    weight: 5,
    daily_log: 6,
    photo: 7,
  };
  return order[type];
}






