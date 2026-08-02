import type { CalendarEvent } from "@/features/calendar/data";
import { formatWon } from "@/features/life/formatters";
import type { LifeActivityRecord, PlanPlace, TaskItem } from "@/types/domain";

export type LifePlaceRef = {
  address?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  name: string;
  providerPlaceId?: string;
};

export type PlaceTimelineItem = {
  date: string;
  id: string;
  kind: "schedule" | "task" | "event" | "activity";
  meta: string;
  place: LifePlaceRef;
  title: string;
};

export const kindLabels: Record<PlaceTimelineItem["kind"], string> = {
  activity: "활동",
  event: "이벤트",
  schedule: "일정",
  task: "할 일",
};

export function buildPlaceTimeline(events: CalendarEvent[], tasks: TaskItem[], activities: LifeActivityRecord[]) {
  const eventItems: PlaceTimelineItem[] = events
    .filter((event) => event.place)
    .map((event) => ({
      date: event.date,
      id: event.id,
      kind: event.type === "event" ? "event" : "schedule",
      meta: formatTimelineMeta(formatEventTimeRange(event.time, event.endTime, event.isAllDay), event.companions, event.expenseAmount, event.meta),
      place: event.place!,
      title: event.title,
    }));
  const taskItems: PlaceTimelineItem[] = tasks
    .filter((task) => task.place)
    .map((task) => ({
      date: task.scheduledDate,
      id: task.id,
      kind: "task",
      meta: formatTimelineMeta(formatEventTimeRange(task.startTime, task.endTime, task.isAllDay), task.companions, task.expenseAmount, task.memo),
      place: task.place!,
      title: task.title,
    }));
  const activityItems: PlaceTimelineItem[] = activities
    .map((activity) => {
      const place = getActivityPlaceRef(activity);
      if (!place) return null;
      return {
        date: activity.date,
        id: activity.id,
        kind: "activity",
        meta: formatTimelineMeta(formatEventTimeRange(activity.startTime, activity.endTime, activity.isAllDay), activity.companions, activity.expenseAmount, activity.memo),
        place,
        title: activity.title,
      };
    })
    .filter(Boolean) as PlaceTimelineItem[];

  return [...eventItems, ...taskItems, ...activityItems].sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export function formatEventTimeRange(startTime?: string, endTime?: string, isAllDay = true) {
  if (isAllDay || !startTime) return undefined;
  return endTime ? `${startTime}-${endTime}` : startTime;
}

export function formatTimelineMeta(timeLabel?: string, companions?: string, expenseAmount?: number, memo?: string) {
  return [timeLabel, companions ? `함께: ${companions}` : null, expenseAmount ? `지출 ${formatWon(expenseAmount)}` : null, memo].filter(Boolean).join(" · ");
}

export function getActivityPlaceRef(activity: LifeActivityRecord): LifePlaceRef | null {
  if (!activity.placeName) return null;
  return {
    address: activity.placeAddress,
    name: activity.placeName,
  };
}

export function hasPlanPlaceCoordinates(place: LifePlaceRef): place is PlanPlace {
  return typeof place.latitude === "number" && typeof place.longitude === "number";
}

export function getLifePlaceKey(place: LifePlaceRef) {
  return `${place.providerPlaceId ?? ""}|${place.name}|${place.latitude ?? ""}|${place.longitude ?? ""}|${place.address ?? ""}`;
}

export function uniqueLifePlaceRefs(places: LifePlaceRef[]) {
  const uniquePlaces = new Map<string, LifePlaceRef>();
  places.forEach((place) => {
    const key = getLifePlaceKey(place);
    if (!uniquePlaces.has(key)) uniquePlaces.set(key, place);
  });
  return [...uniquePlaces.values()];
}

export function groupTimelineByPlace(items: PlaceTimelineItem[]) {
  const grouped = new Map<string, { items: PlaceTimelineItem[]; key: string; place: LifePlaceRef }>();

  for (const item of items) {
    const key = getLifePlaceKey(item.place);
    const current = grouped.get(key);
    if (current) {
      current.items.push(item);
    } else {
      grouped.set(key, { key, place: item.place, items: [item] });
    }
  }

  return [...grouped.values()].sort((a, b) => b.items.length - a.items.length || a.place.name.localeCompare(b.place.name));
}

export function uniquePlanPlaces(places: PlanPlace[]) {
  const uniquePlaces = new Map<string, PlanPlace>();
  places.forEach((place) => {
    const key = `${place.providerPlaceId ?? ""}|${place.name}|${place.latitude}|${place.longitude}`;
    if (!uniquePlaces.has(key)) uniquePlaces.set(key, place);
  });
  return [...uniquePlaces.values()];
}
