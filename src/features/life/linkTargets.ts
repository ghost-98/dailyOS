import type { CalendarEvent } from "@/features/calendar/data";
import { getLinkedTargetTypeLabel } from "@/features/life/formatters";
import type { LifeActivityRecord, LifePhotoRecord, TaskItem } from "@/types/domain";

export type LifeLinkedTarget = { id: string; title: string; type: "todo" | "event" | "activity" };

export type LifeLinkedTargetOption = {
  id: string;
  key: string;
  label: string;
  title: string;
  type: LifeLinkedTarget["type"];
};

export function getPhotoLinkedTargetOptions(
  date: string,
  events: CalendarEvent[],
  tasks: TaskItem[],
  activities: LifeActivityRecord[],
): LifeLinkedTargetOption[] {
  return [
    ...activities
      .filter((activity) => activity.date === date)
      .map((activity) => ({
        id: activity.id,
        key: `activity:${activity.id}`,
        label: "활동",
        title: activity.title,
        type: "activity" as const,
      })),
    ...events
      .filter((event) => event.date <= date && (event.endDate ?? event.date) >= date && event.type === "event")
      .map((event) => ({
        id: event.id,
        key: `event:${event.id}`,
        label: "이벤트",
        title: event.title,
        type: "event" as const,
      })),
    ...tasks
      .filter((task) => task.scheduledDate <= date && (task.dueDate ?? task.scheduledDate) >= date)
      .map((task) => ({
        id: task.id,
        key: `todo:${task.id}`,
        label: "할 일",
        title: task.title,
        type: "todo" as const,
      })),
  ];
}

export function getPhotoTargetTypeLabel(type?: LifePhotoRecord["linkedTargetType"]) {
  return getLinkedTargetTypeLabel(type);
}
