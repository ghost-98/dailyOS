"use client";

import { useEffect, useMemo } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { createCalendarEventInDb, deleteCalendarEventFromDb, updateCalendarEventInDb } from "@/features/data/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";
import { createIncomeRecordInDb, deleteIncomeRecordFromDb, fetchExpenseRecordsFromDb, syncLinkedExpenseRecordInDb, updateIncomeRecordInDb } from "@/features/data/ledger/api";
import { createWeightRecordInDb, createWorkoutSessionInDb, deleteWorkoutSessionFromDb, updateWorkoutSessionInDb } from "@/features/data/health/api";
import { createDailyLogInDb, createLifeActivityInDb, deleteDailyLogFromDb, deleteLifeActivitiesBySourceFromDb, deleteLifeActivityFromDb, deleteLifePhotoFromDb, updateDailyLogInDb, updateLifeActivitiesBySourceInDb, updateLifeActivityInDb, updateLifePhotoDetailsInDb, uploadLifePhotosToDb } from "@/features/data/records/api";
import { clearRecordDataSnapshotCache, emptyRecordDataSnapshot, loadRecordDataSnapshot, setRecordDataSnapshotCache } from "@/features/records/state/recordsDataLoader";
import { buildRecordExternalItems } from "@/features/records/state/recordsExternalItems";
import type { RecordLinkedTarget } from "@/features/records/targets/linkedTarget";
import { createTaskInDb, deleteTaskFromDb, updateTaskInDb } from "@/features/data/tasks/api";
import type { DailyLogRecord, IncomeRecord, LifeActivityRecord, LifeMediaUploadInput, LifePhotoRecord, PlanPlace, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";
import { enqueueOfflineRecord, isOfflineError, OFFLINE_QUEUE_SYNCED_EVENT, type OfflineRecordOperation } from "@/features/records/offline/offlineRecordQueue";

export function useRecordsDataState() {
  const { data, isLoading, reload, setData } = useAsyncData({
    deps: [],
    initialData: emptyRecordDataSnapshot,
    load: loadRecordDataSnapshot,
    onError: (error) => console.error("Failed to load life data from Supabase", error),
  });

  const externalItems = useMemo(() => buildRecordExternalItems(data), [data]);

  const setLifeData = (updater: (current: typeof data) => typeof data) => {
    setData((current) => {
      const next = updater(current);
      setRecordDataSnapshotCache(next);
      return next;
    });
  };

  useEffect(() => {
    const handleOfflineSync = () => {
      clearRecordDataSnapshotCache();
      void reload();
    };
    window.addEventListener(OFFLINE_QUEUE_SYNCED_EVENT, handleOfflineSync);
    return () => window.removeEventListener(OFFLINE_QUEUE_SYNCED_EVENT, handleOfflineSync);
  }, [reload]);

  const queueCreate = async (operation: OfflineRecordOperation, optimisticUpdate?: (current: typeof data) => typeof data) => {
    await enqueueOfflineRecord(operation);
    if (optimisticUpdate) setLifeData(optimisticUpdate);
  };

  const shouldQueueImmediately = () => typeof navigator !== "undefined" && !navigator.onLine;

  const createDailyLog = async (date: string, content: string, linkedTarget?: RecordLinkedTarget) => {
    const operation = { kind: "dailyLog", content, date, linkedTarget } satisfies OfflineRecordOperation;
    const optimisticLog: DailyLogRecord = { content, date, id: "offline-log-" + Date.now(), linkedTargetId: linkedTarget?.id, linkedTargetTitle: linkedTarget?.title, linkedTargetType: linkedTarget?.type };
    if (shouldQueueImmediately()) return queueCreate(operation, (current) => ({ ...current, dailyLogs: [optimisticLog, ...current.dailyLogs] }));
    let savedLog;
    try { savedLog = await createDailyLogInDb(date, content, linkedTarget); }
    catch (error) {
      if (isOfflineError(error)) return queueCreate(operation, (current) => ({ ...current, dailyLogs: [optimisticLog, ...current.dailyLogs] }));
      throw error;
    }
    if (!savedLog) return;
    setLifeData((current) => ({ ...current, dailyLogs: [savedLog, ...current.dailyLogs] }));
  };

  const createIncome = async (record: IncomeRecord) => {
    const operation = { kind: "income", record } satisfies OfflineRecordOperation;
    if (shouldQueueImmediately()) return queueCreate(operation, (current) => ({ ...current, incomes: [record, ...current.incomes] }));
    let savedIncome;
    try { savedIncome = await createIncomeRecordInDb(record); }
    catch (error) {
      if (isOfflineError(error)) return queueCreate(operation, (current) => ({ ...current, incomes: [record, ...current.incomes] }));
      throw error;
    }
    if (!savedIncome) return;
    setLifeData((current) => ({ ...current, incomes: [savedIncome, ...current.incomes] }));
  };

  const createWorkout = async (session: WorkoutSession) => {
    const operation = { kind: "workout", record: session } satisfies OfflineRecordOperation;
    if (shouldQueueImmediately()) return queueCreate(operation, (current) => ({ ...current, workouts: [session, ...current.workouts] }));
    let savedWorkout;
    try { savedWorkout = await createWorkoutSessionInDb(session); }
    catch (error) {
      if (isOfflineError(error)) return queueCreate(operation, (current) => ({ ...current, workouts: [session, ...current.workouts] }));
      throw error;
    }
    if (!savedWorkout) return;
    setLifeData((current) => ({ ...current, workouts: [savedWorkout, ...current.workouts] }));
  };

  const createWeight = async (record: WeightRecord) => {
    const operation = { kind: "weight", record } satisfies OfflineRecordOperation;
    if (shouldQueueImmediately()) return queueCreate(operation, (current) => ({ ...current, weights: [record, ...current.weights] }));
    let savedWeight;
    try { savedWeight = await createWeightRecordInDb(record); }
    catch (error) {
      if (isOfflineError(error)) return queueCreate(operation, (current) => ({ ...current, weights: [record, ...current.weights] }));
      throw error;
    }
    if (!savedWeight) return;
    setLifeData((current) => ({ ...current, weights: [savedWeight, ...current.weights] }));
  };

  const createEvent = async (event: CalendarEvent) => {
    const operation = { kind: "event", record: event } satisfies OfflineRecordOperation;
    if (shouldQueueImmediately()) return queueCreate(operation, (current) => ({ ...current, events: [event, ...current.events] }));
    let savedEvent;
    try { savedEvent = await createCalendarEventInDb(event); }
    catch (error) {
      if (isOfflineError(error)) return queueCreate(operation, (current) => ({ ...current, events: [event, ...current.events] }));
      throw error;
    }
    if (!savedEvent) return;
    setLifeData((current) => ({ ...current, events: [savedEvent, ...current.events] }));
  };

  const createTask = async (task: TaskItem) => {
    const operation = { kind: "task", record: task } satisfies OfflineRecordOperation;
    if (shouldQueueImmediately()) return queueCreate(operation, (current) => ({ ...current, tasks: [task, ...current.tasks] }));
    let savedTask;
    try { savedTask = await createTaskInDb(task); }
    catch (error) {
      if (isOfflineError(error)) return queueCreate(operation, (current) => ({ ...current, tasks: [task, ...current.tasks] }));
      throw error;
    }
    if (!savedTask) return;
    setLifeData((current) => ({ ...current, tasks: [savedTask, ...current.tasks] }));
  };

  const updateTask = async (task: TaskItem) => {
    const savedTask = await updateTaskInDb(task);
    const nextTask = savedTask ?? task;
    await updateLifeActivitiesBySourceInDb({ category: "할 일", companions: nextTask.companions, date: nextTask.scheduledDate, endTime: nextTask.endTime, expenseAmount: nextTask.expenseAmount, isAllDay: nextTask.isAllDay, memo: nextTask.memo, placeAddress: nextTask.place?.address, placeName: nextTask.place?.name, sourceId: nextTask.id, sourceType: "todo", startTime: nextTask.startTime, title: nextTask.title });
    await syncLinkedExpenseRecordInDb({ amount: nextTask.expenseAmount, date: nextTask.scheduledDate, memo: nextTask.memo, targetId: nextTask.id, targetType: "todo", title: nextTask.title });
    setLifeData((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === nextTask.id ? nextTask : item)),
    }));
  };

  const updateEvent = async (event: CalendarEvent) => {
    const savedEvent = await updateCalendarEventInDb(event);
    if (!savedEvent) return;
    await updateLifeActivitiesBySourceInDb({ category: "이벤트", companions: savedEvent.companions, date: savedEvent.date, endTime: savedEvent.endTime, expenseAmount: savedEvent.expenseAmount, isAllDay: savedEvent.isAllDay, memo: savedEvent.meta, placeAddress: savedEvent.place?.address, placeName: savedEvent.place?.name, sourceId: savedEvent.id, sourceType: "event", startTime: savedEvent.time, title: savedEvent.title });
    await syncLinkedExpenseRecordInDb({ amount: savedEvent.expenseAmount, date: savedEvent.date, memo: savedEvent.meta, targetId: savedEvent.id, targetType: "event", title: savedEvent.title });
    setLifeData((current) => ({
      ...current,
      events: current.events.map((item) => (item.id === savedEvent.id ? savedEvent : item)),
    }));
  };

  const deleteTask = async (id: string) => {
    const deleted = await deleteTaskFromDb(id);
    if (!deleted) return;
    await deleteLifeActivitiesBySourceFromDb("todo", id);
    setLifeData((current) => ({
      ...current,
      activities: current.activities.filter((item) => item.sourceId !== id || item.sourceType !== "todo"),
      tasks: current.tasks.filter((item) => item.id !== id),
    }));
  };

  const deleteEvent = async (id: string) => {
    const deleted = await deleteCalendarEventFromDb(id);
    if (!deleted) return;
    await deleteLifeActivitiesBySourceFromDb("event", id);
    setLifeData((current) => ({
      ...current,
      activities: current.activities.filter((item) => item.sourceId !== id || item.sourceType !== "event"),
      events: current.events.filter((item) => item.id !== id),
    }));
  };

  const updateIncome = async (record: IncomeRecord) => {
    const savedIncome = await updateIncomeRecordInDb(record);
    if (!savedIncome) return;
    setLifeData((current) => ({
      ...current,
      incomes: current.incomes.map((item) => (item.id === savedIncome.id ? savedIncome : item)),
    }));
  };

  const deleteIncome = async (id: string) => {
    const deleted = await deleteIncomeRecordFromDb(id);
    if (!deleted) return;
    setLifeData((current) => ({ ...current, incomes: current.incomes.filter((item) => item.id !== id) }));
  };

  const updateWorkout = async (session: WorkoutSession) => {
    const savedWorkout = await updateWorkoutSessionInDb(session);
    if (!savedWorkout) return;
    setLifeData((current) => ({
      ...current,
      workouts: current.workouts.map((item) => (item.id === savedWorkout.id ? savedWorkout : item)),
    }));
  };

  const deleteWorkout = async (id: string) => {
    const deleted = await deleteWorkoutSessionFromDb(id);
    if (!deleted) return;
    setLifeData((current) => ({ ...current, workouts: current.workouts.filter((item) => item.id !== id) }));
  };

  const updateDailyLog = async (log: DailyLogRecord) => {
    const savedLog = await updateDailyLogInDb(log);
    if (!savedLog) return;
    setLifeData((current) => ({
      ...current,
      dailyLogs: current.dailyLogs.map((item) => (item.id === savedLog.id ? savedLog : item)),
    }));
  };

  const deleteDailyLog = async (id: string) => {
    await deleteDailyLogFromDb(id);
    setLifeData((current) => ({ ...current, dailyLogs: current.dailyLogs.filter((item) => item.id !== id) }));
  };

  const uploadLifePhotos = async (date: string, uploads: LifeMediaUploadInput[], caption?: string, linkedTarget?: RecordLinkedTarget) => {
    const operation = { kind: "photos", caption, date, linkedTarget, uploads } satisfies OfflineRecordOperation;
    if (shouldQueueImmediately()) return queueCreate(operation);
    let savedPhotos;
    try { savedPhotos = await uploadLifePhotosToDb(date, uploads, caption, linkedTarget); }
    catch (error) {
      if (isOfflineError(error)) return queueCreate(operation);
      throw error;
    }
    if (!savedPhotos?.length) return;
    setLifeData((current) => ({ ...current, lifePhotos: [...savedPhotos, ...current.lifePhotos] }));
  };

  const deleteLifePhoto = async (photo: LifePhotoRecord) => {
    await deleteLifePhotoFromDb(photo);
    setLifeData((current) => ({ ...current, lifePhotos: current.lifePhotos.filter((item) => item.id !== photo.id) }));
  };

  const updateLifePhotoDetails = async (id: string, date: string, caption?: string, linkedTarget?: RecordLinkedTarget) => {
    const savedPhoto = await updateLifePhotoDetailsInDb(id, date, caption, linkedTarget);
    if (!savedPhoto) return;
    setLifeData((current) => ({
      ...current,
      lifePhotos: current.lifePhotos.map((item) => (item.id === savedPhoto.id ? savedPhoto : item)),
    }));
  };

  const syncSourceFromActivity = async (activity: LifeActivityRecord) => {
    if (!activity.sourceId || !activity.sourceType) return;

    if (activity.sourceType === "todo") {
      const sourceTask = data.tasks.find((task) => task.id === activity.sourceId);
      if (!sourceTask) return;
      const nextTask = {
        ...sourceTask,
        companions: activity.companions,
        dueDate: activity.date,
        endTime: activity.endTime,
        isAllDay: activity.isAllDay,
        memo: activity.memo,
        place: createPlanPlaceFromActivity(activity, sourceTask.place),
        scheduledDate: activity.date,
        startTime: activity.startTime,
        title: activity.title,
      };
      const savedTask = await updateTaskInDb(nextTask);
      setLifeData((current) => ({
        ...current,
        tasks: current.tasks.map((task) => (task.id === sourceTask.id ? savedTask ?? nextTask : task)),
      }));
      return;
    }

    const sourceEvent = data.events.find((event) => event.id === activity.sourceId);
    if (!sourceEvent) return;
    const nextEvent: CalendarEvent = {
      ...sourceEvent,
      companions: activity.companions,
      date: activity.date,
      endDate: activity.date,
      endTime: activity.endTime,
      isAllDay: activity.isAllDay,
      meta: activity.memo ?? sourceEvent.meta,
      place: createPlanPlaceFromActivity(activity, sourceEvent.place),
      time: activity.startTime,
      title: activity.title,
    };
    const savedEvent = await updateCalendarEventInDb(nextEvent);
    setLifeData((current) => ({
      ...current,
      events: current.events.map((event) => (event.id === sourceEvent.id ? savedEvent ?? nextEvent : event)),
    }));
  };

  const deleteSourceFromActivity = async (activity?: LifeActivityRecord) => {
    if (!activity?.sourceId || !activity.sourceType) return;

    if (activity.sourceType === "todo") {
      await deleteTaskFromDb(activity.sourceId);
      setLifeData((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== activity.sourceId) }));
      return;
    }

    await deleteCalendarEventFromDb(activity.sourceId);
    setLifeData((current) => ({ ...current, events: current.events.filter((event) => event.id !== activity.sourceId) }));
  };

  const refreshExpenses = async () => {
    const nextExpenses = await fetchExpenseRecordsFromDb();
    setLifeData((current) => ({ ...current, expenses: nextExpenses ?? [] }));
  };

  const saveActivity = async (activity: LifeActivityRecord) => {
    const exists = data.activities.some((item) => item.id === activity.id);
    const operation = { kind: "activity", record: activity } satisfies OfflineRecordOperation;
    if (!exists && shouldQueueImmediately()) return queueCreate(operation, (current) => ({ ...current, activities: [activity, ...current.activities] }));
    let savedActivity;
    try { savedActivity = exists ? await updateLifeActivityInDb(activity) : await createLifeActivityInDb(activity); }
    catch (error) {
      if (!exists && isOfflineError(error)) return queueCreate(operation, (current) => ({ ...current, activities: [activity, ...current.activities] }));
      throw error;
    }
    const nextActivity = savedActivity ?? activity;
    await syncSourceFromActivity(nextActivity);
    setLifeData((current) => ({
      ...current,
      activities: exists ? current.activities.map((item) => (item.id === nextActivity.id ? nextActivity : item)) : [nextActivity, ...current.activities],
    }));
    await refreshExpenses();
  };

  const deleteActivity = async (id: string) => {
    const targetActivity = data.activities.find((activity) => activity.id === id);
    await deleteLifeActivityFromDb(id);
    await deleteSourceFromActivity(targetActivity);
    setLifeData((current) => ({ ...current, activities: current.activities.filter((item) => item.id !== id) }));
    await refreshExpenses();
  };

  return {
    data,
    externalItems,
    isLoading,
    mutations: {
      createDailyLog,
      createEvent,
      createIncome,
      createTask,
      createWeight,
      createWorkout,
      deleteIncome,
      deleteEvent,
      deleteTask,
      deleteWorkout,
      deleteActivity,
      deleteDailyLog,
      deleteLifePhoto,
      saveActivity,
      updateIncome,
      updateEvent,
      updateTask,
      updateWorkout,
      updateDailyLog,
      updateLifePhotoDetails,
      uploadLifePhotos,
    },
    reload,
    setData,
  };
}

function createPlanPlaceFromActivity(activity: LifeActivityRecord, fallback?: PlanPlace) {
  if (!activity.placeName) return undefined;
  return {
    address: activity.placeAddress ?? fallback?.address ?? "",
    category: fallback?.category,
    latitude: fallback?.latitude ?? 0,
    longitude: fallback?.longitude ?? 0,
    name: activity.placeName,
    phone: fallback?.phone,
    providerPlaceId: fallback?.providerPlaceId,
    url: fallback?.url,
  };
}









