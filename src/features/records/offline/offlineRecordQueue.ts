import type { CalendarEvent } from "@/features/calendar/data";
import { createCalendarEventInDb } from "@/features/data/calendar/api";
import { createWeightRecordInDb, createWorkoutSessionInDb } from "@/features/data/health/api";
import { createIncomeRecordInDb } from "@/features/data/ledger/api";
import { createDailyLogInDb, createLifeActivityInDb, uploadLifePhotosToDb } from "@/features/data/records/api";
import { createTaskInDb } from "@/features/data/tasks/api";
import type { RecordLinkedTarget } from "@/features/records/targets/linkedTarget";
import type { IncomeRecord, LifeActivityRecord, LifeMediaUploadInput, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

export type OfflineRecordOperation =
  | { kind: "activity"; record: LifeActivityRecord }
  | { kind: "dailyLog"; content: string; date: string; linkedTarget?: RecordLinkedTarget }
  | { kind: "event"; record: CalendarEvent }
  | { kind: "income"; record: IncomeRecord }
  | { kind: "photos"; caption?: string; date: string; linkedTarget?: RecordLinkedTarget; uploads: LifeMediaUploadInput[] }
  | { kind: "task"; record: TaskItem }
  | { kind: "weight"; record: WeightRecord }
  | { kind: "workout"; record: WorkoutSession };

export type OfflineQueueItem = {
  createdAt: number;
  id: string;
  operation: OfflineRecordOperation;
};

export const OFFLINE_QUEUE_CHANGED_EVENT = "dailyos:offline-queue-changed";
export const OFFLINE_QUEUE_SYNCED_EVENT = "dailyos:offline-queue-synced";

const DATABASE_NAME = "dailyos-offline";
const DATABASE_VERSION = 1;
const STORE_NAME = "record-queue";

export async function enqueueOfflineRecord(operation: OfflineRecordOperation) {
  const item: OfflineQueueItem = {
    createdAt: Date.now(),
    id: crypto.randomUUID(),
    operation,
  };
  const database = await openQueueDatabase();
  await requestToPromise(database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(item));
  notifyQueueChanged();
  return item;
}

export async function getOfflineQueueItems() {
  const database = await openQueueDatabase();
  const items = await requestToPromise<OfflineQueueItem[]>(database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll());
  return items.sort((left, right) => left.createdAt - right.createdAt);
}

export async function processOfflineRecordQueue() {
  if (!navigator.onLine) return { completed: 0, pending: (await getOfflineQueueItems()).length };
  const items = await getOfflineQueueItems();
  let completed = 0;

  for (const item of items) {
    try {
      await executeOfflineOperation(item.operation);
      await deleteQueueItem(item.id);
      completed += 1;
    } catch (error) {
      if (isOfflineError(error)) break;
      console.error("Failed to sync offline record", error);
      break;
    }
  }

  const pending = (await getOfflineQueueItems()).length;
  notifyQueueChanged();
  if (completed > 0) window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_SYNCED_EVENT, { detail: { completed, pending } }));
  return { completed, pending };
}

export function isOfflineError(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch|network|load failed|fetch/i.test(message);
}

async function executeOfflineOperation(operation: OfflineRecordOperation) {
  const result = operation.kind === "activity" ? await createLifeActivityInDb(operation.record)
    : operation.kind === "dailyLog" ? await createDailyLogInDb(operation.date, operation.content, operation.linkedTarget)
      : operation.kind === "event" ? await createCalendarEventInDb(operation.record)
        : operation.kind === "income" ? await createIncomeRecordInDb(operation.record)
          : operation.kind === "photos" ? await uploadLifePhotosToDb(operation.date, operation.uploads, operation.caption, operation.linkedTarget)
            : operation.kind === "task" ? await createTaskInDb(operation.record)
              : operation.kind === "weight" ? await createWeightRecordInDb(operation.record)
                : await createWorkoutSessionInDb(operation.record);
  if (!result || (Array.isArray(result) && result.length === 0)) throw new Error("오프라인 기록을 서버에 저장하지 못했습니다.");
}

async function deleteQueueItem(id: string) {
  const database = await openQueueDatabase();
  await requestToPromise(database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id));
}

function openQueueDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T = undefined>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function notifyQueueChanged() {
  window.dispatchEvent(new Event(OFFLINE_QUEUE_CHANGED_EVENT));
}
