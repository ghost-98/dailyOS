"use client";

import type { SetStateAction } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { fetchTasksFromDb } from "@/features/data/tasks/api";
import type { TaskItem } from "@/types/domain";
import { fetchCalendarEventsFromDb } from "@/features/data/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";

export function useCalendarResources() {
  const eventsAndTasks = useAsyncData({
    deps: [],
    initialData: { events: [] as CalendarEvent[], tasks: [] as TaskItem[] },
    load: async () => {
      const [events, tasks] = await Promise.all([fetchCalendarEventsFromDb(), fetchTasksFromDb()]);
      return { events: events ?? [], tasks: tasks ?? [] };
    },
    onError: (error) => console.error("Failed to load calendar data from Supabase", error),
  });

  return {
    events: eventsAndTasks.data.events,
    isLoading: eventsAndTasks.isLoading,
    setTasks: (updater: SetStateAction<TaskItem[]>) =>
      eventsAndTasks.setData((current) => ({ ...current, tasks: typeof updater === "function" ? updater(current.tasks) : updater })),
    tasks: eventsAndTasks.data.tasks,
  };
}








