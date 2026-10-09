import type { CalendarCategory } from "@/features/calendar/types";

export const categoryDisplayOrder: CalendarCategory[] = ["todo", "event"];

export const categoryLabels: Record<CalendarCategory, string> = {
  event: "이벤트",
  todo: "할 일",
};
