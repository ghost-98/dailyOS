import type { PlanPlace } from "@/types/domain";

export function getMonthDays(year: number, monthIndex: number) {
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingEmptyDays = firstDay.getDay();

  return [
    ...Array.from({ length: leadingEmptyDays }, (_, index) => ({ key: `empty-${index}`, day: null, date: null })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { key: date, day, date };
    }),
  ];
}

export function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatSelectedDate(dateKey: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    month: "long",
    weekday: "long",
  }).format(new Date(`${dateKey}T00:00:00`));
}

export function formatShortDate(dateKey: string) {
  return `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8, 10))}`;
}

export function isDateInRange(date: string, startDate: string, endDate?: string) {
  const normalizedEndDate = endDate || startDate;
  return startDate <= date && date <= normalizedEndDate;
}

export function parseOptionalAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

export function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

export function getPlanPlaceKey(place: PlanPlace) {
  return `${place.providerPlaceId ?? ""}|${place.name}|${place.latitude}|${place.longitude}`;
}

export function uniquePlanPlaces(places: PlanPlace[]) {
  const uniquePlaces = new Map<string, PlanPlace>();
  places.forEach((place) => {
    const key = getPlanPlaceKey(place);
    if (!uniquePlaces.has(key)) uniquePlaces.set(key, place);
  });
  return [...uniquePlaces.values()];
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '"': "&quot;",
      "&": "&amp;",
      "'": "&#39;",
      "<": "&lt;",
      ">": "&gt;",
    };
    return entities[character] ?? character;
  });
}

export function reorderScopedItems<T extends { id: string }>(
  items: T[],
  predicate: (item: T) => boolean,
  draggingId: string,
  targetId: string,
  placement: "before" | "after",
) {
  const scoped = items.filter(predicate);
  const others = items.filter((item) => !predicate(item));
  const draggingItem = scoped.find((item) => item.id === draggingId);
  if (!draggingItem) return items;

  const withoutDragging = scoped.filter((item) => item.id !== draggingId);
  const targetIndex = withoutDragging.findIndex((item) => item.id === targetId);
  if (targetIndex < 0) return items;

  const insertIndex = placement === "before" ? targetIndex : targetIndex + 1;
  const reordered = [...withoutDragging.slice(0, insertIndex), draggingItem, ...withoutDragging.slice(insertIndex)];
  return [...reordered, ...others];
}
