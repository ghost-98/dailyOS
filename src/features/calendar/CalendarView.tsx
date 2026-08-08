"use client";

import Image from "next/image";
import type { DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListChecks,
  Plus,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import type { EventType, PersonRecord, PlanPlace, TaskItem, TaskPriority, TaskStatus } from "@/types/domain";
import { deleteLinkedExpenseRecordInDb, syncLinkedExpenseRecordInDb } from "@/features/ledger/api";
import { createLifeActivityInDb, deleteLifeActivitiesBySourceFromDb, updateLifeActivitiesBySourceInDb } from "@/features/life/api";
import { createPersonInDb, fetchPeopleFromDb } from "@/features/people/api";
import { PeoplePickerField } from "@/features/people/PeoplePickerField";
import { createTaskInDb, deleteTaskFromDb, fetchTasksFromDb, updateTaskInDb } from "@/features/tasks/api";
import { FormSectionTitle } from "@/features/calendar/components";
import { DayTimelineSection } from "@/features/calendar/DayTimelineSection";
import { PlaceSearchField } from "@/features/calendar/PlaceSearchField";
import { SelectedDatePlacesMap } from "@/features/calendar/SelectedDatePlacesMap";
import { formatDateKey, formatSelectedDate, getMonthDays, isDateInRange, parseOptionalAmount, reorderScopedItems, uniquePlanPlaces } from "@/features/calendar/utils";
import { createCalendarEventInDb, deleteCalendarEventFromDb, fetchCalendarEventsFromDb, updateCalendarEventInDb } from "./api";
import { categoryDisplayOrder, categoryLabels, getCalendarSummaryLabel } from "@/features/calendar/presentation";
import type { CalendarCategory, DayTimelineItem, DragPlacement, ExternalCalendarCategory, ExternalCalendarItem } from "@/features/calendar/types";
import type { CalendarEvent } from "./data";
type CalendarViewProps = {
  allowedTypes?: EventType[];
  defaultSelectedDate?: string | null;
  description?: string;
  externalItems?: ExternalCalendarItem[];
  headerVariant?: "page" | "tab";
  keepDateSelected?: boolean;
  showEventAddButton?: boolean;
  showSelectedDatePlacesMap?: boolean;
  title?: string;
  viewMode?: "manage" | "database";
};

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const initialMonth = new Date();
const yearOptions = Array.from({ length: 151 }, (_, index) => new Date().getFullYear() - 75 + index);
type LifeCalendarScope = "day" | "week" | "month" | "range";
type LifeCalendarAxis = "all" | "activity" | "places" | "records" | "finance" | "health";
const naverMapClientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID;

type NaverLatLng = unknown;
type NaverLatLngBounds = {
  extend: (latLng: NaverLatLng) => void;
};
type NaverMap = {
  fitBounds: (bounds: NaverLatLngBounds, padding?: number | Record<string, number>) => void;
  setCenter: (latLng: NaverLatLng) => void;
  setZoom: (zoom: number) => void;
};
type NaverMarker = {
  setMap: (map: NaverMap | null) => void;
};
type NaverPolyline = {
  setMap: (map: NaverMap | null) => void;
};

declare global {
  interface Window {
    naver?: {
      maps: {
        Event: {
          addListener: (target: NaverMarker, eventName: string, listener: () => void) => void;
        };
        LatLng: new (latitude: number, longitude: number) => NaverLatLng;
        LatLngBounds: new () => NaverLatLngBounds;
        Map: new (element: HTMLElement, options: Record<string, unknown>) => NaverMap;
        Marker: new (options: Record<string, unknown>) => NaverMarker;
        Point: new (x: number, y: number) => unknown;
        Polyline: new (options: Record<string, unknown>) => NaverPolyline;
      };
    };
  }
}

export function CalendarView({
  allowedTypes,
  defaultSelectedDate = null,
  description,
  externalItems = [],
  headerVariant = "page",
  keepDateSelected = false,
  showEventAddButton = false,
  showSelectedDatePlacesMap = true,
  viewMode = "manage",
  title = "일정",
}: CalendarViewProps) {
  const isDatabaseView = viewMode === "database";
  const categories = useMemo(() => getCategories(allowedTypes), [allowedTypes]);
  const [calendarCategoryFilters, setCalendarCategoryFilters] = useState<CalendarCategory[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [isEventSheetOpen, setIsEventSheetOpen] = useState(false);
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(defaultSelectedDate);
  const [sheetDefaultType, setSheetDefaultType] = useState<CalendarCategory>("schedule");
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<{ id: string; type: "event" | "task" } | null>(null);
  const [draggingItem, setDraggingItem] = useState<{ id: string; type: CalendarCategory } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; placement: DragPlacement } | null>(null);
  const [activityConversionMessage, setActivityConversionMessage] = useState("");
  const [convertingToActivity, setConvertingToActivity] = useState<{ id: string; type: "event" | "task" } | null>(null);
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [dbScope, setDbScope] = useState<LifeCalendarScope>("day");
  const [dbAxis, setDbAxis] = useState<LifeCalendarAxis>("all");
  const [rangeStart, setRangeStart] = useState(defaultSelectedDate ?? formatDateKey(new Date()));
  const [rangeEnd, setRangeEnd] = useState(defaultSelectedDate ?? formatDateKey(new Date()));

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchCalendarEventsFromDb(), fetchTasksFromDb()])
      .then(([dbEvents, dbTasks]) => {
        if (!isMounted) return;
        setEvents(dbEvents ?? []);
        setTasks(dbTasks ?? []);
      })
      .catch((error) => console.error("Failed to load schedule data from Supabase", error))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchPeopleFromDb()
      .then((records) => {
        if (!isMounted) return;
        setPeople(records ?? []);
      })
      .catch((error) => console.error("Failed to load people from Supabase", error));

    return () => {
      isMounted = false;
    };
  }, []);

  const visibleEvents = events.filter((event) => categories.includes(event.type as CalendarCategory));
  const visibleCalendarCategories = calendarCategoryFilters.length > 0 ? calendarCategoryFilters : categories;
  const orderedVisibleCalendarCategories = categoryDisplayOrder.filter((type) => visibleCalendarCategories.includes(type));
  const monthDays = getMonthDays(currentMonth.getFullYear(), currentMonth.getMonth());
  const todayKey = useMemo(() => formatDateKey(new Date()), []);
  const detailAnchorDate = selectedDate ?? todayKey;
  const periodBounds = useMemo(() => {
    if (!isDatabaseView) return { end: detailAnchorDate, start: detailAnchorDate };
    if (dbScope === "week") return getWeekBounds(detailAnchorDate);
    if (dbScope === "month") return getMonthBounds(currentMonth);
    if (dbScope === "range") return normalizeRangeBounds(rangeStart, rangeEnd);
    return { end: detailAnchorDate, start: detailAnchorDate };
  }, [currentMonth, dbScope, detailAnchorDate, isDatabaseView, rangeEnd, rangeStart]);
  const selectedSchedules = useMemo(() => (selectedDate ? visibleEvents.filter((event) => isDateInRange(selectedDate, event.date, event.endDate) && event.type === "schedule") : []), [selectedDate, visibleEvents]);
  const selectedEvents = useMemo(() => (selectedDate ? visibleEvents.filter((event) => isDateInRange(selectedDate, event.date, event.endDate) && event.type === "event") : []), [selectedDate, visibleEvents]);
  const selectedTasks = useMemo(() => (selectedDate ? tasks.filter((task) => isDateInRange(selectedDate, task.scheduledDate, task.dueDate)) : []), [selectedDate, tasks]);
  const selectedExternalItems = useMemo(() => (selectedDate ? externalItems.filter((item) => item.date === selectedDate) : []), [externalItems, selectedDate]);
  const periodSchedules = useMemo(
    () => visibleEvents.filter((event) => event.type === "schedule" && isRangeOverlapping(event.date, event.endDate, periodBounds.start, periodBounds.end)),
    [periodBounds.end, periodBounds.start, visibleEvents],
  );
  const periodEvents = useMemo(
    () => visibleEvents.filter((event) => event.type === "event" && isRangeOverlapping(event.date, event.endDate, periodBounds.start, periodBounds.end)),
    [periodBounds.end, periodBounds.start, visibleEvents],
  );
  const periodTasks = useMemo(
    () => tasks.filter((task) => isRangeOverlapping(task.scheduledDate, task.dueDate, periodBounds.start, periodBounds.end)),
    [periodBounds.end, periodBounds.start, tasks],
  );
  const periodExternalItems = useMemo(
    () => externalItems.filter((item) => item.date >= periodBounds.start && item.date <= periodBounds.end),
    [externalItems, periodBounds.end, periodBounds.start],
  );
  const selectedTimelineItems = useMemo(
    () =>
      [
        ...selectedSchedules.map((event) => createEventTimelineItem(event)),
        ...selectedTasks.map((task) => createTaskTimelineItem(task)),
        ...selectedEvents.map((event) => createEventTimelineItem(event)),
        ...selectedExternalItems.map((external) => createExternalTimelineItem(external)),
      ].sort((first, second) => first.sortMinutes - second.sortMinutes || getTimelineTypeOrder(first.type) - getTimelineTypeOrder(second.type)),
    [selectedEvents, selectedExternalItems, selectedSchedules, selectedTasks],
  );
  const periodTimelineItems = useMemo(
    () =>
      [
        ...periodSchedules.map((event) => createEventTimelineItem(event)),
        ...periodTasks.map((task) => createTaskTimelineItem(task)),
        ...periodEvents.map((event) => createEventTimelineItem(event)),
        ...periodExternalItems.map((external) => createExternalTimelineItem(external)),
      ].sort((first, second) => {
        const firstDate = getTimelineItemDate(first);
        const secondDate = getTimelineItemDate(second);
        if (firstDate !== secondDate) return firstDate.localeCompare(secondDate);
        return first.sortMinutes - second.sortMinutes || getTimelineTypeOrder(first.type) - getTimelineTypeOrder(second.type);
      }),
    [periodEvents, periodExternalItems, periodSchedules, periodTasks],
  );
  const detailSections = useMemo(
    () =>
      [
        { type: "schedule" as const, events: selectedSchedules },
        { type: "todo" as const, tasks: selectedTasks },
        { type: "event" as const, events: selectedEvents },
      ].filter((section) => categories.includes(section.type)),
    [categories, selectedEvents, selectedSchedules, selectedTasks],
  );

  const countsByCategory = useMemo(() => {
    if (isDatabaseView) {
      return {
        schedule: periodSchedules.length,
        event: periodEvents.length,
        todo: periodTasks.length,
      };
    }
    if (!selectedDate) return { schedule: 0, event: 0, todo: 0 };
    return {
      schedule: visibleEvents.filter((event) => isDateInRange(selectedDate, event.date, event.endDate) && event.type === "schedule").length,
      event: visibleEvents.filter((event) => isDateInRange(selectedDate, event.date, event.endDate) && event.type === "event").length,
      todo: selectedTasks.length,
    };
  }, [isDatabaseView, periodEvents.length, periodSchedules.length, periodTasks.length, selectedDate, selectedTasks.length, visibleEvents]);
  const selectedPlanPlaces = useMemo(() => {
    const sourceItems = isDatabaseView ? [...periodSchedules, ...periodEvents, ...periodTasks] : [...selectedSchedules, ...selectedEvents, ...selectedTasks];
    return uniquePlanPlaces(sourceItems.map((item) => item.place).filter((place): place is PlanPlace => Boolean(place)));
  }, [isDatabaseView, periodEvents, periodSchedules, periodTasks, selectedEvents, selectedSchedules, selectedTasks]);
  const dbAxisCounts = useMemo(
    () => ({
      activity: periodExternalItems.filter((item) => item.type === "activity").length,
      all: periodTimelineItems.length,
      finance: periodExternalItems.filter((item) => item.type === "expense" || item.type === "income").length,
      health: periodExternalItems.filter((item) => item.type === "workout" || item.type === "weight").length,
      places: periodTimelineItems.filter((item) => hasTimelinePlace(item)).length,
      records: periodExternalItems.filter((item) => item.type === "daily_log" || item.type === "photo").length,
    }),
    [periodExternalItems, periodTimelineItems],
  );
  const dbPeopleNames = useMemo(
    () =>
      Array.from(
        new Set(
          [...periodSchedules, ...periodEvents, ...periodTasks]
            .flatMap((item) => parseCompanionNames(item.companions))
            .filter(Boolean),
        ),
      ),
    [periodEvents, periodSchedules, periodTasks],
  );
  const periodDaySummaries = useMemo(
    () => buildPeriodDaySummaries(periodBounds.start, periodBounds.end, periodSchedules, periodEvents, periodTasks, periodExternalItems),
    [periodBounds.end, periodBounds.start, periodEvents, periodExternalItems, periodSchedules, periodTasks],
  );
  const visibleTimelineItems = useMemo(() => {
    if (!isDatabaseView) return selectedTimelineItems;
    switch (dbAxis) {
      case "activity":
        return periodTimelineItems.filter((item) => item.type === "activity");
      case "places":
        return periodTimelineItems.filter((item) => hasTimelinePlace(item));
      case "records":
        return periodTimelineItems.filter((item) => item.type === "daily_log" || item.type === "photo");
      case "finance":
        return periodTimelineItems.filter((item) => item.type === "expense" || item.type === "income");
      case "health":
        return periodTimelineItems.filter((item) => item.type === "workout" || item.type === "weight");
      default:
        return periodTimelineItems;
    }
  }, [dbAxis, isDatabaseView, periodTimelineItems, selectedTimelineItems]);

  const moveMonth = (direction: -1 | 1) => {
    setCurrentMonth((month) => {
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + direction, 1);
      if (keepDateSelected) {
        setSelectedDate(formatDateKey(nextMonth));
      } else {
        setSelectedDate(null);
      }
      return nextMonth;
    });
  };

  const handleDateClick = (date: string) => {
    setSelectedDate((current) => (keepDateSelected ? date : current === date ? null : date));
  };

  const toggleCalendarCategoryFilter = (type: CalendarCategory) => {
    setCalendarCategoryFilters((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]));
  };

  const openCreateEventSheet = (type: CalendarCategory) => {
    setIsAddMenuOpen(false);

    if (type === "todo") {
      setEditingTask(null);
      setIsTaskSheetOpen(true);
      return;
    }

    setSheetDefaultType(type);
    setEditingEvent(null);
    setIsEventSheetOpen(true);
  };

  const handleCreatePerson = async (name: string) => {
    const created = await createPersonInDb({ name });
    if (created) {
      setPeople((current) => {
        if (current.some((person) => person.id === created.id)) return current;
        return [...current, created].sort((left, right) => left.name.localeCompare(right.name));
      });
    }
    return created;
  };

  const saveEvent = async (event: CalendarEvent) => {
    if (isSavingEvent) return;
    setIsSavingEvent(true);
    try {
      const exists = events.some((item) => item.id === event.id);
      const previousEvent = events.find((item) => item.id === event.id);
      const savedEvent = exists ? await updateCalendarEventInDb(event) : await createCalendarEventInDb(event);
      const nextEvent = savedEvent ?? event;
      const nextTargetType = nextEvent.type === "event" ? "event" : "schedule";
      const previousTargetType = previousEvent?.type === "event" ? "event" : previousEvent ? "schedule" : nextTargetType;
      if (previousEvent && previousTargetType !== nextTargetType) await deleteLinkedExpenseRecordInDb(previousTargetType, nextEvent.id);
      await syncLinkedExpenseRecordInDb({
        amount: nextEvent.expenseAmount,
        date: nextEvent.date,
        memo: nextEvent.meta,
        targetId: nextEvent.id,
        targetType: nextTargetType,
        title: nextEvent.title,
      });
      await updateLifeActivitiesBySourceInDb({ ...createActivitySourceFromEvent(nextEvent), previousSourceType: previousTargetType });

      setEvents((current) => (exists ? current.map((item) => (item.id === event.id ? nextEvent : item)) : [nextEvent, ...current]));
      setIsEventSheetOpen(false);
      setEditingEvent(null);
    } finally {
      setIsSavingEvent(false);
    }
  };

  const deleteEvent = async (id: string) => {
    if (deletingPlan) return;
    setDeletingPlan({ id, type: "event" });
    try {
      const targetEvent = events.find((event) => event.id === id);
      await deleteCalendarEventFromDb(id);
      if (targetEvent) await deleteLinkedExpenseRecordInDb(targetEvent.type === "event" ? "event" : "schedule", id);
      if (targetEvent) await deleteLifeActivitiesBySourceFromDb(targetEvent.type === "event" ? "event" : "schedule", id);
      setEvents((current) => current.filter((item) => item.id !== id));
    } finally {
      setDeletingPlan(null);
    }
  };

  const saveTask = async (task: TaskItem) => {
    if (isSavingTask) return;
    setIsSavingTask(true);
    try {
      const exists = tasks.some((item) => item.id === task.id);
      const savedTask = exists ? await updateTaskInDb(task) : await createTaskInDb(task);
      const nextTask = savedTask ?? task;
      await syncLinkedExpenseRecordInDb({
        amount: nextTask.expenseAmount,
        date: nextTask.scheduledDate,
        memo: nextTask.memo,
        targetId: nextTask.id,
        targetType: "todo",
        title: nextTask.title,
      });
      await updateLifeActivitiesBySourceInDb(createActivitySourceFromTask(nextTask));

      setTasks((current) => (exists ? current.map((item) => (item.id === task.id ? nextTask : item)) : [nextTask, ...current]));
      setIsTaskSheetOpen(false);
      setEditingTask(null);
    } finally {
      setIsSavingTask(false);
    }
  };

  const deleteTask = async (id: string) => {
    if (deletingPlan) return;
    setDeletingPlan({ id, type: "task" });
    try {
      await deleteTaskFromDb(id);
      await deleteLinkedExpenseRecordInDb("todo", id);
      await deleteLifeActivitiesBySourceFromDb("todo", id);
      setTasks((current) => current.filter((item) => item.id !== id));
    } finally {
      setDeletingPlan(null);
    }
  };

  const toggleTaskDone = async (task: TaskItem) => {
    const nextTask: TaskItem = {
      ...task,
      status: task.status === "done" ? "todo" : "done",
      completedAt: task.status === "done" ? undefined : new Date().toISOString(),
    };
    const savedTask = await updateTaskInDb(nextTask);
    setTasks((current) => current.map((item) => (item.id === task.id ? savedTask ?? nextTask : item)));
  };

  const createActivityFromEvent = async (event: CalendarEvent) => {
    const conversionDate = selectedDate && isDateInRange(selectedDate, event.date, event.endDate) ? selectedDate : event.date;
    const targetType = event.type === "event" ? "event" : "schedule";
    setConvertingToActivity({ id: event.id, type: "event" });
    setActivityConversionMessage("");

    try {
      const activity = await createLifeActivityInDb({
        id: `activity-${Date.now()}`,
        date: conversionDate,
        startTime: event.isAllDay ? undefined : event.time,
        endTime: event.isAllDay ? undefined : event.endTime,
        isAllDay: event.isAllDay,
        title: event.title,
        category: event.type === "event" ? "이벤트" : "일정",
        companions: event.companions,
        expenseAmount: event.expenseAmount,
        memo: event.meta ? `${event.meta} · ${categoryLabels[event.type as CalendarCategory]}에서 활동으로 기록` : `${categoryLabels[event.type as CalendarCategory]}에서 활동으로 기록`,
        placeAddress: event.place?.address,
        placeName: event.place?.name,
        sourceId: event.id,
        sourceTitle: event.title,
        sourceType: targetType,
      });

      if (event.expenseAmount) {
        const nextEvent = { ...event, expenseAmount: undefined } satisfies CalendarEvent;
        const savedEvent = await updateCalendarEventInDb(nextEvent);
        await deleteLinkedExpenseRecordInDb(targetType, event.id);
        setEvents((current) => current.map((item) => (item.id === event.id ? savedEvent ?? nextEvent : item)));
      }

      setActivityConversionMessage(`${activity?.title ?? event.title}을 활동 기록으로 저장했어요.`);
    } catch (error) {
      console.error("Failed to create activity from calendar event", error);
      setActivityConversionMessage("활동 기록으로 저장하지 못했습니다.");
    } finally {
      setConvertingToActivity(null);
    }
  };

  const createActivityFromTask = async (task: TaskItem) => {
    const conversionDate = selectedDate && isDateInRange(selectedDate, task.scheduledDate, task.dueDate) ? selectedDate : task.scheduledDate;
    setConvertingToActivity({ id: task.id, type: "task" });
    setActivityConversionMessage("");

    try {
      const activity = await createLifeActivityInDb({
        id: `activity-${Date.now()}`,
        date: conversionDate,
        startTime: task.isAllDay ? undefined : task.startTime,
        endTime: task.isAllDay ? undefined : task.endTime,
        isAllDay: task.isAllDay,
        title: task.title,
        category: "할 일",
        companions: task.companions,
        expenseAmount: task.expenseAmount,
        memo: task.memo ? `${task.memo} · 할 일에서 활동으로 기록` : "할 일에서 활동으로 기록",
        placeAddress: task.place?.address,
        placeName: task.place?.name,
        sourceId: task.id,
        sourceTitle: task.title,
        sourceType: "todo",
      });

      const nextTask = {
        ...task,
        completedAt: task.completedAt ?? new Date().toISOString(),
        expenseAmount: undefined,
        status: "done" as const,
      };
      const savedTask = await updateTaskInDb(nextTask);
      await deleteLinkedExpenseRecordInDb("todo", task.id);
      setTasks((current) => current.map((item) => (item.id === task.id ? savedTask ?? nextTask : item)));
      setActivityConversionMessage(`${activity?.title ?? task.title}을 활동 기록으로 저장했어요.`);
    } catch (error) {
      console.error("Failed to create activity from task", error);
      setActivityConversionMessage("활동 기록으로 저장하지 못했습니다.");
    } finally {
      setConvertingToActivity(null);
    }
  };

  const handleDragOverItem = (dragEvent: DragEvent<HTMLElement>, targetId: string, targetType: CalendarCategory) => {
    dragEvent.preventDefault();
    if (!draggingItem || draggingItem.type !== targetType || draggingItem.id === targetId) return;

    const rect = dragEvent.currentTarget.getBoundingClientRect();
    const placement: DragPlacement = dragEvent.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setDropTarget({ id: targetId, placement });
  };

  const clearDragState = () => {
    setDraggingItem(null);
    setDropTarget(null);
  };

  const getDropPlacement = (dragEvent: DragEvent<HTMLElement>) => {
    const rect = dragEvent.currentTarget.getBoundingClientRect();
    return dragEvent.clientY < rect.top + rect.height / 2 ? "before" : "after";
  };

  const reorderEvent = (targetId: string, placementOverride?: DragPlacement) => {
    const placement = placementOverride ?? dropTarget?.placement;
    if (!draggingItem || draggingItem.type === "todo" || !selectedDate || draggingItem.id === targetId || !placement) return;
    const targetType = draggingItem.type;
    setEvents((current) =>
      reorderScopedItems(
        current,
        (event) => event.date === selectedDate && event.type === targetType,
        draggingItem.id,
        targetId,
        placement,
      ),
    );
    clearDragState();
  };

  const reorderTask = (targetId: string, placementOverride?: DragPlacement) => {
    const placement = placementOverride ?? dropTarget?.placement;
    if (!draggingItem || draggingItem.type !== "todo" || !selectedDate || draggingItem.id === targetId || !placement) return;
    setTasks((current) => reorderScopedItems(current, (task) => task.scheduledDate === selectedDate, draggingItem.id, targetId, placement));
    clearDragState();
  };

  return (
    <div className="calendar-page">
      <header className={headerVariant === "tab" ? "life-tab-heading calendar-header" : "calendar-header page-header"}>
        <div>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        {isDatabaseView ? (
          <div className="life-calendar-header-modes">
            {([
              ["day", "일간"],
              ["week", "주간"],
              ["month", "월간"],
              ["range", "선택 기간"],
            ] as const).map(([scope, label]) => (
              <button
                className={dbScope === scope ? "life-calendar-header-modes__button life-calendar-header-modes__button--active" : "life-calendar-header-modes__button"}
                key={scope}
                onClick={() => setDbScope(scope)}
                type="button"
              >
                {label}
              </button>
            ))}
            {dbScope === "range" ? (
              <div className="life-calendar-header-modes__range">
                <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
                <span>~</span>
                <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
              </div>
            ) : null}
          </div>
        ) : null}
        {!isDatabaseView ? <div className="header-actions">
          <div className="add-menu">
            <button className="header-action" aria-expanded={isAddMenuOpen} onClick={() => setIsAddMenuOpen((current) => !current)} type="button">
              <Plus aria-hidden size={18} />
              추가
            </button>
            {isAddMenuOpen ? (
              <div className="add-menu__panel" role="menu">
                <button onClick={() => openCreateEventSheet("schedule")} role="menuitem" type="button">
                  <span className="calendar-dot calendar-dot--schedule" />
                  일정 추가
                </button>
                {showEventAddButton && categories.includes("event") ? (
                  <button onClick={() => openCreateEventSheet("event")} role="menuitem" type="button">
                    <span className="calendar-dot calendar-dot--event" />
                    이벤트 추가
                  </button>
                ) : null}
                {categories.includes("todo") ? (
                  <button onClick={() => openCreateEventSheet("todo")} role="menuitem" type="button">
                    <span className="calendar-dot calendar-dot--todo" />
                    할 일 추가
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div> : null}
      </header>

      <div className={`calendar-layout ${selectedDate || isDatabaseView ? "calendar-layout--detail-open" : ""} ${isDatabaseView ? "calendar-layout--database" : ""}`}>
        <SectionCard className="calendar-board">
          <div className="calendar-toolbar">
            <button aria-label="이전 달" onClick={() => moveMonth(-1)} type="button">
              <ChevronLeft aria-hidden size={20} />
            </button>
            <button className="calendar-month-trigger" onClick={() => setIsMonthPickerOpen(true)} type="button">
              <span>{currentMonth.getFullYear()}</span>
              <strong>{currentMonth.getMonth() + 1}월</strong>
            </button>
            <button aria-label="다음 달" onClick={() => moveMonth(1)} type="button">
              <ChevronRight aria-hidden size={20} />
            </button>
          </div>

          {!isDatabaseView ? <div className="calendar-filters" aria-label="표시 항목">
            {categories.map((type) => (
              <button
                className={`calendar-filter calendar-filter--${type} ${
                  calendarCategoryFilters.includes(type) ? "calendar-filter--active" : ""
                } ${calendarCategoryFilters.length > 0 && !calendarCategoryFilters.includes(type) ? "calendar-filter--muted" : ""}`}
                key={type}
                onClick={() => toggleCalendarCategoryFilter(type)}
                type="button"
              >
                {categoryLabels[type]}
              </button>
            ))}
          </div> : null}

          <div className="calendar-weekdays">
            {weekdays.map((weekday, index) => (
              <span className={index === 0 ? "calendar-weekday calendar-weekday--sun" : "calendar-weekday"} key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {monthDays.map((cell) => {
              const dayEvents = cell.date
                ? visibleEvents.filter((event) => isDateInRange(cell.date as string, event.date, event.endDate) && visibleCalendarCategories.includes(event.type as CalendarCategory))
                : [];
              const dayTasks = cell.date && visibleCalendarCategories.includes("todo") ? tasks.filter((task) => isDateInRange(cell.date as string, task.scheduledDate, task.dueDate)) : [];
              const dayExternalItems = cell.date ? externalItems.filter((item) => item.date === cell.date) : [];
              const eventSummaries = summarizeDay(dayEvents, dayTasks, orderedVisibleCalendarCategories, dayExternalItems);
              return (
                <button
                  className={`calendar-day ${cell.date === todayKey ? "calendar-day--today" : ""} ${cell.date === selectedDate ? "calendar-day--selected" : ""}`}
                  disabled={!cell.date}
                  key={cell.key}
                  onClick={() => (cell.date ? handleDateClick(cell.date) : undefined)}
                  type="button"
                >
                  {cell.day ? <span className={`calendar-day__number ${cell.date?.endsWith(`-${String(cell.day).padStart(2, "0")}`) && new Date(`${cell.date}T00:00:00`).getDay() === 0 ? "calendar-day__number--sunday" : ""}`}>{cell.day}</span> : null}
                  <div className="calendar-day__events">
                    {eventSummaries.slice(0, 4).map((summary) => (
                      <span
                        aria-label={`${getCalendarSummaryLabel(summary.type)} ${summary.count}개`}
                        className="calendar-day__event-chip"
                        key={summary.type}
                        title={`${getCalendarSummaryLabel(summary.type)} ${summary.count}개`}
                      >
                        <span className={`calendar-dot calendar-dot--${summary.type}`} />
                        {summary.count > 1 ? <span className="calendar-day__event-count">+{summary.count}</span> : null}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {selectedDate || isDatabaseView ? (
          <aside className="calendar-detail">
            <SectionCard className="date-detail-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{isDatabaseView ? getDatabaseEyebrow(dbScope) : "선택한 날짜"}</p>
                  <h2>{isDatabaseView ? getScopeTitle(dbScope, periodBounds.start, periodBounds.end, currentMonth) : formatSelectedDate(selectedDate ?? detailAnchorDate)}</h2>
                </div>
              </div>

              {!isDatabaseView && showSelectedDatePlacesMap ? <SelectedDatePlacesMap places={selectedPlanPlaces} /> : null}

              {isDatabaseView && dbScope !== "day" ? (
                <div className="life-calendar-db-panel">
                  <div className="life-calendar-db-summary" aria-label="기록 축">
                    {([
                      ["activity", "활동", dbAxisCounts.activity],
                      ["places", "장소축", dbAxisCounts.places],
                      ["records", "기록 사진", dbAxisCounts.records],
                      ["finance", "수입·지출", dbAxisCounts.finance],
                      ["health", "건강", dbAxisCounts.health],
                    ] as const).map(([axis, label, count]) => (
                      <button
                        className={dbAxis === axis ? "life-calendar-db-summary__card life-calendar-db-summary__card--active" : "life-calendar-db-summary__card"}
                        key={axis}
                        onClick={() => setDbAxis((current) => (current === axis ? "all" : axis))}
                        type="button"
                      >
                        <span>{label}</span>
                        <strong>{count}</strong>
                      </button>
                    ))}
                  </div>

                  <div className="life-calendar-db-overview">
                    <article>
                      <span>계획</span>
                      <strong>{periodSchedules.length + periodEvents.length + periodTasks.length}</strong>
                      <p>일정 · 이벤트 · 할 일</p>
                    </article>
                    <article>
                      <span>선택 축 기록</span>
                      <strong>{visibleTimelineItems.length}</strong>
                      <p>{getAxisDescription(dbAxis)}</p>
                    </article>
                    <article>
                      <span>장소</span>
                      <strong>{selectedPlanPlaces.length}</strong>
                      <p>기간 안에서 남은 동선</p>
                    </article>
                    <article>
                      <span>함께한 사람</span>
                      <strong>{dbPeopleNames.length}</strong>
                      <p>계획과 활동에 함께 남은 이름</p>
                    </article>
                  </div>
                </div>
              ) : null}

              {!isDatabaseView ? <ManageCalendarOverview counts={countsByCategory} items={selectedTimelineItems} selectedDate={selectedDate ?? detailAnchorDate} /> : null}

              <div className="date-event-list">
                {isDatabaseView ? (
                  <LifeCalendarDatabasePanel
                    currentMonth={currentMonth}
                    daySummaries={periodDaySummaries}
                    isLoading={isLoading}
                    items={visibleTimelineItems}
                    onJumpToDate={(date) => {
                      setSelectedDate(date);
                      setCurrentMonth(new Date(`${date}T00:00:00`));
                    }}
                    peopleNames={dbPeopleNames}
                    places={selectedPlanPlaces}
                    scope={dbScope}
                  />
                ) : (
                  <DayTimelineSection
                    countsByCategory={countsByCategory}
                    deletingPlan={deletingPlan}
                    draggingItem={draggingItem}
                    dropTarget={dropTarget}
                    externalCount={selectedExternalItems.length}
                    isConvertingToActivity={convertingToActivity}
                    isLoading={isLoading}
                    items={visibleTimelineItems}
                    onClearDrag={clearDragState}
                    onCreateActivityFromEvent={(event) => void createActivityFromEvent(event)}
                    onCreateActivityFromTask={(task) => void createActivityFromTask(task)}
                    onDeleteEvent={deleteEvent}
                    onDeleteTask={deleteTask}
                    onDragOverItem={handleDragOverItem}
                    onEditEvent={(event) => {
                      setEditingEvent(event);
                      setSheetDefaultType(event.type as CalendarCategory);
                      setIsEventSheetOpen(true);
                    }}
                    onEditTask={(target) => {
                      setEditingTask(target);
                      setIsTaskSheetOpen(true);
                    }}
                    onReorderEvent={reorderEvent}
                    onReorderTask={reorderTask}
                    onResolveDropPlacement={getDropPlacement}
                    onSetDragging={setDraggingItem}
                    onToggleDone={toggleTaskDone}
                    readOnly={false}
                    visibleCategories={detailSections.map((section) => section.type)}
                  />
                )}
                {activityConversionMessage ? <p className="life-health-message">{activityConversionMessage}</p> : null}
              </div>

            </SectionCard>
          </aside>
        ) : null}
      </div>

      {isEventSheetOpen ? (
        <EventCreateSheet
          allowedTypes={categories.filter((type) => type !== "todo")}
          defaultDate={selectedDate ?? formatDateKey(currentMonth)}
          defaultType={sheetDefaultType === "todo" ? "schedule" : sheetDefaultType}
          event={editingEvent}
          isSaving={isSavingEvent}
          onClose={() => {
            setIsEventSheetOpen(false);
            setEditingEvent(null);
          }}
          onCreatePerson={handleCreatePerson}
          onSave={saveEvent}
          people={people}
        />
      ) : null}

      {isTaskSheetOpen ? (
        <TaskCreateSheet
          defaultDate={selectedDate ?? formatDateKey(currentMonth)}
          isSaving={isSavingTask}
          onClose={() => {
            setIsTaskSheetOpen(false);
            setEditingTask(null);
          }}
          onCreatePerson={handleCreatePerson}
          onSave={saveTask}
          people={people}
          task={editingTask}
        />
      ) : null}

      {isMonthPickerOpen ? (
        <MonthPickerSheet
          currentMonth={currentMonth}
          onClose={() => setIsMonthPickerOpen(false)}
          onSelect={(month) => {
            setCurrentMonth(month);
            setSelectedDate(null);
            setIsMonthPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function EventCreateSheet({
  allowedTypes,
  defaultDate,
  defaultType,
  event,
  isSaving,
  onClose,
  onCreatePerson,
  onSave,
  people,
}: {
  allowedTypes: CalendarCategory[];
  defaultDate: string;
  defaultType: CalendarCategory;
  event: CalendarEvent | null;
  isSaving: boolean;
  onClose: () => void;
  onCreatePerson: (name: string) => Promise<PersonRecord | null>;
  onSave: (event: CalendarEvent) => void;
  people: PersonRecord[];
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? defaultDate);
  const [endDate, setEndDate] = useState(event?.endDate ?? event?.date ?? defaultDate);
  const [time, setTime] = useState(event?.time ?? "");
  const [endTime, setEndTime] = useState(event?.endTime ?? "");
  const [isDateRange, setIsDateRange] = useState(Boolean(event?.endDate && event.endDate !== event.date));
  const [isAllDay, setIsAllDay] = useState(event ? event.isAllDay ?? !event.time : true);
  const [hasEndTime, setHasEndTime] = useState(Boolean(event?.endTime));
  const [type, setType] = useState<CalendarCategory>(event?.type === "event" ? "event" : defaultType);
  const [meta, setMeta] = useState(event?.meta ?? "");
  const [expenseAmount, setExpenseAmount] = useState(event?.expenseAmount !== undefined ? String(event.expenseAmount) : "");
  const [companions, setCompanions] = useState<string[]>(parseCompanionNames(event?.companions));
  const [place, setPlace] = useState<PlanPlace | undefined>(event?.place);

  const saveCurrentEvent = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onSave({
      id: event?.id ?? `calendar-${Date.now()}`,
      date,
      endDate: isDateRange && endDate && endDate !== date ? endDate : undefined,
      type,
      title: trimmedTitle,
      time: isAllDay ? undefined : time || undefined,
      endTime: !isAllDay && hasEndTime ? endTime || undefined : undefined,
      isAllDay,
      meta: meta.trim() || "메모 없음",
      expenseAmount: parseOptionalAmount(expenseAmount),
      companions: companions.length > 0 ? companions.join(", ") : undefined,
      place,
    });
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="event-sheet-title" aria-modal="true" className="event-sheet schedule-sheet" role="dialog" onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header schedule-sheet__header">
          <div>
            <h2 id="event-sheet-title">{event ? "항목 수정" : `${categoryLabels[type]} 추가`}</h2>
            <p>{event ? "등록된 내용을 수정합니다." : "날짜와 종류를 정해 계획에 추가합니다."}</p>
          </div>
          <button className="event-sheet__icon-button" aria-label="닫기" onClick={onClose} type="button">
            <X aria-hidden size={18} />
          </button>
        </header>

        <div className="event-sheet__body schedule-sheet__body">
          <FormSectionTitle title="기본 정보" description="제목과 메모를 먼저 잡아두세요." />
          <div className="event-form-card event-form-card--title schedule-form-card schedule-form-card--primary">
            <label className="schedule-field schedule-field--wide">
              <span>제목</span>
              <input autoFocus placeholder={`${categoryLabels[type]} 제목`} value={title} onChange={(changeEvent) => setTitle(changeEvent.target.value)} />
            </label>
            <label className="schedule-field schedule-field--wide">
              <span>메모</span>
              <input placeholder="링크, 준비물, 간단한 설명" value={meta} onChange={(changeEvent) => setMeta(changeEvent.target.value)} />
            </label>
          </div>

          <FormSectionTitle title="장소" description="이날 간 장소 탭과 지도에 함께 연결됩니다." />
          <PlaceSearchField selectedPlace={place} onSelect={setPlace} />

          <FormSectionTitle title="관계와 지출" description="지출은 가계부에 자동으로 연동됩니다." />
          <div className="event-form-card schedule-form-card schedule-form-card--grid">
            <label className="event-form-row event-form-row--field schedule-field">
              <div className="event-form-row__label">
                <UsersRound aria-hidden size={18} />
                <span>함께한 사람</span>
              </div>
              <PeoplePickerField onChange={setCompanions} onCreatePerson={onCreatePerson} people={people} selectedNames={companions} />
            </label>

            <label className="event-form-row event-form-row--field schedule-field">
              <div className="event-form-row__label">
                <WalletCards aria-hidden size={18} />
                <span>지출</span>
              </div>
              <input inputMode="numeric" placeholder="0" value={expenseAmount} onChange={(changeEvent) => setExpenseAmount(changeEvent.target.value.replace(/[^\d]/g, ""))} />
            </label>
          </div>

          <FormSectionTitle title="날짜" description="기본은 단일 날짜이며, 기간 설정을 켜면 종료 날짜를 함께 기록합니다." />
          <div className="event-form-card schedule-form-card schedule-form-card--grid schedule-date-grid">
            <div className="schedule-date-row">
              <label className="event-form-row event-form-row--field schedule-field">
                <div className="event-form-row__label">
                  <CalendarDays aria-hidden size={18} />
                  <span>날짜</span>
                </div>
                <input
                  type="date"
                  value={date}
                  onChange={(changeEvent) => {
                    setDate(changeEvent.target.value);
                    if (!isDateRange) setEndDate(changeEvent.target.value);
                  }}
                />
              </label>

              {isDateRange ? (
                <label className="event-form-row event-form-row--field schedule-field">
                  <div className="event-form-row__label">
                    <CalendarDays aria-hidden size={18} />
                    <span>종료 날짜</span>
                  </div>
                  <input type="date" value={endDate} onChange={(changeEvent) => setEndDate(changeEvent.target.value)} />
                </label>
              ) : null}

              <label className="event-form-row event-form-row--select schedule-field schedule-toggle-row">
                <div className="event-form-row__label">
                  <CalendarDays aria-hidden size={18} />
                  <span>기간</span>
                </div>
                <label className="schedule-option-toggle">
                  <input
                    checked={isDateRange}
                    type="checkbox"
                    onChange={(changeEvent) => {
                      setIsDateRange(changeEvent.target.checked);
                      if (!changeEvent.target.checked) setEndDate(date);
                    }}
                  />
                  <span>기간 설정</span>
                </label>
              </label>
            </div>

          </div>

          <FormSectionTitle title="시간" description="기본은 하루종일이며, 체크를 해제하면 시작 시간과 종료 시간을 설정할 수 있습니다." />
          <div className="event-form-card schedule-form-card schedule-form-card--grid schedule-time-grid">
            <div className="schedule-time-row">
              <label className="event-form-row event-form-row--select schedule-field schedule-toggle-row">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>시간</span>
                </div>
                <label className="schedule-option-toggle">
                  <input
                    checked={isAllDay}
                    type="checkbox"
                    onChange={(changeEvent) => {
                      setIsAllDay(changeEvent.target.checked);
                      if (changeEvent.target.checked) {
                        setTime("");
                        setEndTime("");
                        setHasEndTime(false);
                      }
                    }}
                  />
                  <span>하루종일</span>
                </label>
              </label>

              <label className="event-form-row event-form-row--field schedule-field">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>시작 시간</span>
                </div>
                <input disabled={isAllDay} type="time" value={time} onChange={(changeEvent) => setTime(changeEvent.target.value)} />
              </label>

              {!isAllDay && hasEndTime ? (
                <label className="event-form-row event-form-row--field schedule-field">
                  <div className="event-form-row__label">
                    <Clock3 aria-hidden size={18} />
                    <span>종료 시간</span>
                  </div>
                  <input type="time" value={endTime} onChange={(changeEvent) => setEndTime(changeEvent.target.value)} />
                </label>
              ) : null}

              <label className="event-form-row event-form-row--select schedule-field schedule-toggle-row">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>종료</span>
                </div>
                <label className="schedule-option-toggle">
                  <input
                    checked={!isAllDay && hasEndTime}
                    disabled={isAllDay}
                    type="checkbox"
                    onChange={(changeEvent) => {
                      setHasEndTime(changeEvent.target.checked);
                      if (!changeEvent.target.checked) setEndTime("");
                    }}
                  />
                  <span>종료시간 설정</span>
                </label>
              </label>
            </div>

          </div>

          <div className="event-form-card schedule-form-card schedule-form-card--grid">
            <label className="event-form-row event-form-row--select schedule-field">
              <div className="event-form-row__label">
                <Bell aria-hidden size={18} />
                <span>종류</span>
              </div>
              <select value={type} onChange={(changeEvent) => setType(changeEvent.target.value as CalendarCategory)}>
                {allowedTypes.map((allowedType) => (
                  <option key={allowedType} value={allowedType}>
                    {categoryLabels[allowedType]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <footer className="event-sheet__footer">
          <button className="event-sheet__secondary-button" disabled={isSaving} onClick={onClose} type="button">
            취소
          </button>
          <button className="event-sheet__primary-button" disabled={isSaving} onClick={saveCurrentEvent} type="button">
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function TaskCreateSheet({
  defaultDate,
  isSaving,
  onClose,
  onCreatePerson,
  onSave,
  people,
  task,
}: {
  defaultDate: string;
  isSaving: boolean;
  onClose: () => void;
  onCreatePerson: (name: string) => Promise<PersonRecord | null>;
  onSave: (task: TaskItem) => void;
  people: PersonRecord[];
  task: TaskItem | null;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [memo, setMemo] = useState(task?.memo ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "normal");
  const [scheduledDate, setScheduledDate] = useState(task?.scheduledDate ?? defaultDate);
  const [dueDate, setDueDate] = useState(task?.dueDate ?? task?.scheduledDate ?? defaultDate);
  const [startTime, setStartTime] = useState(task?.startTime ?? "");
  const [endTime, setEndTime] = useState(task?.endTime ?? "");
  const [isDateRange, setIsDateRange] = useState(Boolean(task?.dueDate && task.dueDate !== task.scheduledDate));
  const [isAllDay, setIsAllDay] = useState(task ? task.isAllDay ?? !task.startTime : true);
  const [hasEndTime, setHasEndTime] = useState(Boolean(task?.endTime));
  const [expenseAmount, setExpenseAmount] = useState(task?.expenseAmount !== undefined ? String(task.expenseAmount) : "");
  const [companions, setCompanions] = useState<string[]>(parseCompanionNames(task?.companions));
  const [place, setPlace] = useState<PlanPlace | undefined>(task?.place);

  const saveTask = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onSave({
      id: task?.id ?? `task-${Date.now()}`,
      title: trimmedTitle,
      status,
      priority,
      scheduledDate,
      dueDate: isDateRange && dueDate && dueDate !== scheduledDate ? dueDate : undefined,
      startTime: isAllDay ? undefined : startTime || undefined,
      endTime: !isAllDay && hasEndTime ? endTime || undefined : undefined,
      isAllDay,
      completedAt: status === "done" ? task?.completedAt ?? new Date().toISOString() : undefined,
      deferredCount: task?.deferredCount ?? 0,
      memo: memo.trim() || undefined,
      expenseAmount: parseOptionalAmount(expenseAmount),
      companions: companions.length > 0 ? companions.join(", ") : undefined,
      place,
    });
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="task-sheet-title" aria-modal="true" className="event-sheet schedule-sheet task-sheet" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header schedule-sheet__header">
          <div>
            <h2 id="task-sheet-title">{task ? "할 일 수정" : "할 일 추가"}</h2>
            <p>{task ? "상태와 날짜를 조정합니다." : "예정일 기준으로 할 일을 추가합니다."}</p>
          </div>
          <button className="event-sheet__icon-button" aria-label="닫기" onClick={onClose} type="button">
            <X aria-hidden size={18} />
          </button>
        </header>

        <div className="event-sheet__body schedule-sheet__body">
          <FormSectionTitle title="기본 정보" description="할 일의 핵심 내용과 메모를 적어두세요." />
          <div className="event-form-card event-form-card--title schedule-form-card schedule-form-card--primary">
            <label className="schedule-field schedule-field--wide">
              <span>제목</span>
              <input autoFocus placeholder="할 일 제목" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="schedule-field schedule-field--wide">
              <span>메모</span>
              <input placeholder="필요한 내용을 적어주세요." value={memo} onChange={(event) => setMemo(event.target.value)} />
            </label>
          </div>

          <FormSectionTitle title="장소" description="장소 탭의 날짜별 동선에 함께 반영됩니다." />
          <PlaceSearchField selectedPlace={place} onSelect={setPlace} />

          <FormSectionTitle title="관계와 지출" description="금액을 입력하면 가계부에 연결 지출로 기록됩니다." />
          <div className="event-form-card schedule-form-card schedule-form-card--grid">
            <label className="event-form-row event-form-row--field schedule-field">
              <div className="event-form-row__label">
                <UsersRound aria-hidden size={18} />
                <span>함께한 사람</span>
              </div>
              <PeoplePickerField onChange={setCompanions} onCreatePerson={onCreatePerson} people={people} selectedNames={companions} />
            </label>

            <label className="event-form-row event-form-row--field schedule-field">
              <div className="event-form-row__label">
                <WalletCards aria-hidden size={18} />
                <span>지출</span>
              </div>
              <input inputMode="numeric" placeholder="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value.replace(/[^\d]/g, ""))} />
            </label>
          </div>

          <FormSectionTitle title="진행 상태" description="상태와 우선순위로 오늘 할 일을 정리하세요." />
          <div className="event-form-card schedule-form-card schedule-form-card--grid">
            <label className="event-form-row event-form-row--select schedule-field">
              <div className="event-form-row__label">
                <ListChecks aria-hidden size={18} />
                <span>상태</span>
              </div>
              <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)}>
                <option value="todo">할 일</option>
                <option value="inProgress">진행 중</option>
                <option value="done">완료</option>
              </select>
            </label>

            <label className="event-form-row event-form-row--select schedule-field">
              <div className="event-form-row__label">
                <Bell aria-hidden size={18} />
                <span>우선순위</span>
              </div>
              <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
                <option value="high">높음</option>
                <option value="normal">보통</option>
                <option value="low">낮음</option>
              </select>
            </label>
          </div>

          <FormSectionTitle title="날짜" description="기본은 단일 날짜이며, 기간 설정을 켜면 종료 날짜를 함께 기록합니다." />
          <div className="event-form-card schedule-form-card schedule-form-card--grid schedule-date-grid">
            <div className="schedule-date-row">
              <label className="event-form-row event-form-row--field schedule-field">
                <div className="event-form-row__label">
                  <CalendarDays aria-hidden size={18} />
                  <span>날짜</span>
                </div>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(event) => {
                    setScheduledDate(event.target.value);
                    if (!isDateRange) setDueDate(event.target.value);
                  }}
                />
              </label>

              {isDateRange ? (
                <label className="event-form-row event-form-row--field schedule-field">
                  <div className="event-form-row__label">
                    <CalendarDays aria-hidden size={18} />
                    <span>종료 날짜</span>
                  </div>
                  <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                </label>
              ) : null}

              <label className="event-form-row event-form-row--select schedule-field schedule-toggle-row">
                <div className="event-form-row__label">
                  <CalendarDays aria-hidden size={18} />
                  <span>기간</span>
                </div>
                <label className="schedule-option-toggle">
                  <input
                    checked={isDateRange}
                    type="checkbox"
                    onChange={(event) => {
                      setIsDateRange(event.target.checked);
                      if (!event.target.checked) setDueDate(scheduledDate);
                    }}
                  />
                  <span>기간 설정</span>
                </label>
              </label>
            </div>

          </div>

          <FormSectionTitle title="시간" description="기본은 하루종일이며, 체크를 해제하면 시작 시간과 종료 시간을 설정할 수 있습니다." />
          <div className="event-form-card schedule-form-card schedule-form-card--grid schedule-time-grid">
            <div className="schedule-time-row">
              <label className="event-form-row event-form-row--select schedule-field schedule-toggle-row">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>시간</span>
                </div>
                <label className="schedule-option-toggle">
                  <input
                    checked={isAllDay}
                    type="checkbox"
                    onChange={(event) => {
                      setIsAllDay(event.target.checked);
                      if (event.target.checked) {
                        setStartTime("");
                        setEndTime("");
                        setHasEndTime(false);
                      }
                    }}
                  />
                  <span>하루종일</span>
                </label>
              </label>

              <label className="event-form-row event-form-row--field schedule-field">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>시작 시간</span>
                </div>
                <input disabled={isAllDay} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </label>

              {!isAllDay && hasEndTime ? (
                <label className="event-form-row event-form-row--field schedule-field">
                  <div className="event-form-row__label">
                    <Clock3 aria-hidden size={18} />
                    <span>종료 시간</span>
                  </div>
                  <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
                </label>
              ) : null}

              <label className="event-form-row event-form-row--select schedule-field schedule-toggle-row">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>종료</span>
                </div>
                <label className="schedule-option-toggle">
                  <input
                    checked={!isAllDay && hasEndTime}
                    disabled={isAllDay}
                    type="checkbox"
                    onChange={(event) => {
                      setHasEndTime(event.target.checked);
                      if (!event.target.checked) setEndTime("");
                    }}
                  />
                  <span>종료시간 설정</span>
                </label>
              </label>
            </div>
          </div>
        </div>

        <footer className="event-sheet__footer">
          <button className="event-sheet__secondary-button" disabled={isSaving} onClick={onClose} type="button">
            취소
          </button>
          <button className="event-sheet__primary-button" disabled={isSaving} onClick={saveTask} type="button">
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </footer>
      </section>
    </div>
  );
}

export function MonthPickerSheet({
  currentMonth,
  onClose,
  onSelect,
}: {
  currentMonth: Date;
  onClose: () => void;
  onSelect: (month: Date) => void;
}) {
  const [year, setYear] = useState(currentMonth.getFullYear());
  const [month, setMonth] = useState(currentMonth.getMonth() + 1);

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="month-picker-title" aria-modal="true" className="event-sheet date-picker-sheet" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header">
          <button className="event-sheet__text-button" onClick={onClose} type="button">
            취소
          </button>
          <h2 id="month-picker-title">월 선택</h2>
          <button className="event-sheet__done-button" onClick={() => onSelect(new Date(year, month - 1, 1))} type="button">
            선택
          </button>
        </header>

        <div className="date-picker-body">
          <div className="date-picker-preview">
            {year}년 {month}월
          </div>
          <div className="date-picker-grid date-picker-grid--month">
            <label>
              <span>연도</span>
              <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {yearOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}년
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>월</span>
              <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {value}월
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}

type PeriodDaySummary = {
  activityCount: number;
  date: string;
  expenseCount: number;
  incomeCount: number;
  healthCount: number;
  items: DayTimelineItem[];
  placeCount: number;
  planCount: number;
  recordCount: number;
  totalCount: number;
};

function LifeCalendarDatabasePanel({
  currentMonth,
  daySummaries,
  isLoading,
  items,
  onJumpToDate,
  peopleNames,
  places,
  scope,
}: {
  currentMonth: Date;
  daySummaries: PeriodDaySummary[];
  isLoading: boolean;
  items: DayTimelineItem[];
  onJumpToDate: (date: string) => void;
  peopleNames: string[];
  places: PlanPlace[];
  scope: LifeCalendarScope;
}) {
  const busyDays = [...daySummaries].sort((left, right) => right.totalCount - left.totalCount || left.date.localeCompare(right.date)).slice(0, scope === "week" ? 7 : 10);
  const summary = daySummaries[0];
  const finance = getFinanceTotals(items);
  const topCompanions = getTopValues(
    items.flatMap((item) => ("event" in item ? parseCompanionNames(item.event.companions) : "task" in item ? parseCompanionNames(item.task.companions) : [])),
  ).slice(0, 4);
  const topPlaces = getTopValues(places.map((place) => place.name)).slice(0, 4);
  const topPatterns = getPatternHighlights(daySummaries).slice(0, 5);
  const narrative = getDayNarrative(summary, finance, topCompanions, topPlaces);
  const dayEventCounts = getDayEventCounts(items);
  const dayEventGroups = buildDayEventGroups(items);

  if (scope === "day") {
    return (
      <div className="life-calendar-db-content">
        <section className="life-calendar-db-section">
          <article className="life-calendar-db-story">
            <span>한 줄 요약</span>
            <strong>{narrative}</strong>
          </article>
          <div className="life-calendar-day-events">
            <article className="life-calendar-day-events__card">
              <span>일정</span>
              <strong>{dayEventCounts.schedule}건</strong>
              <div className="life-calendar-day-events__list">
                {dayEventGroups.schedule.length > 0 ? dayEventGroups.schedule.map((item) => <p key={item.id}><b>{item.meta}</b>{item.title}</p>) : <p>등록된 일정이 없어요.</p>}
              </div>
            </article>
            <article className="life-calendar-day-events__card">
              <span>할 일</span>
              <strong>{dayEventCounts.todo}건</strong>
              <div className="life-calendar-day-events__list">
                {dayEventGroups.todo.length > 0 ? dayEventGroups.todo.map((item) => <p key={item.id}><b>{item.meta}</b>{item.title}</p>) : <p>등록된 할 일이 없어요.</p>}
              </div>
            </article>
            <article className="life-calendar-day-events__card">
              <span>이벤트</span>
              <strong>{dayEventCounts.event}건</strong>
              <div className="life-calendar-day-events__list">
                {dayEventGroups.event.length > 0 ? dayEventGroups.event.map((item) => <p key={item.id}><b>{item.meta}</b>{item.title}</p>) : <p>등록된 이벤트가 없어요.</p>}
              </div>
            </article>
          </div>
        </section>

        <section className="life-calendar-db-section">
          <div className="life-calendar-db-section__head">
            <div>
              <p className="eyebrow">Day Canvas</p>
              <h3>지도, 활동, 사진으로 보는 하루</h3>
            </div>
          </div>
          <LifeCalendarDayPanel isLoading={isLoading} items={items} />
        </section>

      </div>
    );
  }

  return (
    <div className="life-calendar-db-content">
      <section className="life-calendar-db-section">
        <div className="life-calendar-db-section__head">
          <div>
            <p className="eyebrow">{scope === "week" ? "Week Brief" : scope === "month" ? "Month Brief" : "Range Brief"}</p>
            <h3>{scope === "week" ? "이번 주 흐름 요약" : scope === "month" ? `${currentMonth.getMonth() + 1}월 흐름 요약` : "선택 기간 흐름 요약"}</h3>
          </div>
        </div>
        <div className="life-calendar-db-hero">
          <article>
            <span>기록 남긴 날</span>
            <strong>{daySummaries.length}</strong>
            <p>빈 날보다 실제 흔적이 남은 날 중심</p>
          </article>
          <article>
            <span>가장 밀도 높은 날</span>
            <strong>{busyDays[0] ? `${busyDays[0].totalCount}개` : "0개"}</strong>
            <p>{busyDays[0] ? formatSelectedDate(busyDays[0].date) : "아직 기록 없음"}</p>
          </article>
          <article>
            <span>자금 흐름</span>
            <strong>{formatNumberWithUnit(finance.net, "원")}</strong>
            <p>수입 {formatNumberWithUnit(finance.income, "원")} · 지출 {formatNumberWithUnit(finance.expense, "원")}</p>
          </article>
          <article>
            <span>관계·장소 축</span>
            <strong>{peopleNames.length + places.length}</strong>
            <p>사람 {peopleNames.length} · 장소 {places.length}</p>
          </article>
        </div>
      </section>

      <section className="life-calendar-db-section">
        <div className="life-calendar-db-section__head">
          <div>
            <p className="eyebrow">Patterns</p>
            <h3>기간 안에서 읽히는 패턴</h3>
          </div>
        </div>
        <div className="life-calendar-db-brief-list">
          {topPatterns.length > 0 ? topPatterns.map((item) => (
            <article className="life-calendar-db-brief-item" key={item.id}>
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </article>
          )) : <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "패턴을 읽을 만큼 쌓인 기록이 아직 부족해요."}</div>}
        </div>
      </section>

      <section className="life-calendar-db-section">
        <div className="life-calendar-db-section__head">
          <div>
            <p className="eyebrow">Focus Days</p>
            <h3>핵심 날짜</h3>
          </div>
        </div>
        <div className={scope === "week" ? "life-calendar-db-period-grid life-calendar-db-period-grid--week" : "life-calendar-db-period-grid"}>
          {busyDays.map((summaryItem) => (
            <button className="life-calendar-db-period-card" key={summaryItem.date} onClick={() => onJumpToDate(summaryItem.date)} type="button">
              <span>{formatSelectedDate(summaryItem.date)}</span>
              <strong>{summaryItem.totalCount}개 기록</strong>
              <p>계획 {summaryItem.planCount} · 활동 {summaryItem.activityCount} · 수입 {summaryItem.incomeCount} · 지출 {summaryItem.expenseCount}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

type DayDetailView = "activities" | "map" | "photos" | null;
type DayActivityItem = Extract<DayTimelineItem, { external: ExternalCalendarItem }> & { type: "activity" };
type DayEventPreview = { id: string; meta: string; title: string; type: "event" | "schedule" | "todo" };
type DayPhotoItem = Extract<DayTimelineItem, { external: ExternalCalendarItem }> & { type: "photo" };
type DayRouteStop = {
  address?: string;
  id: string;
  label: string;
  latitude?: number;
  longitude?: number;
  name: string;
  timeLabel: string;
};
type DayResolvedRouteStop = DayRouteStop & { latitude: number; longitude: number };

function LifeCalendarDayPanel({ isLoading, items }: { isLoading: boolean; items: DayTimelineItem[] }) {
  const [detailView, setDetailView] = useState<DayDetailView>(null);
  const activityItems = useMemo(
    () => items.filter((item): item is DayActivityItem => "external" in item && item.external.type === "activity"),
    [items],
  );
  const photoItems = useMemo(
    () => items.filter((item): item is DayPhotoItem => "external" in item && item.external.type === "photo"),
    [items],
  );
  const routeStops = useMemo(() => buildDayRouteStops(items), [items]);
  const previewPhotos = photoItems.slice(0, 3);
  const finance = useMemo(() => getFinanceTotals(items), [items]);
  const companionCounts = useMemo(
    () => getTopValues(activityItems.flatMap((item) => parseCompanionNames(item.external.companions))).slice(0, 8),
    [activityItems],
  );

  return (
    <>
      <div className="life-calendar-day-panel">
        <div className="life-calendar-day-panel__layout">
          <section className="life-calendar-day-card life-calendar-day-card--timeline">
            <div className="life-calendar-day-card__head">
              <div>
                <span>활동 타임라인</span>
              </div>
              <b>{activityItems.length}건</b>
            </div>
            <div className="life-calendar-day-timeline">
              {activityItems.length > 0 ? activityItems.map((item) => (
                <article className="life-calendar-day-timeline__item" key={item.id}>
                  <div className="life-calendar-day-timeline__time">
                    <span>{formatTimelineRange(item.timeLabel, item.external.endTime)}</span>
                    <div className="life-calendar-day-timeline__tags">
                      {[item.external.category, item.external.food].filter(Boolean).slice(0, 3).map((tag) => <b key={`${item.id}-${tag}`}>{tag}</b>)}
                    </div>
                  </div>
                  <div className="life-calendar-day-timeline__body">
                    <div className="life-calendar-day-timeline__detail-grid life-calendar-day-timeline__detail-grid--four">
                      <div className="life-calendar-day-timeline__detail life-calendar-day-timeline__detail--wide">
                        <em>활동</em>
                        <strong>{item.external.title}</strong>
                      </div>
                      <div className="life-calendar-day-timeline__detail">
                        <em>장소</em>
                        <span>{item.external.placeName || "-"}</span>
                      </div>
                      <div className="life-calendar-day-timeline__detail">
                        <em>함께한 사람</em>
                        <span>{item.external.companions || "-"}</span>
                      </div>
                      <div className="life-calendar-day-timeline__detail">
                        <em>소비지출</em>
                        <span>{item.external.amount ? formatNumberWithUnit(item.external.amount, "원") : "-"}</span>
                      </div>
                    </div>
                  </div>
                </article>
              )) : <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "이 날 저장된 활동 기록이 아직 없어요."}</div>}
            </div>
          </section>

          <button className="life-calendar-day-card life-calendar-day-card--map" onClick={() => setDetailView("map")} type="button">
            <div className="life-calendar-day-card__head">
              <div>
                <span>동선 지도</span>
                <strong>{routeStops.length > 0 ? `${routeStops.length}곳 흐름` : "장소 흐름 없음"}</strong>
              </div>
              <b>자세히 보기</b>
            </div>
            <DayRouteMap compact stops={routeStops} />
            <p>{routeStops.length > 1 ? "그날 남은 장소를 순서대로 지도 위에 연결했어요." : "좌표가 남은 장소가 아직 부족해서 흐름선은 짧게 보여요."}</p>
          </button>

          <button className="life-calendar-day-card life-calendar-day-card--photos" onClick={() => setDetailView("photos")} type="button">
            <div className="life-calendar-day-card__head">
              <div>
                <span>사진 기억</span>
                <strong>{photoItems.length}개 사진</strong>
              </div>
              <b>{photoItems.length > 3 ? "모두 보기" : "갤러리 보기"}</b>
            </div>
            <div className="life-calendar-day-photo-preview">
              {previewPhotos.length > 0 ? previewPhotos.map((item) => (
                <figure className="life-calendar-day-photo-preview__item" key={item.id}>
                  {item.external.fileUrl ? (
                    item.external.mimeType?.startsWith("video/") ? (
                      <div>{item.external.caption || "영상 기록"}</div>
                    ) : (
                      <Image
                        alt={item.external.caption || item.external.title}
                        height={item.external.height ?? 160}
                        src={item.external.fileUrl}
                        unoptimized
                        width={item.external.width ?? 160}
                      />
                    )
                  ) : (
                    <div>{item.external.caption || item.external.title}</div>
                  )}
                </figure>
              )) : <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "이 날 남은 사진이 아직 없어요."}</div>}
            </div>
          </button>

          <section className="life-calendar-day-card life-calendar-day-card--companions">
            <div className="life-calendar-day-card__head">
              <div>
                <span>함께한 사람</span>
                <strong>{companionCounts.length}명 흐름</strong>
              </div>
            </div>
            <div className="life-calendar-day-card__chips">
              {companionCounts.length > 0 ? companionCounts.map((item) => <b key={item.value}>{item.value} · {item.count}회</b>) : <p>이 날 함께한 사람 기록이 아직 없어요.</p>}
            </div>
          </section>

          <section className="life-calendar-day-card life-calendar-day-card--finance">
            <div className="life-calendar-day-card__head">
              <div>
                <span>총 수입·지출</span>
                <strong>{formatNumberWithUnit(finance.net, "원")}</strong>
              </div>
            </div>
            <div className="life-calendar-day-finance">
              <article>
                <span>수입</span>
                <strong>{formatNumberWithUnit(finance.income, "원")}</strong>
              </article>
              <article>
                <span>지출</span>
                <strong>{formatNumberWithUnit(finance.expense, "원")}</strong>
              </article>
            </div>
          </section>
        </div>
      </div>

      {detailView ? (
        <div className="life-detail-overlay" onClick={() => setDetailView(null)}>
          <section className="life-detail-drawer life-calendar-day-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
            <div className="life-detail-drawer__head">
              <div>
                <span>{detailView === "map" ? "동선 지도" : detailView === "activities" ? "활동 기록" : "사진 갤러리"}</span>
                <h2>{detailView === "map" ? "이 날 방문한 장소 흐름" : detailView === "activities" ? "시간 순 활동 기록" : "사진으로 남은 장면"}</h2>
                <p>
                  {detailView === "map"
                    ? "좌표가 있는 장소는 바로 그리고, 없는 장소는 검색 API로 보강해 동선을 구성합니다."
                    : detailView === "activities"
                      ? "활동 기록만 시간대 순으로 보여줘서 이 날의 실제 움직임이 눈에 잘 들어오게 했어요."
                      : "사진은 짧은 썸네일로 압축하고, 여기서 전체를 한 번에 볼 수 있게 했어요."}
                </p>
              </div>
              <button aria-label="닫기" onClick={() => setDetailView(null)} type="button">
                <X aria-hidden size={18} />
              </button>
            </div>

            {detailView === "map" ? (
              <>
                <div className="life-calendar-day-drawer__map">
                  <DayRouteMap stops={routeStops} />
                </div>
                <div className="life-calendar-day-stop-list">
                  {routeStops.length > 0 ? routeStops.map((stop) => (
                    <article className="life-calendar-day-stop-list__item" key={stop.id}>
                      <span>{stop.timeLabel}</span>
                      <strong>{stop.name}</strong>
                      <p>{[stop.label, stop.address].filter(Boolean).join(" · ")}</p>
                    </article>
                  )) : <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "지도에 그릴 장소 기록이 아직 부족해요."}</div>}
                </div>
              </>
            ) : null}

            {detailView === "activities" ? (
              <div className="life-calendar-day-activity-list">
                {activityItems.length > 0 ? activityItems.map((item) => (
                  <article className="life-calendar-day-activity-list__item" key={item.id}>
                    <span>{item.timeLabel}</span>
                    <div>
                      <strong>{item.external.title}</strong>
                      <p>{[item.external.placeName, item.external.meta].filter(Boolean).join(" · ") || "활동 기록"}</p>
                    </div>
                  </article>
                )) : <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "이 날 저장된 활동 기록이 아직 없어요."}</div>}
              </div>
            ) : null}

            {detailView === "photos" ? (
              <div className="life-calendar-day-photo-gallery">
                {photoItems.length > 0 ? photoItems.map((item) => (
                  <figure className="life-calendar-day-photo-gallery__item" key={item.id}>
                    {item.external.fileUrl ? (
                      item.external.mimeType?.startsWith("video/") ? (
                        <video controls src={item.external.fileUrl} />
                      ) : (
                        <Image
                          alt={item.external.caption || item.external.title}
                          height={item.external.height ?? 220}
                          src={item.external.fileUrl}
                          unoptimized
                          width={item.external.width ?? 220}
                        />
                      )
                    ) : (
                      <div>{item.external.caption || item.external.title}</div>
                    )}
                    <figcaption>
                      <strong>{item.external.caption || item.external.title}</strong>
                      <span>{item.external.meta || "사진 기록"}</span>
                    </figcaption>
                  </figure>
                )) : <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "이 날 남은 사진이 아직 없어요."}</div>}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}

function DayRouteMap({ compact = false, stops }: { compact?: boolean; stops: DayRouteStop[] }) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const markersRef = useRef<NaverMarker[]>([]);
  const polylineRef = useRef<NaverPolyline | null>(null);
  const [mapStatus, setMapStatus] = useState<"idle" | "ready" | "missing-key" | "error">("idle");
  const [resolvedCoordinates, setResolvedCoordinates] = useState<Record<string, { latitude: number; longitude: number }>>({});

  useEffect(() => {
    if (!naverMapClientId) {
      setMapStatus("missing-key");
      return;
    }

    if (window.naver?.maps) {
      setMapStatus("ready");
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-dailyos-naver-map]");
    if (existingScript) {
      existingScript.addEventListener("load", () => setMapStatus("ready"), { once: true });
      existingScript.addEventListener("error", () => setMapStatus("error"), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.dataset.dailyosNaverMap = "true";
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(naverMapClientId)}`;
    script.onload = () => setMapStatus("ready");
    script.onerror = () => setMapStatus("error");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    const unresolvedStops = stops.filter((stop) => !hasCoordinates(stop) && (stop.address || stop.name));
    if (unresolvedStops.length === 0) return;

    let isMounted = true;
    Promise.all(
      unresolvedStops.map(async (stop) => {
        const query = [stop.name, stop.address].filter(Boolean).join(" ");
        try {
          const response = await fetch(`/api/maps/search-place?query=${encodeURIComponent(query)}`);
          const payload = (await response.json()) as { places?: Array<{ latitude: number; longitude: number }> };
          const firstPlace = payload.places?.[0];
          if (!firstPlace) return null;
          return { id: stop.id, latitude: firstPlace.latitude, longitude: firstPlace.longitude };
        } catch (error) {
          console.error("Failed to resolve day route stop", error);
          return null;
        }
      }),
    ).then((results) => {
      if (!isMounted) return;
      setResolvedCoordinates((current) => {
        const next = { ...current };
        results.forEach((item) => {
          if (!item) return;
          next[item.id] = { latitude: item.latitude, longitude: item.longitude };
        });
        return next;
      });
    });

    return () => {
      isMounted = false;
    };
  }, [stops]);

  const visibleStops = useMemo(
    () =>
      stops
        .map((stop) => ({
          ...stop,
          latitude: stop.latitude ?? resolvedCoordinates[stop.id]?.latitude,
          longitude: stop.longitude ?? resolvedCoordinates[stop.id]?.longitude,
        }))
        .filter((stop): stop is DayResolvedRouteStop => hasCoordinates(stop)),
    [resolvedCoordinates, stops],
  );

  useEffect(() => {
    if (mapStatus !== "ready" || !mapElementRef.current || !window.naver?.maps || visibleStops.length === 0) return;

    if (!mapRef.current) {
      const firstStop = visibleStops[0];
      mapRef.current = new window.naver.maps.Map(mapElementRef.current, {
        center: new window.naver.maps.LatLng(firstStop.latitude!, firstStop.longitude!),
        zoom: visibleStops.length > 1 ? 12 : 15,
      });
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = visibleStops.map((stop, index) =>
      new window.naver!.maps.Marker({
        icon: {
          anchor: new window.naver!.maps.Point(18, 18),
          content: `<div class="life-calendar-route-marker"><span>${index + 1}</span></div>`,
        },
        map: mapRef.current,
        position: new window.naver!.maps.LatLng(stop.latitude!, stop.longitude!),
        title: stop.name,
      }),
    );

    polylineRef.current?.setMap(null);
    if (visibleStops.length > 1) {
      polylineRef.current = new window.naver.maps.Polyline({
        map: mapRef.current,
        path: visibleStops.map((stop) => new window.naver!.maps.LatLng(stop.latitude!, stop.longitude!)),
        strokeColor: "#c9b8ff",
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeOpacity: 0.85,
        strokeWeight: 4,
      });
    }

    if (visibleStops.length === 1) {
      mapRef.current.setCenter(new window.naver.maps.LatLng(visibleStops[0].latitude!, visibleStops[0].longitude!));
      mapRef.current.setZoom(15);
      return;
    }

    const bounds = new window.naver.maps.LatLngBounds();
    visibleStops.forEach((stop) => bounds.extend(new window.naver!.maps.LatLng(stop.latitude!, stop.longitude!)));
    mapRef.current.fitBounds(bounds, compact ? { bottom: 40, left: 40, right: 40, top: 40 } : { bottom: 90, left: 60, right: 60, top: 60 });
  }, [compact, mapStatus, visibleStops]);

  if (mapStatus === "missing-key") {
    return <div className={`life-calendar-day-map life-calendar-day-map--empty ${compact ? "life-calendar-day-map--compact" : ""}`}>네이버 지도 키가 없어서 지도를 표시할 수 없어요.</div>;
  }

  if (visibleStops.length === 0) {
    return <div className={`life-calendar-day-map life-calendar-day-map--empty ${compact ? "life-calendar-day-map--compact" : ""}`}>지도에 그릴 장소 기록을 더 쌓아보면 여기서 하루 동선이 보입니다.</div>;
  }

  return <div className={`life-calendar-day-map ${compact ? "life-calendar-day-map--compact" : ""}`} ref={mapElementRef} />;
}

function getFinanceTotals(items: DayTimelineItem[]) {
  return items.reduce(
    (totals, item) => {
      if (!("external" in item) || item.external.amount === undefined) return totals;
      if (item.external.type === "expense") totals.expense += item.external.amount;
      if (item.external.type === "income") totals.income += item.external.amount;
      totals.net = totals.income - totals.expense;
      return totals;
    },
    { expense: 0, income: 0, net: 0 },
  );
}

function getDatabaseEyebrow(scope: LifeCalendarScope) {
  if (scope === "day") return "일간 요약";
  if (scope === "week") return "주간 요약";
  if (scope === "month") return "월간 요약";
  return "선택 기간 요약";
}

function ManageCalendarOverview({
  counts,
  items,
  selectedDate,
}: {
  counts: { event: number; schedule: number; todo: number };
  items: DayTimelineItem[];
  selectedDate: string;
}) {
  const cards = [
    {
      count: counts.schedule,
      description: counts.schedule > 0 ? "움직여야 할 일정 흐름이 잡혀 있어요." : "아직 등록된 일정이 없어요.",
      label: "일정",
      type: "schedule" as const,
    },
    {
      count: counts.todo,
      description: counts.todo > 0 ? "해야 할 일의 우선순위를 바로 정리할 수 있어요." : "이 날짜에 묶인 할 일이 없어요.",
      label: "할 일",
      type: "todo" as const,
    },
    {
      count: counts.event,
      description: counts.event > 0 ? "놓치면 아쉬운 이벤트가 잡혀 있어요." : "특별 이벤트는 아직 비어 있어요.",
      label: "이벤트",
      type: "event" as const,
    },
  ];
  const topItems = items.filter((item) => !("external" in item)).slice(0, 3);

  return (
    <section className="manage-calendar-overview" aria-label="선택 날짜 요약">
      <div className="manage-calendar-overview__cards">
        {cards.map((card) => (
          <article className={`manage-calendar-overview__card manage-calendar-overview__card--${card.type}`} key={card.type}>
            <div>
              <span>{card.label}</span>
              <strong>{card.count}</strong>
            </div>
            <p>{card.description}</p>
          </article>
        ))}
      </div>
      <div className="manage-calendar-overview__focus">
        <div>
          <span>{formatSelectedDate(selectedDate)}</span>
          <strong>{topItems.length > 0 ? "이 날짜의 핵심 계획" : "계획을 추가할 준비가 되어 있어요"}</strong>
        </div>
        <div className="manage-calendar-overview__chips">
          {topItems.length > 0 ? topItems.map((item) => (
            <b key={item.id}>{getCalendarSummaryLabel(item.type)} · {getTimelineItemTitle(item)}</b>
          )) : <p>일정, 할 일, 이벤트를 추가하면 이 날의 흐름이 여기서 바로 살아납니다.</p>}
        </div>
      </div>
    </section>
  );
}

function getTopValues(values: string[]) {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].map(([value, count]) => ({ count, value })).sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

function getDayNarrative(summary: PeriodDaySummary | undefined, finance: { expense: number; income: number; net: number }, topCompanions: Array<{ count: number; value: string }>, topPlaces: Array<{ count: number; value: string }>) {
  if (!summary) return "아직 남은 기록이 적어서 이 날의 결을 읽기 어려워요.";
  const density =
    summary.totalCount >= 8 ? "기록 밀도가 높은 날" :
    summary.totalCount >= 4 ? "중간 이상으로 흔적이 남은 날" :
    "조용하게 지나간 날";
  const people = topCompanions[0] ? `${topCompanions[0].value}와 함께한 흐름이 가장 또렷하고` : "혼자 보낸 흐름이 중심이고";
  const place = topPlaces[0] ? `${topPlaces[0].value} 축의 흔적이 남아 있어요.` : "특정 장소 축은 아직 옅어요.";
  const financeTone =
    finance.net > 0 ? `자금 흐름은 ${formatNumberWithUnit(finance.net, " 순증")}` :
    finance.net < 0 ? `자금 흐름은 ${formatNumberWithUnit(finance.net, " 순지출")}` :
    "자금 흐름은 거의 균형이에요";
  return `${density}. ${people} ${place} ${financeTone}.`;
}

function getDayEventCounts(items: DayTimelineItem[]) {
  return items.reduce(
    (counts, item) => {
      if ("event" in item) counts[item.event.type as "schedule" | "event"] += 1;
      if ("task" in item) counts.todo += 1;
      return counts;
    },
    { event: 0, schedule: 0, todo: 0 },
  );
}

function buildDayEventGroups(items: DayTimelineItem[]) {
  const groups: Record<"event" | "schedule" | "todo", DayEventPreview[]> = {
    event: [],
    schedule: [],
    todo: [],
  };

  items.forEach((item) => {
    if ("event" in item) {
      groups[item.event.type as "schedule" | "event"].push({
        id: item.id,
        meta: item.timeLabel === "하루종일" ? "종일" : item.timeLabel,
        title: item.event.title,
        type: item.event.type as "schedule" | "event",
      });
      return;
    }

    if ("task" in item) {
      groups.todo.push({
        id: item.id,
        meta: item.timeLabel === "하루종일" ? "종일" : item.timeLabel,
        title: item.task.title,
        type: "todo",
      });
    }
  });

  return {
    event: groups.event.slice(0, 3),
    schedule: groups.schedule.slice(0, 3),
    todo: groups.todo.slice(0, 3),
  };
}

function buildDayRouteStops(items: DayTimelineItem[]) {
  const stops: DayRouteStop[] = [];

  items.forEach((item) => {
    if ("event" in item && item.event.place) {
      stops.push({
        address: item.event.place.address,
        id: item.id,
        label: categoryLabels[item.event.type as CalendarCategory],
        latitude: item.event.place.latitude,
        longitude: item.event.place.longitude,
        name: item.event.place.name,
        timeLabel: item.timeLabel,
      });
      return;
    }

    if ("task" in item && item.task.place) {
      stops.push({
        address: item.task.place.address,
        id: item.id,
        label: "할 일",
        latitude: item.task.place.latitude,
        longitude: item.task.place.longitude,
        name: item.task.place.name,
        timeLabel: item.timeLabel,
      });
      return;
    }

    if ("external" in item && item.external.type === "activity" && item.external.placeName) {
      stops.push({
        address: item.external.placeAddress,
        id: item.id,
        label: "활동",
        latitude: item.external.placeLatitude,
        longitude: item.external.placeLongitude,
        name: item.external.placeName,
        timeLabel: item.timeLabel,
      });
    }
  });

  return stops.filter((stop, index, array) => {
    const previous = array[index - 1];
    if (!previous) return true;
    return `${previous.name}|${previous.address ?? ""}` !== `${stop.name}|${stop.address ?? ""}`;
  });
}

function hasCoordinates(stop: DayRouteStop): stop is DayResolvedRouteStop {
  return typeof stop.latitude === "number" && Number.isFinite(stop.latitude) && typeof stop.longitude === "number" && Number.isFinite(stop.longitude);
}

function getPatternHighlights(daySummaries: PeriodDaySummary[]) {
  if (daySummaries.length === 0) return [];
  const busiest = [...daySummaries].sort((left, right) => right.totalCount - left.totalCount)[0];
  const strongestActivity = [...daySummaries].sort((left, right) => right.activityCount - left.activityCount)[0];
  const strongestFinance = [...daySummaries].sort((left, right) => right.expenseCount + right.incomeCount - (left.expenseCount + left.incomeCount))[0];
  const strongestRecords = [...daySummaries].sort((left, right) => right.recordCount - left.recordCount)[0];

  return [
    busiest ? { description: `계획 ${busiest.planCount} · 활동 ${busiest.activityCount} · 기록 ${busiest.recordCount}`, id: `busiest-${busiest.date}`, label: "가장 밀도 높은 날", title: formatSelectedDate(busiest.date) } : null,
    strongestActivity ? { description: `실제 활동 ${strongestActivity.activityCount}개가 남은 날`, id: `activity-${strongestActivity.date}`, label: "활동 집중", title: formatSelectedDate(strongestActivity.date) } : null,
    strongestFinance ? { description: `수입 ${strongestFinance.incomeCount} · 지출 ${strongestFinance.expenseCount}`, id: `finance-${strongestFinance.date}`, label: "자금 흐름", title: formatSelectedDate(strongestFinance.date) } : null,
    strongestRecords ? { description: `하루기록·사진 ${strongestRecords.recordCount}개`, id: `records-${strongestRecords.date}`, label: "기억이 선명한 날", title: formatSelectedDate(strongestRecords.date) } : null,
  ].filter((item): item is { description: string; id: string; label: string; title: string } => Boolean(item));
}

function formatNumberWithUnit(value: number, unit: string) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${new Intl.NumberFormat("ko-KR").format(Math.abs(value))}${unit}`;
}

function parseCompanionNames(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRangeBounds(start: string, end: string) {
  if (start <= end) return { end, start };
  return { end: start, start: end };
}

function getWeekBounds(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { end: formatDateKey(end), start: formatDateKey(start) };
}

function getMonthBounds(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  return { end: formatDateKey(end), start: formatDateKey(start) };
}

function isRangeOverlapping(startDate: string, endDate: string | undefined, filterStart: string, filterEnd: string) {
  const normalizedEndDate = endDate ?? startDate;
  return startDate <= filterEnd && normalizedEndDate >= filterStart;
}

function getTimelineItemDate(item: DayTimelineItem) {
  if ("event" in item) return item.event.date;
  if ("task" in item) return item.task.scheduledDate;
  return item.external.date;
}

function hasTimelinePlace(item: DayTimelineItem) {
  if ("event" in item) return Boolean(item.event.place?.name || item.event.place?.address);
  if ("task" in item) return Boolean(item.task.place?.name || item.task.place?.address);
  return Boolean(item.external.placeName || item.external.placeAddress);
}

function getAxisDescription(axis: LifeCalendarAxis) {
  if (axis === "activity") return "실제로 남긴 활동 기록";
  if (axis === "places") return "장소가 연결된 기록";
  if (axis === "records") return "하루기록과 사진";
  if (axis === "finance") return "수입과 지출로 남은 자금 흐름";
  if (axis === "health") return "운동과 몸무게";
  return "전체 흐름";
}

function getTimelineItemTitle(item: DayTimelineItem) {
  if ("event" in item) return item.event.title;
  if ("task" in item) return item.task.title;
  return item.external.title;
}

function buildPeriodDaySummaries(
  start: string,
  end: string,
  schedules: CalendarEvent[],
  events: CalendarEvent[],
  tasks: TaskItem[],
  externalItems: ExternalCalendarItem[],
) {
  const allDates = enumerateDates(start, end);
  return allDates
    .map((date) => {
      const daySchedules = schedules.filter((item) => isDateInRange(date, item.date, item.endDate));
      const dayEvents = events.filter((item) => isDateInRange(date, item.date, item.endDate));
      const dayTasks = tasks.filter((item) => isDateInRange(date, item.scheduledDate, item.dueDate));
      const dayExternalItems = externalItems.filter((item) => item.date === date);
      const items = [
        ...daySchedules.map((item) => createEventTimelineItem(item)),
        ...dayTasks.map((item) => createTaskTimelineItem(item)),
        ...dayEvents.map((item) => createEventTimelineItem(item)),
        ...dayExternalItems.map((item) => createExternalTimelineItem(item)),
      ];
      const places = uniquePlanPlaces(
        [...daySchedules, ...dayEvents, ...dayTasks]
          .map((item) => item.place)
          .filter((place): place is PlanPlace => Boolean(place)),
      );

      return {
        activityCount: dayExternalItems.filter((item) => item.type === "activity").length,
        date,
        expenseCount: dayExternalItems.filter((item) => item.type === "expense").length,
        incomeCount: dayExternalItems.filter((item) => item.type === "income").length,
        healthCount: dayExternalItems.filter((item) => item.type === "workout" || item.type === "weight").length,
        items,
        placeCount: places.length,
        planCount: daySchedules.length + dayEvents.length + dayTasks.length,
        recordCount: dayExternalItems.filter((item) => item.type === "daily_log" || item.type === "photo").length,
        totalCount: items.length,
      } satisfies PeriodDaySummary;
    })
    .filter((summary) => summary.totalCount > 0);
}

function enumerateDates(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  while (cursor <= endDate) {
    dates.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function getScopeTitle(scope: LifeCalendarScope, start: string, end: string, currentMonth: Date) {
  if (scope === "day") return formatSelectedDate(start);
  if (scope === "week") return `${formatSelectedDate(start)} ~ ${formatSelectedDate(end)}`;
  if (scope === "month") return `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;
  return `${formatSelectedDate(start)} ~ ${formatSelectedDate(end)}`;
}

function getCategories(allowedTypes?: EventType[]): CalendarCategory[] {
  const source = allowedTypes ?? categoryDisplayOrder;
  return categoryDisplayOrder.filter((type) => source.includes(type));
}

function createActivitySourceFromEvent(event: CalendarEvent) {
  const sourceType = event.type === "event" ? "event" : "schedule";
  return {
    category: event.type === "event" ? "이벤트" : "일정",
    companions: event.companions,
    date: event.date,
    endTime: event.endTime,
    expenseAmount: event.expenseAmount,
    isAllDay: event.isAllDay,
    memo: event.meta,
    placeAddress: event.place?.address,
    placeName: event.place?.name,
    sourceId: event.id,
    sourceType,
    startTime: event.time,
    title: event.title,
  } satisfies Parameters<typeof updateLifeActivitiesBySourceInDb>[0];
}

function createActivitySourceFromTask(task: TaskItem) {
  return {
    category: "할 일",
    companions: task.companions,
    date: task.scheduledDate,
    endTime: task.endTime,
    expenseAmount: task.expenseAmount,
    isAllDay: task.isAllDay,
    memo: task.memo,
    placeAddress: task.place?.address,
    placeName: task.place?.name,
    sourceId: task.id,
    sourceType: "todo",
    startTime: task.startTime,
    title: task.title,
  } satisfies Parameters<typeof updateLifeActivitiesBySourceInDb>[0];
}

function createEventTimelineItem(event: CalendarEvent): DayTimelineItem {
  return {
    event,
    id: `${event.type}-${event.id}`,
    sortMinutes: getTimelineSortMinutes(event.time, event.isAllDay),
    timeLabel: getTimelineTimeLabel(event.time, event.isAllDay),
    type: event.type as "schedule" | "event",
  };
}

function createTaskTimelineItem(task: TaskItem): DayTimelineItem {
  return {
    id: `todo-${task.id}`,
    sortMinutes: getTimelineSortMinutes(task.startTime, task.isAllDay),
    task,
    timeLabel: getTimelineTimeLabel(task.startTime, task.isAllDay),
    type: "todo",
  };
}

function createExternalTimelineItem(external: ExternalCalendarItem): DayTimelineItem {
  return {
    external,
    id: `${external.type}-${external.id}`,
    sortMinutes: external.startTime ? getTimelineSortMinutes(external.startTime, external.isAllDay) : 24 * 60 + getTimelineTypeOrder(external.type),
    timeLabel: external.startTime && !external.isAllDay ? getTimelineTimeLabel(external.startTime, external.isAllDay) : "기록",
    type: external.type,
  };
}

function getTimelineSortMinutes(time?: string, isAllDay = true) {
  if (isAllDay || !time) return 24 * 60;
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 24 * 60;
  return hours * 60 + minutes;
}

function getTimelineTimeLabel(time?: string, isAllDay = true) {
  if (isAllDay) return "하루종일";
  return time || "시간 미정";
}

function formatTimelineRange(startLabel: string, endTime?: string) {
  if (!endTime || startLabel === "하루종일" || startLabel === "기록" || startLabel === "시간 미정") return startLabel;
  return `${startLabel} ~ ${endTime}`;
}

function getTimelineTypeOrder(type: CalendarCategory | ExternalCalendarCategory) {
  const order: Record<CalendarCategory | ExternalCalendarCategory, number> = {
    schedule: 0,
    todo: 1,
    event: 2,
    activity: 3,
    expense: 3,
    income: 3,
    workout: 4,
    weight: 5,
    daily_log: 6,
    photo: 7,
  };
  return order[type];
}

function summarizeDay(events: CalendarEvent[], tasks: TaskItem[], categories: CalendarCategory[], externalItems: ExternalCalendarItem[]) {
  const planSummaries = categoryDisplayOrder
    .filter((type) => categories.includes(type))
    .map((type) => ({
      type,
      count: type === "todo" ? tasks.length : events.filter((event) => event.type === type).length,
    }))
    .filter((summary) => summary.count > 0);

  const externalSummaries = (["expense", "income", "workout", "weight", "daily_log", "photo"] as const)
    .map((type) => ({
      type,
      count: externalItems.filter((item) => item.type === type).length,
    }))
    .filter((summary) => summary.count > 0);

  return [...planSummaries, ...externalSummaries];
}
