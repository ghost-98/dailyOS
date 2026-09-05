"use client";

import { useMemo } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { createCalendarEventInDb, deleteCalendarEventFromDb, updateCalendarEventInDb } from "@/features/data/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";
import { createIncomeRecordInDb, deleteIncomeRecordFromDb, fetchExpenseRecordsFromDb, syncLinkedExpenseRecordInDb, updateIncomeRecordInDb } from "@/features/data/ledger/api";
import { createDailyLogInDb, createLifeActivityInDb, deleteDailyLogFromDb, deleteLifeActivitiesBySourceFromDb, deleteLifeActivityFromDb, deleteLifePhotoFromDb, updateDailyLogInDb, updateLifeActivitiesBySourceInDb, updateLifeActivityInDb, updateLifePhotoDetailsInDb, uploadLifePhotosToDb } from "@/features/data/records/api";
import { emptyRecordDataSnapshot, loadRecordDataSnapshot, setRecordDataSnapshotCache } from "@/features/records/state/recordsDataLoader";
import { buildRecordExternalItems } from "@/features/records/state/recordsExternalItems";
import type { RecordLinkedTarget } from "@/features/records/targets/linkedTarget";
import { createTaskInDb, deleteTaskFromDb, updateTaskInDb } from "@/features/data/tasks/api";
import type { DailyLogRecord, IncomeRecord, LifeActivityRecord, LifeMediaUploadInput, LifePhotoRecord, PlanPlace, TaskItem } from "@/types/domain";

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

  const createDailyLog = async (date: string, content: string, linkedTarget?: RecordLinkedTarget) => {
    const savedLog = await createDailyLogInDb(date, content, linkedTarget);
    if (!savedLog) return;
    setLifeData((current) => ({ ...current, dailyLogs: [savedLog, ...current.dailyLogs] }));
  };

  const createIncome = async (record: IncomeRecord) => {
    const savedIncome = await createIncomeRecordInDb(record);
    if (!savedIncome) return;
    setLifeData((current) => ({ ...current, incomes: [savedIncome, ...current.incomes] }));
  };

  const createEvent = async (event: CalendarEvent) => {
    const savedEvent = await createCalendarEventInDb(event);
    if (!savedEvent) return;
    setLifeData((current) => ({ ...current, events: [savedEvent, ...current.events] }));
  };

  const createTask = async (task: TaskItem) => {
    const savedTask = await createTaskInDb(task);
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
    const savedPhotos = await uploadLifePhotosToDb(date, uploads, caption, linkedTarget);
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
    const savedActivity = exists ? await updateLifeActivityInDb(activity) : await createLifeActivityInDb(activity);
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
      deleteIncome,
      deleteEvent,
      deleteTask,
      deleteActivity,
      deleteDailyLog,
      deleteLifePhoto,
      saveActivity,
      updateIncome,
      updateEvent,
      updateTask,
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









