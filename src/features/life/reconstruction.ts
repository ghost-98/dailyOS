import type { CalendarEvent } from "@/features/calendar/data";
import { formatContextMeta } from "@/features/life/insights";
import { formatWon } from "@/features/life/formatters";
import { formatMinutesLabel, parseTimeToMinutes } from "@/features/life/dateTime";
import type { DailyLogRecord, LifeActivityRecord, LifePhotoRecord, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

export type LifeDayReconstructionItem = {
  description: string;
  endMinutes?: number;
  id: string;
  label: string;
  startMinutes?: number;
  timeLabel: string;
  title: string;
  tone: "plan" | "activity" | "record" | "health" | "gap";
};


export function formatRunDuration(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  return seconds > 0 ? `${minutes}분 ${seconds}초` : `${minutes}분`;
}

export function buildDayReconstructionItems(
  date: string,
  events: CalendarEvent[],
  tasks: TaskItem[],
  activities: LifeActivityRecord[],
  logs: DailyLogRecord[],
  photos: LifePhotoRecord[],
  workouts: WorkoutSession[],
  weights: WeightRecord[],
): LifeDayReconstructionItem[] {
  return [
    ...events.map((event) => ({
      description: [event.meta, event.place?.name, event.companions ? `함께 · ${event.companions}` : null, event.expenseAmount ? formatWon(event.expenseAmount) : null].filter(Boolean).join(" · "),
      endMinutes: parseTimeToMinutes(event.endTime),
      id: `event-${event.id}`,
      label: event.type === "event" ? "이벤트" : "일정",
      startMinutes: parseTimeToMinutes(event.time),
      timeLabel: formatContextMeta(date, event.date, event.endDate, event.time, event.endTime, event.isAllDay, event.companions) || "시간 미정",
      title: event.title,
      tone: "plan" as const,
    })),
    ...tasks.map((task) => ({
      description: [task.memo, task.place?.name, task.companions ? `함께 · ${task.companions}` : null, task.expenseAmount ? formatWon(task.expenseAmount) : null].filter(Boolean).join(" · "),
      endMinutes: parseTimeToMinutes(task.endTime),
      id: `task-${task.id}`,
      label: "할일",
      startMinutes: parseTimeToMinutes(task.startTime),
      timeLabel: formatContextMeta(date, task.scheduledDate, task.dueDate, task.startTime, task.endTime, task.isAllDay, task.companions) || "시간 미정",
      title: task.title,
      tone: "plan" as const,
    })),
    ...activities.map((activity) => ({
      description: [activity.placeName, activity.companions ? `함께 · ${activity.companions}` : null, activity.food ? `음식 · ${activity.food}` : null, activity.expenseAmount ? formatWon(activity.expenseAmount) : null, activity.memo].filter(Boolean).join(" · "),
      endMinutes: parseTimeToMinutes(activity.endTime),
      id: `activity-${activity.id}`,
      label: activity.category ?? "활동",
      startMinutes: parseTimeToMinutes(activity.startTime),
      timeLabel: formatActivityTime(activity),
      title: activity.title,
      tone: "activity" as const,
    })),
    ...logs.map((log) => ({
      description: log.linkedTargetTitle ? `연결 · ${log.linkedTargetTitle}` : log.content,
      id: `log-${log.id}`,
      label: "하루기록",
      timeLabel: "날짜 기록",
      title: log.linkedTargetTitle ? "연결 메모" : "하루 메모",
      tone: "record" as const,
    })),
    ...photos.map((photo) => ({
      description: [photo.linkedTargetTitle ? `연결 · ${photo.linkedTargetTitle}` : null, photo.fileName].filter(Boolean).join(" · "),
      id: `photo-${photo.id}`,
      label: photo.mimeType?.startsWith("video/") ? "영상" : "사진",
      timeLabel: "미디어",
      title: photo.caption || photo.fileName,
      tone: "record" as const,
    })),
    ...workouts.map((workout) => ({
      description: [workout.distanceKm ? `${workout.distanceKm}km` : null, formatRunDuration(workout.durationSeconds ?? workout.durationMinutes * 60), workout.memo].filter(Boolean).join(" · "),
      id: `workout-${workout.id}`,
      label: workout.type === "running" ? "러닝" : "운동",
      timeLabel: "건강",
      title: workout.type === "running" ? "러닝 기록" : "운동 기록",
      tone: "health" as const,
    })),
    ...weights.map((weight) => ({
      description: [weight.measuredFasted ? "공복 측정" : null, weight.memo].filter(Boolean).join(" · "),
      id: `weight-${weight.id}`,
      label: "몸무게",
      timeLabel: "아침",
      title: `${weight.weightKg}kg`,
      tone: "health" as const,
    })),
  ].sort(sortReconstructionItems);
}

export function getActivityDurationMinutes(activity: Pick<LifeActivityRecord, "endTime" | "startTime">) {
  const startMinutes = parseTimeToMinutes(activity.startTime);
  const endMinutes = parseTimeToMinutes(activity.endTime);
  if (typeof startMinutes !== "number") return 0;
  if (typeof endMinutes !== "number") return 30;
  return Math.max(0, endMinutes - startMinutes);
}

export function buildDayGapItems(items: LifeDayReconstructionItem[]): LifeDayReconstructionItem[] {
  const timedItems = items
    .filter((item) => typeof item.startMinutes === "number")
    .map((item) => ({ ...item, endMinutes: typeof item.endMinutes === "number" ? item.endMinutes : item.startMinutes! + 30 }))
    .sort((a, b) => a.startMinutes! - b.startMinutes!);
  const gaps: LifeDayReconstructionItem[] = [];

  for (let index = 1; index < timedItems.length; index += 1) {
    const previousEnd = timedItems[index - 1].endMinutes!;
    const nextStart = timedItems[index].startMinutes!;
    if (nextStart - previousEnd >= 90) {
      gaps.push({
        description: "이 구간에 무엇을 했는지 활동기록으로 보강하면 하루 DB가 촘촘해집니다.",
        endMinutes: nextStart,
        id: `gap-${previousEnd}-${nextStart}`,
        label: "빈 시간",
        startMinutes: previousEnd,
        timeLabel: `${formatMinutesLabel(previousEnd)}-${formatMinutesLabel(nextStart)}`,
        title: `${Math.round((nextStart - previousEnd) / 60)}시간 공백`,
        tone: "gap",
      });
    }
  }

  return gaps;
}

export function sortReconstructionItems(a: LifeDayReconstructionItem, b: LifeDayReconstructionItem) {
  const left = typeof a.startMinutes === "number" ? a.startMinutes : 24 * 60 + toneOrder(a.tone);
  const right = typeof b.startMinutes === "number" ? b.startMinutes : 24 * 60 + toneOrder(b.tone);
  return left - right || a.title.localeCompare(b.title);
}

function toneOrder(tone: LifeDayReconstructionItem["tone"]) {
  if (tone === "record") return 1;
  if (tone === "health") return 2;
  if (tone === "gap") return 3;
  return 0;
}

export function formatActivityTime(activity: Pick<LifeActivityRecord, "endTime" | "isAllDay" | "startTime">) {
  if (activity.isAllDay || !activity.startTime) return "시간 미정";
  return activity.endTime ? `${activity.startTime}-${activity.endTime}` : activity.startTime;
}

