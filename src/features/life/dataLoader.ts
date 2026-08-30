import { fetchCalendarEventsFromDb } from "@/features/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";
import { fetchWeightRecordsFromDb, fetchWorkoutSessionsFromDb } from "@/features/health/api";
import { fetchExpenseRecordsFromDb, fetchIncomeRecordsFromDb } from "@/features/ledger/api";
import { fetchDailyLogsFromDb, fetchLifeActivitiesFromDb, fetchLifePhotoMetadataFromDb, fetchLifePhotosFromDb } from "@/features/life/api";
import type { LifeDataMode } from "@/features/life/modes";
import { fetchTasksFromDb } from "@/features/tasks/api";
import type { DailyLogRecord, ExpenseRecord, IncomeRecord, LifeActivityRecord, LifePhotoRecord, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

export type LifeDataSnapshot = {
  activities: LifeActivityRecord[];
  dailyLogs: DailyLogRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  incomes: IncomeRecord[];
  lifePhotos: LifePhotoRecord[];
  tasks: TaskItem[];
  weights: WeightRecord[];
  workouts: WorkoutSession[];
};

export const emptyLifeDataSnapshot: LifeDataSnapshot = {
  activities: [],
  dailyLogs: [],
  events: [],
  expenses: [],
  incomes: [],
  lifePhotos: [],
  tasks: [],
  weights: [],
  workouts: [],
};

let cachedLifeDataSnapshot: LifeDataSnapshot | null = null;
let cachedLifeDataPromise: Promise<LifeDataSnapshot> | null = null;

export async function loadLifeDataSnapshot(): Promise<LifeDataSnapshot> {
  if (cachedLifeDataSnapshot) return cachedLifeDataSnapshot;
  if (!cachedLifeDataPromise) {
    cachedLifeDataPromise = (async () => {
      const [events, tasks, expenses, incomes, activities, dailyLogs, lifePhotos, weights, workouts] = await Promise.all([
        fetchCalendarEventsFromDb(),
        fetchTasksFromDb(),
        fetchExpenseRecordsFromDb(),
        fetchIncomeRecordsFromDb(),
        fetchLifeActivitiesFromDb(),
        fetchDailyLogsFromDb(),
        fetchLifePhotoMetadataFromDb(),
        fetchWeightRecordsFromDb(),
        fetchWorkoutSessionsFromDb(),
      ]);

      return {
        activities: activities ?? [],
        dailyLogs: dailyLogs ?? [],
        events: events ?? [],
        expenses: expenses ?? [],
        incomes: incomes ?? [],
        lifePhotos: lifePhotos ?? [],
        tasks: tasks ?? [],
        weights: weights ?? [],
        workouts: workouts ?? [],
      };
    })();
  }

  cachedLifeDataSnapshot = await cachedLifeDataPromise;
  cachedLifeDataPromise = null;
  return cachedLifeDataSnapshot;
}

export function setLifeDataSnapshotCache(nextSnapshot: LifeDataSnapshot) {
  cachedLifeDataSnapshot = nextSnapshot;
}

export async function loadLifeDataForMode(mode: LifeDataMode): Promise<LifeDataSnapshot> {
  if (mode === "plans") return emptyLifeDataSnapshot;

  if (mode === "activities") {
    const [activities, expenses, incomes] = await Promise.all([fetchLifeActivitiesFromDb(), fetchExpenseRecordsFromDb(), fetchIncomeRecordsFromDb()]);
    return { ...emptyLifeDataSnapshot, activities: activities ?? [], expenses: expenses ?? [], incomes: incomes ?? [] };
  }

  if (mode === "logs") {
    const [activities, dailyLogs] = await Promise.all([fetchLifeActivitiesFromDb(), fetchDailyLogsFromDb()]);
    return { ...emptyLifeDataSnapshot, activities: activities ?? [], dailyLogs: dailyLogs ?? [] };
  }

  if (mode === "places") {
    const [activities, dailyLogs, lifePhotos] = await Promise.all([fetchLifeActivitiesFromDb(), fetchDailyLogsFromDb(), fetchLifePhotoMetadataFromDb()]);
    return { ...emptyLifeDataSnapshot, activities: activities ?? [], dailyLogs: dailyLogs ?? [], lifePhotos: lifePhotos ?? [] };
  }

  if (mode === "gallery") {
    const lifePhotos = await fetchLifePhotosFromDb();
    return { ...emptyLifeDataSnapshot, lifePhotos: lifePhotos ?? [] };
  }

  if (mode === "health") {
    const [weights, workouts] = await Promise.all([fetchWeightRecordsFromDb(), fetchWorkoutSessionsFromDb()]);
    return { ...emptyLifeDataSnapshot, weights: weights ?? [], workouts: workouts ?? [] };
  }

  if (mode === "calendar") {
    const [expenses, incomes, activities, dailyLogs, lifePhotos, weights, workouts] = await Promise.all([
      fetchExpenseRecordsFromDb(),
      fetchIncomeRecordsFromDb(),
      fetchLifeActivitiesFromDb(),
      fetchDailyLogsFromDb(),
      fetchLifePhotosFromDb(),
      fetchWeightRecordsFromDb(),
      fetchWorkoutSessionsFromDb(),
    ]);

    return {
      ...emptyLifeDataSnapshot,
      activities: activities ?? [],
      dailyLogs: dailyLogs ?? [],
      expenses: expenses ?? [],
      incomes: incomes ?? [],
      lifePhotos: lifePhotos ?? [],
      weights: weights ?? [],
      workouts: workouts ?? [],
    };
  }

  const [events, tasks, expenses, incomes, activities, dailyLogs, lifePhotos, weights, workouts] = await Promise.all([
    fetchCalendarEventsFromDb(),
    fetchTasksFromDb(),
    fetchExpenseRecordsFromDb(),
    fetchIncomeRecordsFromDb(),
    fetchLifeActivitiesFromDb(),
    fetchDailyLogsFromDb(),
    fetchLifePhotoMetadataFromDb(),
    fetchWeightRecordsFromDb(),
    fetchWorkoutSessionsFromDb(),
  ]);

  return {
    activities: activities ?? [],
    dailyLogs: dailyLogs ?? [],
    events: events ?? [],
    expenses: expenses ?? [],
    incomes: incomes ?? [],
    lifePhotos: lifePhotos ?? [],
    tasks: tasks ?? [],
    weights: weights ?? [],
    workouts: workouts ?? [],
  };
}
