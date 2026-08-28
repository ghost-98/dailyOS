import type { ExternalCalendarItem } from "@/features/calendar/types";
import { formatWon } from "@/features/life/formatters";
import { formatRunDuration } from "@/features/life/reconstruction";
import type { LifeDataSnapshot } from "@/features/life/dataLoader";

export function buildLifeExternalItems(snapshot: Pick<LifeDataSnapshot, "activities" | "dailyLogs" | "expenses" | "incomes" | "lifePhotos" | "weights" | "workouts">): ExternalCalendarItem[] {
  const { activities, dailyLogs, expenses, incomes, lifePhotos, weights, workouts } = snapshot;

  return [
    ...dailyLogs.map((log) => ({
      date: log.date,
      id: log.id,
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
      date: expense.date,
      id: expense.id,
      meta: `${formatWon(expense.amount)} · ${expense.title}`,
      title: "지출 기록",
      type: "expense" as const,
    })),
    ...incomes.map((income) => ({
      amount: income.amount,
      date: income.date,
      id: income.id,
      meta: `${formatWon(income.amount)} · ${income.title}`,
      title: "수입 기록",
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
      startTime: activity.startTime,
      title: activity.title,
      type: "activity" as const,
    })),
    ...workouts.map((workout) => ({
      date: workout.date,
      id: workout.id,
      meta: workout.type === "running" ? [workout.distanceKm ? `${workout.distanceKm}km` : null, formatRunDuration(workout.durationSeconds ?? workout.durationMinutes * 60)].filter(Boolean).join(" · ") : workout.memo,
      title: workout.type === "running" ? "러닝 기록" : "운동 기록",
      type: "workout" as const,
    })),
    ...weights.map((weight) => ({
      date: weight.date,
      id: weight.id,
      meta: `${weight.weightKg}kg`,
      title: "아침 몸무게",
      type: "weight" as const,
    })),
  ];
}

