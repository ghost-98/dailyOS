import type { ExternalCalendarItem } from "@/features/calendar/types";
import { formatRunDuration, formatWeightMeasurementMeta, formatWon } from "@/features/records/format/recordFormatters";
import type { RecordDataSnapshot } from "@/features/records/state/recordsDataLoader";

export function buildRecordExternalItems(snapshot: Pick<RecordDataSnapshot, "activities" | "dailyLogs" | "expenses" | "incomes" | "lifePhotos" | "weights" | "workouts">): ExternalCalendarItem[] {
  const { activities, dailyLogs, expenses, incomes, lifePhotos, weights, workouts } = snapshot;

  return [
    ...dailyLogs.map((log) => ({
      date: log.date,
      id: log.id,
      linkedTargetId: log.linkedTargetId,
      linkedTargetTitle: log.linkedTargetTitle,
      linkedTargetType: log.linkedTargetType,
      meta: log.content.slice(0, 42),
      title: "하루 기록",
      type: "daily_log" as const,
    })),
    ...lifePhotos.map((photo) => ({
      caption: photo.caption,
      date: photo.date,
      fileUrl: photo.fileUrl,
      height: photo.height,
      id: photo.id,
      linkedTargetId: photo.linkedTargetId,
      linkedTargetTitle: photo.linkedTargetTitle,
      linkedTargetType: photo.linkedTargetType,
      placeLatitude: photo.latitude,
      placeLongitude: photo.longitude,
      placeName: photo.caption || "사진 위치",
      meta: photo.caption || photo.fileName,
      mimeType: photo.mimeType,
      takenAt: photo.takenAt,
      title: "사진 기록",
      type: "photo" as const,
      width: photo.width,
    })),
    ...expenses.map((expense) => ({
      amount: expense.amount,
      category: expense.category,
      date: expense.date,
      id: expense.id,
      linkedTargetId: expense.targetId,
      linkedTargetType: expense.targetType,
      meta: expense.memo,
      title: expense.title,
      type: "expense" as const,
    })),
    ...incomes.map((income) => ({
      amount: income.amount,
      category: income.category,
      date: income.date,
      id: income.id,
      meta: income.memo,
      title: income.title,
      type: "income" as const,
    })),
    ...activities.map((activity) => ({
      amount: activity.expenseAmount,
      category: activity.category,
      companions: activity.companions,
      date: activity.date,
      endTime: activity.endTime,
      food: activity.food,
      id: activity.id,
      isAllDay: activity.isAllDay,
      meta: [activity.placeName, activity.food, activity.expenseAmount ? formatWon(activity.expenseAmount) : null].filter(Boolean).join(" · "),
      placeAddress: activity.placeAddress,
      placeName: activity.placeName,
      startPlaceName: activity.startPlaceName,
      endPlaceName: activity.endPlaceName,
      startTime: activity.startTime,
      sourceId: activity.sourceId,
      sourceTitle: activity.sourceTitle,
      sourceType: activity.sourceType,
      transportMode: activity.transportMode,
      memo: activity.memo,
      title: activity.title,
      type: "activity" as const,
    })),
    ...workouts.map((workout) => ({
      category: workout.type === "running" ? "러닝" : "운동",
      date: workout.date,
      id: workout.id,
      isAllDay: workout.isAllDay,
      meta: workout.type === "running" ? [workout.distanceKm ? `${workout.distanceKm}km` : null, formatRunDuration(workout.durationSeconds ?? workout.durationMinutes * 60)].filter(Boolean).join(" · ") : workout.memo,
      memo: workout.memo,
      startTime: workout.startTime,
      title: workout.type === "running" ? "러닝 기록" : "운동 기록",
      type: "workout" as const,
    })),
    ...weights.map((weight) => ({
      date: weight.date,
      id: weight.id,
      meta: [formatWeightMeasurementMeta(weight.measuredAtTime, weight.measuredFasted), `${weight.weightKg}kg`].filter(Boolean).join(" · "),
      title: "아침 몸무게",
      type: "weight" as const,
    })),
  ];
}







