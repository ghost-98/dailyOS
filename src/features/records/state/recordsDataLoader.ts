import { fetchCalendarEventsFromDb } from "@/features/data/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";
import { fetchWeightRecordsFromDb, fetchWorkoutSessionsFromDb } from "@/features/data/health/api";
import { fetchExpenseRecordsFromDb, fetchIncomeRecordsFromDb } from "@/features/data/ledger/api";
import { fetchDailyLogsFromDb, fetchLifeActivitiesFromDb, fetchLifePhotosFromDb } from "@/features/data/records/api";
import { fetchTasksFromDb } from "@/features/data/tasks/api";
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
let recordDataLoadedAt = 0;
const RECORD_DATA_CACHE_TTL_MS = 30 * 60 * 1000;

export async function loadRecordDataSnapshot(): Promise<RecordDataSnapshot> {
  if (cachedRecordDataSnapshot && Date.now() - recordDataLoadedAt < RECORD_DATA_CACHE_TTL_MS) return cachedRecordDataSnapshot;
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
  recordDataLoadedAt = Date.now();
  cachedLifeDataPromise = null;
  return cachedRecordDataSnapshot;
}

export function setRecordDataSnapshotCache(nextSnapshot: RecordDataSnapshot) {
  cachedRecordDataSnapshot = nextSnapshot;
}
