import type { EventType } from "@/types/domain";

export type CalendarEvent = {
  id: string;
  date: string;
  type: EventType;
  title: string;
  time?: string;
  meta: string;
};

export const calendarEvents: CalendarEvent[] = [];

export const calendarTypeLabels: Record<EventType, string> = {
  schedule: "일정",
  todo: "할 일",
  event: "이벤트",
  health: "운동",
  weight: "몸무게",
  career: "취업",
};
