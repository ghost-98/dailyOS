export function formatWon(amount: number) {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

export function formatRunDuration(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  if (minutes <= 0) return `${seconds}초`;
  return seconds > 0 ? `${minutes}분 ${seconds}초` : `${minutes}분`;
}

export function formatWeightMeasurementMeta(measuredAtTime?: string, measuredFasted = true) {
  const parts: string[] = [];
  if (measuredAtTime) parts.push(measuredAtTime);
  parts.push(measuredFasted ? "6시간 이상 공복" : "공복 미충족");
  return parts.join(" · ");
}

export function getLinkedTargetTypeLabel(type?: "todo" | "event" | "activity" | "photo" | "daily_log") {
  if (type === "todo") return "할 일";
  if (type === "event") return "이벤트";
  if (type === "activity") return "활동";
  return "날짜";
}

export function formatActivityTime(activity: Pick<LifeActivityRecord, "endTime" | "isAllDay" | "startTime">) {
  if (activity.isAllDay || !activity.startTime) return "시간 미정";
  return activity.endTime ? `${activity.startTime}-${activity.endTime}` : activity.startTime;
}

import type { LifeActivityRecord } from "@/types/domain";

export function formatRecordContextMeta(date: string, startDate: string, endDate?: string, startTime?: string, endTime?: string, isAllDay = true, companions?: string) {
  const range = endDate && endDate !== startDate ? `${startDate}~${endDate}` : date;
  const time = isAllDay ? "하루종일" : endTime ? `${startTime ?? "시간 미정"}-${endTime}` : startTime ?? "시간 미정";
  return [range, time, companions ? `함께한 사람 · ${companions}` : null].filter(Boolean).join(" · ");
}
