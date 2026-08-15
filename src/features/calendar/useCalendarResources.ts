"use client";

import type { SetStateAction } from "react";
import { useAsyncData } from "@/hooks/useAsyncData";
import { fetchPeopleFromDb } from "@/features/people/api";
import { fetchTasksFromDb } from "@/features/tasks/api";
import type { PersonRecord, TaskItem } from "@/types/domain";
import { fetchCalendarEventsFromDb } from "./api";
import type { CalendarEvent } from "./data";

export function useCalendarResources() {
  const eventsAndTasks = useAsyncData({
    deps: [],
    initialData: { events: [] as CalendarEvent[], tasks: [] as TaskItem[] },
    load: async () => {
      const [events, tasks] = await Promise.all([fetchCalendarEventsFromDb(), fetchTasksFromDb()]);
      return { events: events ?? [], tasks: tasks ?? [] };
    },
    onError: (error) => console.error("Failed to load schedule data from Supabase", error),
  });

  const people = useAsyncData({
    deps: [],
    initialData: [] as PersonRecord[],
    load: async () => (await fetchPeopleFromDb()) ?? [],
    onError: (error) => console.error("Failed to load people from Supabase", error),
  });

  return {
    events: eventsAndTasks.data.events,
    isLoading: eventsAndTasks.isLoading,
    people: people.data,
    setEvents: (updater: SetStateAction<CalendarEvent[]>) =>
      eventsAndTasks.setData((current) => ({ ...current, events: typeof updater === "function" ? updater(current.events) : updater })),
    setPeople: people.setData,
    setTasks: (updater: SetStateAction<TaskItem[]>) =>
      eventsAndTasks.setData((current) => ({ ...current, tasks: typeof updater === "function" ? updater(current.tasks) : updater })),
    tasks: eventsAndTasks.data.tasks,
  };
}
