import type { CalendarEvent } from "@/features/calendar/data";
import { formatRecordContextMeta } from "@/features/records/search/recordsInsights";
import { parseTimeToMinutes } from "@/features/records/time/recordDateTime";
import { formatRunDuration, formatWeightMeasurementMeta, formatWon } from "@/features/records/format/recordFormatters";
import type { DailyLogRecord, LifeActivityRecord, LifePhotoRecord, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

export type RecordDayReconstructionItem = {
  description: string;
  endMinutes?: number;
  id: string;
  label: string;
  startMinutes?: number;
  timeLabel: string;
  title: string;
  tone: "plan" | "activity" | "record" | "health" | "gap";
};

export function buildRecordDayReconstructionItems(
  date: string,
  events: CalendarEvent[],
  tasks: TaskItem[],
  activities: LifeActivityRecord[],
  logs: DailyLogRecord[],
  photos: LifePhotoRecord[],
  workouts: WorkoutSession[],
  weights: WeightRecord[],
): RecordDayReconstructionItem[] {
  const linkedActivitySourceKeys = new Set(
    activities
      .filter((activity) => activity.sourceId && activity.sourceType)
      .map((activity) => `${activity.sourceType}:${activity.sourceId}`),
  );
  const visibleEvents = events.filter((event) => !linkedActivitySourceKeys.has(`event:${event.id}`));
  const visibleTasks = tasks.filter((task) => !linkedActivitySourceKeys.has(`todo:${task.id}`));

  return [
    ...visibleEvents.map((event) => ({
      description: [event.meta, event.place?.name, event.companions ? `함께 · ${event.companions}` : null, event.expenseAmount ? formatWon(event.expenseAmount) : null].filter(Boolean).join(" · "),
      endMinutes: parseTimeToMinutes(event.endTime),
      id: `event-${event.id}`,
      label: "이벤트",
      startMinutes: parseTimeToMinutes(event.time),
      timeLabel: formatRecordContextMeta(date, event.date, event.endDate, event.time, event.endTime, event.isAllDay, event.companions) || "시간 미정",
      title: event.title,
      tone: "plan" as const,
    })),
    ...visibleTasks.map((task) => ({
      description: [task.memo, task.place?.name, task.companions ? `함께 · ${task.companions}` : null, task.expenseAmount ? formatWon(task.expenseAmount) : null].filter(Boolean).join(" · "),
      endMinutes: parseTimeToMinutes(task.endTime),
      id: `task-${task.id}`,
      label: "할 일",
      startMinutes: parseTimeToMinutes(task.startTime),
      timeLabel: formatRecordContextMeta(date, task.scheduledDate, task.dueDate, task.startTime, task.endTime, task.isAllDay, task.companions) || "시간 미정",
      title: task.title,
      tone: "plan" as const,
    })),
    ...activities.map((activity) => ({
      description: [
        activity.sourceTitle ? `출처 · ${activity.sourceTitle}` : null,
        activity.placeName,
        activity.companions ? `함께 · ${activity.companions}` : null,
        activity.food ? `먹은 것 · ${activity.food}` : null,
        activity.expenseAmount ? formatWon(activity.expenseAmount) : null,
        activity.memo,
      ].filter(Boolean).join(" · "),
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
      description: [formatWeightMeasurementMeta(weight.measuredAtTime, weight.measuredFasted), weight.memo].filter(Boolean).join(" · "),
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

function sortReconstructionItems(a: RecordDayReconstructionItem, b: RecordDayReconstructionItem) {
  const left = typeof a.startMinutes === "number" ? a.startMinutes : 24 * 60 + toneOrder(a.tone);
  const right = typeof b.startMinutes === "number" ? b.startMinutes : 24 * 60 + toneOrder(b.tone);
  return left - right || a.title.localeCompare(b.title);
}

function toneOrder(tone: RecordDayReconstructionItem["tone"]) {
  if (tone === "record") return 1;
  if (tone === "health") return 2;
  if (tone === "gap") return 3;
  return 0;
}

export function formatActivityTime(activity: Pick<LifeActivityRecord, "endTime" | "isAllDay" | "startTime">) {
  if (activity.isAllDay || !activity.startTime) return "시간 미정";
  return activity.endTime ? `${activity.startTime}-${activity.endTime}` : activity.startTime;
}







