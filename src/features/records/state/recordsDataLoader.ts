import { fetchCalendarEventsFromDb } from "@/features/sources/calendarApi";
import type { CalendarEvent } from "@/features/calendar/data";
import { fetchWeightRecordsFromDb, fetchWorkoutSessionsFromDb } from "@/features/sources/healthApi";
import { fetchExpenseRecordsFromDb, fetchIncomeRecordsFromDb } from "@/features/sources/ledgerApi";
import { fetchDailyLogsFromDb, fetchLifeActivitiesFromDb, fetchLifePhotosFromDb } from "@/features/records/api/recordsApi";
import type { RecordViewMode } from "@/features/records/state/recordModes";
import { fetchTasksFromDb } from "@/features/sources/taskApi";
import type { DailyLogRecord, ExpenseRecord, IncomeRecord, LifeActivityRecord, LifePhotoRecord, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

export type RecordDataSnapshot = {
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

export const emptyRecordDataSnapshot: RecordDataSnapshot = {
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

let cachedRecordDataSnapshot: RecordDataSnapshot | null = null;
let cachedLifeDataPromise: Promise<RecordDataSnapshot> | null = null;

export async function loadRecordDataSnapshot(): Promise<RecordDataSnapshot> {
  if (cachedRecordDataSnapshot) return cachedRecordDataSnapshot;
  if (!cachedLifeDataPromise) {
    cachedLifeDataPromise = (async () => {
      const [events, tasks, expenses, incomes, activities, dailyLogs, lifePhotos, weights, workouts] = await Promise.all([
        fetchCalendarEventsFromDb(),
        fetchTasksFromDb(),
        fetchExpenseRecordsFromDb(),
        fetchIncomeRecordsFromDb(),
        fetchLifeActivitiesFromDb(),
        fetchDailyLogsFromDb(),
        fetchLifePhotosFromDb(),
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

  cachedRecordDataSnapshot = await cachedLifeDataPromise;
  cachedLifeDataPromise = null;
  return cachedRecordDataSnapshot;
}

export function setRecordDataSnapshotCache(nextSnapshot: RecordDataSnapshot) {
  cachedRecordDataSnapshot = nextSnapshot;
}

export async function loadRecordDataForMode(mode: RecordViewMode): Promise<RecordDataSnapshot> {
  if (mode === "plans") return emptyRecordDataSnapshot;

  if (mode === "activities") {
    const [activities, expenses, incomes] = await Promise.all([fetchLifeActivitiesFromDb(), fetchExpenseRecordsFromDb(), fetchIncomeRecordsFromDb()]);
    return { ...emptyRecordDataSnapshot, activities: activities ?? [], expenses: expenses ?? [], incomes: incomes ?? [] };
  }

  if (mode === "logs") {
    const [activities, dailyLogs] = await Promise.all([fetchLifeActivitiesFromDb(), fetchDailyLogsFromDb()]);
    return { ...emptyRecordDataSnapshot, activities: activities ?? [], dailyLogs: dailyLogs ?? [] };
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
      ...emptyRecordDataSnapshot,
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
    fetchLifePhotosFromDb(),
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









