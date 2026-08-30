"use client";

import { useMemo } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { deleteCalendarEventFromDb, updateCalendarEventInDb } from "@/features/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";
import { fetchExpenseRecordsFromDb } from "@/features/ledger/api";
import { createDailyLogInDb, createLifeActivityInDb, deleteDailyLogFromDb, deleteLifeActivityFromDb, deleteLifePhotoFromDb, updateDailyLogInDb, updateLifeActivityInDb, uploadLifePhotosToDb } from "@/features/life/api";
import { emptyLifeDataSnapshot, loadLifeDataSnapshot, setLifeDataSnapshotCache } from "@/features/life/dataLoader";
import { buildLifeExternalItems } from "@/features/life/externalItems";
import type { LifeLinkedTarget } from "@/features/life/linkTargets";
import { deleteTaskFromDb, updateTaskInDb } from "@/features/tasks/api";
import type { DailyLogRecord, LifeActivityRecord, LifeMediaUploadInput, LifePhotoRecord, PlanPlace } from "@/types/domain";

export function useLifeDataState() {
  const { data, isLoading, reload, setData } = useAsyncData({
    deps: [],
    initialData: emptyLifeDataSnapshot,
    load: loadLifeDataSnapshot,
    onError: (error) => console.error("Failed to load life data from Supabase", error),
  });

  const externalItems = useMemo(() => buildLifeExternalItems(data), [data]);

  const setLifeData = (updater: (current: typeof data) => typeof data) => {
    setData((current) => {
      const next = updater(current);
      setLifeDataSnapshotCache(next);
      return next;
    });
  };

  const createDailyLog = async (date: string, content: string, linkedTarget?: LifeLinkedTarget) => {
    const savedLog = await createDailyLogInDb(date, content, linkedTarget);
    if (!savedLog) return;
    setLifeData((current) => ({ ...current, dailyLogs: [savedLog, ...current.dailyLogs] }));
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

  const uploadLifePhotos = async (date: string, uploads: LifeMediaUploadInput[], caption?: string, linkedTarget?: LifeLinkedTarget) => {
    const savedPhotos = await uploadLifePhotosToDb(date, uploads, caption, linkedTarget);
    if (!savedPhotos?.length) return;
    setLifeData((current) => ({ ...current, lifePhotos: [...savedPhotos, ...current.lifePhotos] }));
  };

  const deleteLifePhoto = async (photo: LifePhotoRecord) => {
    await deleteLifePhotoFromDb(photo);
    setLifeData((current) => ({ ...current, lifePhotos: current.lifePhotos.filter((item) => item.id !== photo.id) }));
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
      deleteActivity,
      deleteDailyLog,
      deleteLifePhoto,
      saveActivity,
      updateDailyLog,
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
