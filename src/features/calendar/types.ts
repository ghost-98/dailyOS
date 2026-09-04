import type { TaskItem } from "@/types/domain";
import type { CalendarEvent } from "@/features/calendar/data";

export type CalendarCategory = "event" | "todo";
export type ExternalCalendarCategory = "activity" | "expense" | "income" | "workout" | "weight" | "daily_log" | "photo";
export type ExternalCalendarItem = {
  amount?: number;
  caption?: string;
  category?: string;
  companions?: string;
  date: string;
  endTime?: string;
  fileUrl?: string;
  food?: string;
  height?: number;
  id: string;
  isAllDay?: boolean;
  linkedTargetId?: string;
  linkedTargetTitle?: string;
  linkedTargetType?: "todo" | "event" | "activity";
  meta?: string;
  mimeType?: string;
  placeAddress?: string;
  placeLatitude?: number;
  placeLongitude?: number;
  placeName?: string;
  startTime?: string;
  takenAt?: string;
  title: string;
  type: ExternalCalendarCategory;
  width?: number;
};
export type DayTimelineItem =
  | { event: CalendarEvent; id: string; sortMinutes: number; timeLabel: string; type: "event" }
  | { id: string; sortMinutes: number; task: TaskItem; timeLabel: string; type: "todo" }
  | { external: ExternalCalendarItem; id: string; sortMinutes: number; timeLabel: string; type: ExternalCalendarCategory };
export type DragPlacement = "before" | "after";






