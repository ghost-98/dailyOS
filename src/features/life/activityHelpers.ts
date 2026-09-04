import { MapPin, MoveRight, NotebookPen, Receipt, UserRound, UtensilsCrossed } from "lucide-react";
import { formatDateKey, formatMinutesLabel } from "@/features/life/dateTime";
import { formatWon } from "@/features/life/formatters";
import { parseCompanions } from "@/features/life/insights";
import type { LifeActivityRecord, PlanPlace } from "@/types/domain";

export function getDefaultActivityTime() {
  const now = new Date();
  now.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);
  return formatMinutesLabel(now.getHours() * 60 + now.getMinutes());
}

export function createMonthCursor(date: string) {
  const parsedDate = new Date(`${date}T00:00:00`);
  if (!Number.isFinite(parsedDate.getTime())) return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  return new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1);
}

export function shiftLifeDateKey(date: string, amount: number) {
  const parsedDate = new Date(`${date}T00:00:00`);
  parsedDate.setDate(parsedDate.getDate() + amount);
  return formatDateKey(parsedDate);
}

export function createActivityPlace(name?: string, address?: string): PlanPlace | undefined {
  if (!name) return undefined;
  return {
    address: address ?? "",
    latitude: 0,
    longitude: 0,
    name,
  };
}

export function buildActivityDetailRows(activity: LifeActivityRecord) {
  const rows = [
    activity.placeName ? { icon: MapPin, label: "장소", value: activity.placeName } : null,
    activity.startPlaceName ? { icon: MapPin, label: "출발", value: `출발 ${activity.startPlaceName}` } : null,
    activity.endPlaceName ? { icon: MoveRight, label: "도착", value: `도착 ${activity.endPlaceName}` } : null,
    activity.transportMode ? { icon: MoveRight, label: "이동 수단", value: activity.transportMode } : null,
    activity.companions ? { icon: UserRound, label: "함께한 사람", value: activity.companions } : null,
    activity.food ? { icon: UtensilsCrossed, label: "식사", value: activity.food } : null,
    activity.expenseAmount ? { icon: Receipt, label: "지출", value: formatWon(activity.expenseAmount) } : null,
    activity.sourceTitle ? { icon: NotebookPen, label: "연결 기록", value: activity.sourceTitle } : null,
    activity.memo ? { icon: NotebookPen, label: "메모", value: activity.memo } : null,
  ].filter(Boolean);

  return rows as Array<{ icon: typeof MapPin; label: string; value: string }>;
}

export function parseActivityCompanions(value?: string) {
  return parseCompanions(value);
}
