import { categoryDisplayOrder } from "@/features/calendar/presentation";
import { formatDateKey, formatSelectedDate, isDateInRange, uniquePlanPlaces } from "@/features/calendar/utils";
import type { CalendarEvent } from "@/features/calendar/data";
import type { CalendarCategory, DayTimelineItem, ExternalCalendarCategory, ExternalCalendarItem } from "@/features/calendar/types";
import type { EventType, PlanPlace, TaskItem } from "@/types/domain";

export type LifeCalendarScope = "day" | "week" | "month" | "range";

export type PeriodDaySummary = {
  activityCount: number;
  date: string;
  expenseCount: number;
  healthCount: number;
  incomeCount: number;
  items: DayTimelineItem[];
  placeCount: number;
  planCount: number;
  recordCount: number;
  totalCount: number;
};

export function normalizeRangeBounds(start: string, end: string) {
  if (start <= end) return { end, start };
  return { end: start, start: end };
}

export function getWeekBounds(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  const start = new Date(date);
  const weekday = date.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(date.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { end: formatDateKey(end), start: formatDateKey(start) };
}

export function getMonthBounds(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { end: formatDateKey(end), start: formatDateKey(start) };
}

export function isRangeOverlapping(startDate: string, endDate: string | undefined, filterStart: string, filterEnd: string) {
  const normalizedEndDate = endDate ?? startDate;
  return startDate <= filterEnd && normalizedEndDate >= filterStart;
}

export function getTimelineItemDate(item: DayTimelineItem) {
  if ("event" in item) return item.event.date;
  if ("task" in item) return item.task.scheduledDate;
  return item.external.date;
}

export function getScopeTitle(scope: LifeCalendarScope, start: string, end: string, currentMonth: Date) {
  if (scope === "day") return formatSelectedDate(start);
  if (scope === "week") return `${formatSelectedDate(start)} ~ ${formatSelectedDate(end)}`;
  if (scope === "month") return `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;
  return `${formatSelectedDate(start)} ~ ${formatSelectedDate(end)}`;
}

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

export function buildPeriodDaySummaries(start: string, end: string, events: CalendarEvent[], tasks: TaskItem[], externalItems: ExternalCalendarItem[]) {
  const allDates = enumerateDates(start, end);
  return allDates
    .map((date) => {
      const dayEvents = events.filter((item) => isDateInRange(date, item.date, item.endDate));
      const dayTasks = tasks.filter((item) => isDateInRange(date, item.scheduledDate, item.dueDate));
      const dayExternalItems = externalItems.filter((item) => item.date === date);
      const items = [
        ...dayTasks.map((item) => createTaskTimelineItem(item)),
        ...dayEvents.map((item) => createEventTimelineItem(item)),
        ...dayExternalItems.map((item) => createExternalTimelineItem(item)),
      ];
      const places = uniquePlanPlaces(
        [...dayEvents, ...dayTasks]
          .map((item) => item.place)
          .filter((place): place is PlanPlace => Boolean(place)),
      );

      return {
        activityCount: dayExternalItems.filter((item) => item.type === "activity").length,
        date,
        expenseCount: dayExternalItems.filter((item) => item.type === "expense").length,
        healthCount: dayExternalItems.filter((item) => item.type === "workout" || item.type === "weight").length,
        incomeCount: dayExternalItems.filter((item) => item.type === "income").length,
        items,
        placeCount: places.length,
        planCount: dayEvents.length + dayTasks.length,
        recordCount: dayExternalItems.filter((item) => item.type === "daily_log" || item.type === "photo").length,
        totalCount: items.length,
      } satisfies PeriodDaySummary;
    })
    .filter((summary) => summary.totalCount > 0);
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

function enumerateDates(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  while (cursor <= endDate) {
    dates.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
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
