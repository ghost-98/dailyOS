import type { CalendarEvent } from "@/features/calendar/data";
import type { LifeActivityRecord, LifePhotoRecord, TaskItem } from "@/types/domain";

export type LifeLinkedTarget = { id: string; title: string; type: "schedule" | "todo" | "event" | "activity" };

export function getPhotoLinkedTargetOptions(
  date: string,
  events: CalendarEvent[],
  tasks: TaskItem[],
  activities: LifeActivityRecord[],
): Array<{ id: string; key: string; label: string; title: string; type: LifeLinkedTarget["type"] }> {
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
      .filter((event) => event.date <= date && (event.endDate ?? event.date) >= date && (event.type === "schedule" || event.type === "event"))
      .map((event) => ({
        id: event.id,
        key: `${event.type}:${event.id}`,
        label: event.type === "event" ? "이벤트" : "일정",
        title: event.title,
        type: event.type === "event" ? ("event" as const) : ("schedule" as const),
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
  if (type === "schedule") return "일정";
  if (type === "todo") return "할 일";
  if (type === "event") return "이벤트";
  if (type === "activity") return "활동";
  return "날짜";
}
