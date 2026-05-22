import type { EventType } from "@/types/domain";

export type CalendarEvent = {
  id: string;
  date: string;
  type: EventType;
  title: string;
  time?: string;
  meta: string;
};
