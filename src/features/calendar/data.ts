import type { EventType, PlanPlace } from "@/types/domain";

export type CalendarEvent = {
  id: string;
  date: string;
  endDate?: string;
  type: EventType;
  title: string;
  time?: string;
  endTime?: string;
  isAllDay?: boolean;
  meta: string;
  expenseAmount?: number;
  companions?: string;
  place?: PlanPlace;
};
