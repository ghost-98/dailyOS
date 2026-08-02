import type { TaskItem } from "@/types/domain";
import type { CalendarEvent } from "@/features/calendar/data";

export type CalendarCategory = "schedule" | "event" | "todo";
export type ExternalCalendarCategory = "activity" | "expense" | "workout" | "weight" | "daily_log" | "photo";
export type ExternalCalendarItem = {
  date: string;
  endTime?: string;
  id: string;
  isAllDay?: boolean;
  meta?: string;
  startTime?: string;
  title: string;
  type: ExternalCalendarCategory;
};
export type DayTimelineItem =
  | { event: CalendarEvent; id: string; sortMinutes: number; timeLabel: string; type: "schedule" | "event" }
  | { id: string; sortMinutes: number; task: TaskItem; timeLabel: string; type: "todo" }
  | { external: ExternalCalendarItem; id: string; sortMinutes: number; timeLabel: string; type: ExternalCalendarCategory };
export type DayTimelineFilter = CalendarCategory | "life";
export type DragPlacement = "before" | "after";
