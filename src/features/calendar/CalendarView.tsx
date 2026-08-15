"use client";

import Image from "next/image";
import type { DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Bell,
  Camera,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListChecks,
  MapPin,
  Plus,
  UtensilsCrossed,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FormField } from "@/components/ui/FormField";
import { IconButton } from "@/components/ui/IconButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { MonthPickerSheet } from "@/features/calendar/MonthPickerSheet";
import { confirmAction } from "@/lib/actionGuards";
import { getNaverMapClientId, isNaverMapReady, loadNaverMapScript } from "@/lib/naverMap";
import type { NaverLatLng, NaverLatLngBounds, NaverMap, NaverMarker, NaverPolyline } from "@/lib/naverMap";
import type { EventType, PersonRecord, PlanPlace, TaskItem, TaskPriority, TaskStatus } from "@/types/domain";
import { deleteLinkedExpenseRecordInDb, syncLinkedExpenseRecordInDb } from "@/features/ledger/api";
import { createLifeActivityInDb, deleteLifeActivitiesBySourceFromDb, updateLifeActivitiesBySourceInDb } from "@/features/life/api";
import { createPersonInDb } from "@/features/people/api";
import { PeoplePickerField } from "@/features/people/PeoplePickerField";
import { createTaskInDb, deleteTaskFromDb, updateTaskInDb } from "@/features/tasks/api";
import { FormSectionTitle } from "@/features/calendar/components";
import { DayTimelineSection } from "@/features/calendar/DayTimelineSection";
import { PlaceSearchField } from "@/features/calendar/PlaceSearchField";
import { SelectedDatePlacesMap } from "@/features/calendar/SelectedDatePlacesMap";
import { useCalendarResources } from "@/features/calendar/useCalendarResources";
import { formatDateKey, formatSelectedDate, getMonthDays, isDateInRange, parseOptionalAmount, reorderScopedItems, uniquePlanPlaces } from "@/features/calendar/utils";
import { createCalendarEventInDb, deleteCalendarEventFromDb, updateCalendarEventInDb } from "./api";
import { categoryDisplayOrder, categoryLabels } from "@/features/calendar/presentation";
import type { CalendarCategory, DayTimelineItem, DragPlacement, ExternalCalendarCategory, ExternalCalendarItem } from "@/features/calendar/types";
import type { CalendarEvent } from "./data";
type CalendarViewProps = {
  allowedTypes?: EventType[];
  defaultSelectedDate?: string | null;
  description?: string;
  externalItems?: ExternalCalendarItem[];
  showEventAddButton?: boolean;
  title?: string;
  viewMode?: "manage" | "database";
};

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const initialMonth = new Date();
type LifeCalendarScope = "day" | "week" | "month" | "range";
const naverMapClientId = getNaverMapClientId();
const dayRouteGeocodeCache = new Map<string, { latitude: number; longitude: number } | null>();

export function CalendarView({
  allowedTypes,
  defaultSelectedDate = null,
  description,
  externalItems = [],
  showEventAddButton = false,
  viewMode = "manage",
  title = "이벤트",
}: CalendarViewProps) {
  const isDatabaseView = viewMode === "database";
  const categories = useMemo(() => getCategories(allowedTypes), [allowedTypes]);
  const { events, isLoading, people, setEvents, setPeople, setTasks, tasks } = useCalendarResources();
  const [calendarCategoryFilters, setCalendarCategoryFilters] = useState<CalendarCategory[]>([]);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [isEventSheetOpen, setIsEventSheetOpen] = useState(false);
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(defaultSelectedDate);
  const [sheetDefaultType, setSheetDefaultType] = useState<CalendarCategory>("event");
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState<{ id: string; type: "event" | "task" } | null>(null);
  const [draggingItem, setDraggingItem] = useState<{ id: string; type: CalendarCategory } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; placement: DragPlacement } | null>(null);
  const [activityConversionMessage, setActivityConversionMessage] = useState("");
  const [convertingToActivity, setConvertingToActivity] = useState<{ id: string; type: "event" | "task" } | null>(null);
  const [dbScope, setDbScope] = useState<LifeCalendarScope>("day");
  const [rangeStart, setRangeStart] = useState(defaultSelectedDate ?? formatDateKey(new Date()));
  const [rangeEnd, setRangeEnd] = useState(defaultSelectedDate ?? formatDateKey(new Date()));

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
  const selectedEvents = useMemo(() => (selectedDate ? visibleEvents.filter((event) => isDateInRange(selectedDate, event.date, event.endDate) && event.type === "event") : []), [selectedDate, visibleEvents]);
  const selectedTasks = useMemo(() => (selectedDate ? tasks.filter((task) => isDateInRange(selectedDate, task.scheduledDate, task.dueDate)) : []), [selectedDate, tasks]);
  const selectedExternalItems = useMemo(() => (selectedDate ? externalItems.filter((item) => item.date === selectedDate) : []), [externalItems, selectedDate]);
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
        ...selectedTasks.map((task) => createTaskTimelineItem(task)),
        ...selectedEvents.map((event) => createEventTimelineItem(event)),
        ...selectedExternalItems.map((external) => createExternalTimelineItem(external)),
      ].sort((first, second) => first.sortMinutes - second.sortMinutes || getTimelineTypeOrder(first.type) - getTimelineTypeOrder(second.type)),
    [selectedEvents, selectedExternalItems, selectedTasks],
  );
  const periodTimelineItems = useMemo(
    () =>
      [
        ...periodTasks.map((task) => createTaskTimelineItem(task)),
        ...periodEvents.map((event) => createEventTimelineItem(event)),
        ...periodExternalItems.map((external) => createExternalTimelineItem(external)),
      ].sort((first, second) => {
        const firstDate = getTimelineItemDate(first);
        const secondDate = getTimelineItemDate(second);
        if (firstDate !== secondDate) return firstDate.localeCompare(secondDate);
        return first.sortMinutes - second.sortMinutes || getTimelineTypeOrder(first.type) - getTimelineTypeOrder(second.type);
      }),
    [periodEvents, periodExternalItems, periodTasks],
  );
  const countsByCategory = useMemo(() => {
    if (isDatabaseView) {
      return {
        event: periodEvents.length,
        todo: periodTasks.length,
      };
    }
    if (!selectedDate) return { event: 0, todo: 0 };
    return {
      event: visibleEvents.filter((event) => isDateInRange(selectedDate, event.date, event.endDate) && event.type === "event").length,
      todo: selectedTasks.length,
    };
  }, [isDatabaseView, periodEvents.length, periodTasks.length, selectedDate, selectedTasks.length, visibleEvents]);
  const selectedPlanPlaces = useMemo(() => {
    const sourceItems = isDatabaseView ? [...periodEvents, ...periodTasks] : [...selectedEvents, ...selectedTasks];
    return uniquePlanPlaces(sourceItems.map((item) => item.place).filter((place): place is PlanPlace => Boolean(place)));
  }, [isDatabaseView, periodEvents, periodTasks, selectedEvents, selectedTasks]);
  const periodDaySummaries = useMemo(
    () => buildPeriodDaySummaries(periodBounds.start, periodBounds.end, periodEvents, periodTasks, periodExternalItems),
    [periodBounds.end, periodBounds.start, periodEvents, periodExternalItems, periodTasks],
  );
  const visibleTimelineItems = useMemo(() => {
    if (!isDatabaseView) return selectedTimelineItems;
    return periodTimelineItems;
  }, [isDatabaseView, periodTimelineItems, selectedTimelineItems]);

  const moveMonth = (direction: -1 | 1) => {
    setCurrentMonth((month) => {
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + direction, 1);
      setSelectedDate(formatDateKey(nextMonth));
      return nextMonth;
    });
  };

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
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
    if (!confirmAction(editingEvent ? "이벤트 수정을 저장할까요?" : "이벤트를 저장할까요?")) return;
    setIsSavingEvent(true);
    try {
      const exists = events.some((item) => item.id === event.id);
      const previousEvent = events.find((item) => item.id === event.id);
      const savedEvent = exists ? await updateCalendarEventInDb(event) : await createCalendarEventInDb(event);
      const nextEvent = savedEvent ?? event;
      const nextTargetType = "event";
      const previousTargetType = previousEvent ? "event" : nextTargetType;
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
    if (!confirmAction("이 이벤트를 삭제할까요?")) return;
    setDeletingPlan({ id, type: "event" });
    try {
      const targetEvent = events.find((event) => event.id === id);
      await deleteCalendarEventFromDb(id);
      if (targetEvent) await deleteLinkedExpenseRecordInDb("event", id);
      if (targetEvent) await deleteLifeActivitiesBySourceFromDb("event", id);
      setEvents((current) => current.filter((item) => item.id !== id));
    } finally {
      setDeletingPlan(null);
    }
  };

  const saveTask = async (task: TaskItem) => {
    if (isSavingTask) return;
    if (!confirmAction(editingTask ? "할 일 수정을 저장할까요?" : "할 일을 저장할까요?")) return;
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
    if (!confirmAction("이 할 일을 삭제할까요?")) return;
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
    if (!confirmAction(task.status === "done" ? "이 할 일을 미완료로 되돌릴까요?" : "이 할 일을 완료 처리할까요?")) return;
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
    const targetType = "event";
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
        category: "이벤트",
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
      <header className="life-tab-heading calendar-header ui-toolbar-panel">
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
              <div className="life-calendar-header-modes__range ui-form-grid ui-form-grid--compact">
                <FormField label="시작일">
                  <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
                </FormField>
                <FormField label="종료일">
                  <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
                </FormField>
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

      <div className={`calendar-layout ${selectedDate || isDatabaseView ? "calendar-layout--detail-open" : ""} ${isDatabaseView ? "calendar-layout--database" : ""} ui-workspace-grid ${isDatabaseView ? "ui-workspace-grid--balanced" : "ui-workspace-grid--sidebar"}`}>
        <SectionCard className="calendar-board ui-workspace-panel ui-workspace-panel--tall">
          <div className="calendar-toolbar">
            <IconButton label="이전 달" onClick={() => moveMonth(-1)} tone="outline">
              <ChevronLeft aria-hidden size={20} />
            </IconButton>
            <button className="calendar-month-trigger" onClick={() => setIsMonthPickerOpen(true)} type="button">
              <span>{currentMonth.getFullYear()}</span>
              <strong>{currentMonth.getMonth() + 1}월</strong>
            </button>
            <IconButton label="다음 달" onClick={() => moveMonth(1)} tone="outline">
              <ChevronRight aria-hidden size={20} />
            </IconButton>
          </div>

          {!(isDatabaseView && dbScope === "day") ? (
            <div className="calendar-filters" aria-label="표시 항목">
              {categories.map((type) => (
                <button
                  className={`calendar-filter calendar-filter--${type} ${
                    calendarCategoryFilters.includes(type) ? "calendar-filter--active" : ""
                  } ${calendarCategoryFilters.length > 0 && !calendarCategoryFilters.includes(type) ? "calendar-filter--muted" : ""}`}
                  key={type}
                  onClick={() => toggleCalendarCategoryFilter(type)}
                  type="button"
                >
                  <span className={`calendar-dot calendar-dot--${type}`} />
                  {categoryLabels[type]}
                </button>
              ))}
            </div>
          ) : null}

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
              const eventSummary = summarizeDay(dayEvents, dayTasks, orderedVisibleCalendarCategories, dayExternalItems);
              return (
                <button
                  className={`calendar-day ${cell.date === todayKey ? "calendar-day--today" : ""} ${cell.date === selectedDate ? "calendar-day--selected" : ""} ${cell.date && new Date(`${cell.date}T00:00:00`).getDay() === 0 ? "calendar-day--sunday" : ""}`}
                  disabled={!cell.date}
                  key={cell.key}
                  onClick={() => (cell.date ? handleDateClick(cell.date) : undefined)}
                  type="button"
                >
                  {cell.day ? <span className={`calendar-day__number ${cell.date?.endsWith(`-${String(cell.day).padStart(2, "0")}`) && new Date(`${cell.date}T00:00:00`).getDay() === 0 ? "calendar-day__number--sunday" : ""}`}>{cell.day}</span> : null}
                  <div className="calendar-day__events">
                    {eventSummary.totalCount > 0 ? (
                      <>
                        <div className="calendar-day__signal-stack">
                          {eventSummary.planCount > 0 ? <span className="calendar-day__signal calendar-day__signal--plan">계획 {eventSummary.planCount}</span> : null}
                          {eventSummary.recordCount > 0 ? <span className="calendar-day__signal calendar-day__signal--record">기록 {eventSummary.recordCount}</span> : null}
                        </div>
                        <span className="calendar-day__event-count">{eventSummary.totalCount}건</span>
                      </>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {selectedDate || isDatabaseView ? (
          <aside className="calendar-detail">
            <SectionCard className="date-detail-card ui-workspace-panel ui-workspace-panel--tall">
              <div className="section-heading ui-panel-heading">
                <div className="ui-panel-heading__intro">
                  <p className="eyebrow">{isDatabaseView ? getDatabaseEyebrow(dbScope) : "선택한 날짜"}</p>
                  <h2>{isDatabaseView ? getScopeTitle(dbScope, periodBounds.start, periodBounds.end, currentMonth) : formatSelectedDate(selectedDate ?? detailAnchorDate)}</h2>
                </div>
              </div>

              {!isDatabaseView ? <SelectedDatePlacesMap places={selectedPlanPlaces} /> : null}

              <div className="date-event-list">
                {isDatabaseView ? (
                  <LifeCalendarDatabasePanel
                    daySummaries={periodDaySummaries}
                    isLoading={isLoading}
                    items={visibleTimelineItems}
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
          defaultType={sheetDefaultType === "todo" ? "event" : sheetDefaultType}
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
      <section aria-labelledby="event-sheet-title" aria-modal="true" className="event-sheet planner-sheet" role="dialog" onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header planner-sheet__header">
          <div>
            <h2 id="event-sheet-title">{event ? "항목 수정" : `${categoryLabels[type]} 추가`}</h2>
            <p>{event ? "등록된 내용을 수정합니다." : "날짜와 종류를 정해 계획에 추가합니다."}</p>
          </div>
          <IconButton label="닫기" onClick={onClose} tone="outline">
            <X aria-hidden size={18} />
          </IconButton>
        </header>

        <div className="event-sheet__body planner-sheet__body">
          <FormSectionTitle title="기본 정보" description="제목과 메모를 먼저 잡아두세요." />
          <div className="event-form-card event-form-card--title planner-form-card planner-form-card--primary">
            <label className="planner-field planner-field--wide">
              <span>제목</span>
              <input autoFocus placeholder={`${categoryLabels[type]} 제목`} value={title} onChange={(changeEvent) => setTitle(changeEvent.target.value)} />
            </label>
            <label className="planner-field planner-field--wide">
              <span>메모</span>
              <input placeholder="링크, 준비물, 간단한 설명" value={meta} onChange={(changeEvent) => setMeta(changeEvent.target.value)} />
            </label>
          </div>

          <FormSectionTitle title="장소" description="이날 간 장소 탭과 지도에 함께 연결됩니다." />
          <PlaceSearchField selectedPlace={place} onSelect={setPlace} />

          <FormSectionTitle title="관계와 지출" description="지출은 가계부에 자동으로 연동됩니다." />
          <div className="event-form-card planner-form-card planner-form-card--grid">
            <label className="event-form-row event-form-row--field planner-field">
              <div className="event-form-row__label">
                <UsersRound aria-hidden size={18} />
                <span>함께한 사람</span>
              </div>
              <PeoplePickerField onChange={setCompanions} onCreatePerson={onCreatePerson} people={people} selectedNames={companions} />
            </label>

            <label className="event-form-row event-form-row--field planner-field">
              <div className="event-form-row__label">
                <WalletCards aria-hidden size={18} />
                <span>지출</span>
              </div>
              <input inputMode="numeric" placeholder="0" value={expenseAmount} onChange={(changeEvent) => setExpenseAmount(changeEvent.target.value.replace(/[^\d]/g, ""))} />
            </label>
          </div>

          <FormSectionTitle title="날짜" description="기본은 단일 날짜이며, 기간 설정을 켜면 종료 날짜를 함께 기록합니다." />
          <div className="event-form-card planner-form-card planner-form-card--grid planner-date-grid">
            <div className="planner-date-row">
              <label className="event-form-row event-form-row--field planner-field">
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
                <label className="event-form-row event-form-row--field planner-field">
                  <div className="event-form-row__label">
                    <CalendarDays aria-hidden size={18} />
                    <span>종료 날짜</span>
                  </div>
                  <input type="date" value={endDate} onChange={(changeEvent) => setEndDate(changeEvent.target.value)} />
                </label>
              ) : null}

              <label className="event-form-row event-form-row--select planner-field planner-toggle-row">
                <div className="event-form-row__label">
                  <CalendarDays aria-hidden size={18} />
                  <span>기간</span>
                </div>
                <label className="planner-option-toggle">
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
          <div className="event-form-card planner-form-card planner-form-card--grid planner-time-grid">
            <div className="planner-time-row">
              <label className="event-form-row event-form-row--select planner-field planner-toggle-row">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>시간</span>
                </div>
                <label className="planner-option-toggle">
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

              <label className="event-form-row event-form-row--field planner-field">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>시작 시간</span>
                </div>
                <input disabled={isAllDay} type="time" value={time} onChange={(changeEvent) => setTime(changeEvent.target.value)} />
              </label>

              {!isAllDay && hasEndTime ? (
                <label className="event-form-row event-form-row--field planner-field">
                  <div className="event-form-row__label">
                    <Clock3 aria-hidden size={18} />
                    <span>종료 시간</span>
                  </div>
                  <input type="time" value={endTime} onChange={(changeEvent) => setEndTime(changeEvent.target.value)} />
                </label>
              ) : null}

              <label className="event-form-row event-form-row--select planner-field planner-toggle-row">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>종료</span>
                </div>
                <label className="planner-option-toggle">
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

          <div className="event-form-card planner-form-card planner-form-card--grid">
            <label className="event-form-row event-form-row--select planner-field">
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
          <ActionButton disabled={isSaving} onClick={onClose} variant="secondary">
            취소
          </ActionButton>
          <ActionButton disabled={isSaving} onClick={saveCurrentEvent}>
            {isSaving ? "저장 중..." : "저장"}
          </ActionButton>
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
      <section aria-labelledby="task-sheet-title" aria-modal="true" className="event-sheet planner-sheet task-sheet" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header planner-sheet__header">
          <div>
            <h2 id="task-sheet-title">{task ? "할 일 수정" : "할 일 추가"}</h2>
            <p>{task ? "상태와 날짜를 조정합니다." : "예정일 기준으로 할 일을 추가합니다."}</p>
          </div>
          <IconButton label="닫기" onClick={onClose} tone="outline">
            <X aria-hidden size={18} />
          </IconButton>
        </header>

        <div className="event-sheet__body planner-sheet__body">
          <FormSectionTitle title="기본 정보" description="할 일의 핵심 내용과 메모를 적어두세요." />
          <div className="event-form-card event-form-card--title planner-form-card planner-form-card--primary">
            <label className="planner-field planner-field--wide">
              <span>제목</span>
              <input autoFocus placeholder="할 일 제목" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="planner-field planner-field--wide">
              <span>메모</span>
              <input placeholder="필요한 내용을 적어주세요." value={memo} onChange={(event) => setMemo(event.target.value)} />
            </label>
          </div>

          <FormSectionTitle title="장소" description="장소 탭의 날짜별 동선에 함께 반영됩니다." />
          <PlaceSearchField selectedPlace={place} onSelect={setPlace} />

          <FormSectionTitle title="관계와 지출" description="금액을 입력하면 가계부에 연결 지출로 기록됩니다." />
          <div className="event-form-card planner-form-card planner-form-card--grid">
            <label className="event-form-row event-form-row--field planner-field">
              <div className="event-form-row__label">
                <UsersRound aria-hidden size={18} />
                <span>함께한 사람</span>
              </div>
              <PeoplePickerField onChange={setCompanions} onCreatePerson={onCreatePerson} people={people} selectedNames={companions} />
            </label>

            <label className="event-form-row event-form-row--field planner-field">
              <div className="event-form-row__label">
                <WalletCards aria-hidden size={18} />
                <span>지출</span>
              </div>
              <input inputMode="numeric" placeholder="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value.replace(/[^\d]/g, ""))} />
            </label>
          </div>

          <FormSectionTitle title="진행 상태" description="상태와 우선순위로 오늘 할 일을 정리하세요." />
          <div className="event-form-card planner-form-card planner-form-card--grid">
            <label className="event-form-row event-form-row--select planner-field">
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

            <label className="event-form-row event-form-row--select planner-field">
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
          <div className="event-form-card planner-form-card planner-form-card--grid planner-date-grid">
            <div className="planner-date-row">
              <label className="event-form-row event-form-row--field planner-field">
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
                <label className="event-form-row event-form-row--field planner-field">
                  <div className="event-form-row__label">
                    <CalendarDays aria-hidden size={18} />
                    <span>종료 날짜</span>
                  </div>
                  <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                </label>
              ) : null}

              <label className="event-form-row event-form-row--select planner-field planner-toggle-row">
                <div className="event-form-row__label">
                  <CalendarDays aria-hidden size={18} />
                  <span>기간</span>
                </div>
                <label className="planner-option-toggle">
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
          <div className="event-form-card planner-form-card planner-form-card--grid planner-time-grid">
            <div className="planner-time-row">
              <label className="event-form-row event-form-row--select planner-field planner-toggle-row">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>시간</span>
                </div>
                <label className="planner-option-toggle">
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

              <label className="event-form-row event-form-row--field planner-field">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>시작 시간</span>
                </div>
                <input disabled={isAllDay} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
              </label>

              {!isAllDay && hasEndTime ? (
                <label className="event-form-row event-form-row--field planner-field">
                  <div className="event-form-row__label">
                    <Clock3 aria-hidden size={18} />
                    <span>종료 시간</span>
                  </div>
                  <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
                </label>
              ) : null}

              <label className="event-form-row event-form-row--select planner-field planner-toggle-row">
                <div className="event-form-row__label">
                  <Clock3 aria-hidden size={18} />
                  <span>종료</span>
                </div>
                <label className="planner-option-toggle">
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
          <ActionButton disabled={isSaving} onClick={onClose} variant="secondary">
            취소
          </ActionButton>
          <ActionButton disabled={isSaving} onClick={saveTask}>
            {isSaving ? "저장 중..." : "저장"}
          </ActionButton>
        </footer>
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
  daySummaries,
  isLoading,
  items,
  places,
  scope,
}: {
  daySummaries: PeriodDaySummary[];
  isLoading: boolean;
  items: DayTimelineItem[];
  places: PlanPlace[];
  scope: LifeCalendarScope;
}) {
  const summary = daySummaries[0];
  const finance = getFinanceTotals(items);
  const topCompanions = getTopValues(
    items.flatMap((item) => ("event" in item ? parseCompanionNames(item.event.companions) : "task" in item ? parseCompanionNames(item.task.companions) : [])),
  ).slice(0, 4);
  const topPlaces = getTopValues(places.map((place) => place.name)).slice(0, 4);
  const narrative = getDayNarrative(summary, finance, topCompanions, topPlaces);
  const periodNarrative = getPeriodNarrative(scope, daySummaries, finance, topCompanions, topPlaces);
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
            <div className="life-calendar-db-section__head life-calendar-db-section__head--canvas">
              <h3>기록으로 보는 하루</h3>
              <p className="eyebrow">하루 캔버스</p>
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
        <article className="life-calendar-db-story">
          <span>기간 서사</span>
          <strong>{periodNarrative}</strong>
        </article>
      </section>
    </div>
  );
}

type DayDetailView = "activities" | "map" | "photos" | null;
type DayActivityItem = Extract<DayTimelineItem, { external: ExternalCalendarItem }> & { type: "activity" };
type DayEventPreview = { id: string; meta: string; title: string; type: "event" | "todo" };
type DayLogItem = Extract<DayTimelineItem, { external: ExternalCalendarItem }> & { type: "daily_log" };
type DayPhotoItem = Extract<DayTimelineItem, { external: ExternalCalendarItem }> & { type: "photo" };
type DayStandalonePhotoGroup = { id: string; items: DayPhotoItem[]; sortMinutes: number; timeLabel: string };
type DayRouteStop = {
  address?: string;
  id: string;
  label: string;
  latitude?: number;
  longitude?: number;
  name: string;
  sortMinutes?: number;
  timeLabel: string;
};
type DayResolvedRouteStop = DayRouteStop & { latitude: number; longitude: number };

function LifeCalendarDayPanel({ isLoading, items }: { isLoading: boolean; items: DayTimelineItem[] }) {
  const [detailView, setDetailView] = useState<DayDetailView>(null);
  const [photoViewer, setPhotoViewer] = useState<{ items: DayPhotoItem[]; title: string } | null>(null);
  const activityItems = useMemo(
    () => items.filter((item): item is DayActivityItem => "external" in item && item.external.type === "activity"),
    [items],
  );
  const photoItems = useMemo(
    () => items.filter((item): item is DayPhotoItem => "external" in item && item.external.type === "photo"),
    [items],
  );
  const logItems = useMemo(
    () => items.filter((item): item is DayLogItem => "external" in item && item.external.type === "daily_log"),
    [items],
  );
  const routeStops = useMemo(() => buildDayRouteStops(items), [items]);
  const previewPhotos = photoItems.slice(0, 3);
  const finance = useMemo(() => getFinanceTotals(items), [items]);
  const linkedPhotosByActivityId = useMemo(() => buildLinkedPhotoMap(photoItems), [photoItems]);
  const standalonePhotoGroups = useMemo(() => buildStandalonePhotoGroups(photoItems), [photoItems]);
  const timelineRows = useMemo(
    () =>
      [
        ...activityItems.map((item) => ({ id: item.id, item, kind: "activity" as const, sortMinutes: item.sortMinutes })),
        ...standalonePhotoGroups.map((group) => ({ group, id: group.id, kind: "photo" as const, sortMinutes: group.sortMinutes })),
      ].sort((left, right) => left.sortMinutes - right.sortMinutes || left.id.localeCompare(right.id)),
    [activityItems, standalonePhotoGroups],
  );
  const companionCounts = useMemo(
    () => getTopValues(activityItems.flatMap((item) => parseCompanionNames(item.external.companions))).slice(0, 8),
    [activityItems],
  );
  const visiblePhotoItems = photoViewer?.items ?? photoItems;

  const openPhotoViewer = (nextItems: DayPhotoItem[], title: string) => {
    setPhotoViewer({ items: nextItems, title });
    setDetailView("photos");
  };

  const closeDetail = () => {
    setDetailView(null);
    setPhotoViewer(null);
  };

  return (
    <>
      <div className="life-calendar-day-panel">
        <div className="life-calendar-day-panel__layout">
          <section className="life-calendar-day-card life-calendar-day-card--timeline">
            <div className="life-calendar-day-card__head">
              <span>활동 타임라인</span>
              <b>{activityItems.length}건</b>
            </div>
            <div className="life-calendar-day-timeline">
              {timelineRows.length > 0 ? timelineRows.map((row) => {
                if (row.kind === "activity") {
                  const item = row.item;
                  const linkedPhotos = linkedPhotosByActivityId.get(item.external.id) ?? [];
                  return (
                    <article className="life-calendar-day-timeline__item" key={item.id}>
                      <div className="life-calendar-day-timeline__time">
                        <span>{formatTimelineRange(item.timeLabel, item.external.endTime)}</span>
                        <div className="life-calendar-day-timeline__tags">
                          {linkedPhotos.length > 0 ? (
                            <button className="life-calendar-day-photo-badge" onClick={() => openPhotoViewer(linkedPhotos, item.external.title)} type="button">
                              <Camera aria-hidden size={12} />
                              {linkedPhotos.length}
                            </button>
                          ) : null}
                          {[item.external.category].filter(Boolean).slice(0, 3).map((tag, index) => <b className={`life-calendar-day-tag life-calendar-day-tag--${index % 3}`} key={`${item.id}-${tag}`}>{tag}</b>)}
                        </div>
                      </div>
                      <div className="life-calendar-day-timeline__body">
                        <strong>{item.external.title}</strong>
                        {item.external.placeName ? <p><MapPin aria-hidden size={14} /> {item.external.placeName}</p> : null}
                        {item.external.companions ? <p><UsersRound aria-hidden size={14} /> {item.external.companions}</p> : null}
                        {item.external.food ? <p><UtensilsCrossed aria-hidden size={14} /> {item.external.food}</p> : null}
                        {item.external.amount ? <p><Banknote aria-hidden size={14} /> {formatExpenseAmount(item.external.amount)}</p> : null}
                      </div>
                    </article>
                  );
                }

                const group = row.group;
                return (
                  <article className="life-calendar-day-timeline__item life-calendar-day-timeline__item--photo" key={group.id}>
                    <div className="life-calendar-day-timeline__time">
                      <span>{group.timeLabel}</span>
                      <div className="life-calendar-day-timeline__tags">
                        <button className="life-calendar-day-photo-badge" onClick={() => openPhotoViewer(group.items, `${group.timeLabel} 사진`)} type="button">
                          <Camera aria-hidden size={12} />
                          {group.items.length}
                        </button>
                      </div>
                    </div>
                    <div className="life-calendar-day-timeline__body">
                      <strong>날짜에 연결된 사진</strong>
                      <p>{getStandalonePhotoGroupSummary(group)}</p>
                    </div>
                  </article>
                );
              }) : <div className="life-calendar-db-empty life-calendar-day-timeline__empty">{isLoading ? "기록 불러오는 중..." : "이 날 저장된 활동 기록이 아직 없어요."}</div>}
            </div>
          </section>

          <button className="life-calendar-day-card life-calendar-day-card--map" onClick={() => setDetailView("map")} type="button">
            <div className="life-calendar-day-card__head">
              <span>동선 지도</span>
              <div className="life-calendar-day-card__meta">
                <b>{routeStops.length}건</b>
                <small>자세히 보기</small>
              </div>
            </div>
            <DayRouteMap compact stops={routeStops} />
          </button>

          <button className="life-calendar-day-card life-calendar-day-card--photos" onClick={() => openPhotoViewer(photoItems, "사진 갤러리")} type="button">
            <div className="life-calendar-day-card__head">
              <span>사진 기억</span>
              <b>{photoItems.length > 3 ? "모두 보기" : "갤러리 보기"}</b>
            </div>
            <div className="life-calendar-day-photo-preview">
              {previewPhotos.length > 0 ? previewPhotos.map((item) => (
                <figure className="life-calendar-day-photo-preview__item" key={item.id}>
                  <div className="life-calendar-day-photo-preview__media">
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
                  </div>
                  <figcaption>
                    <strong>{getPhotoCardTitle(item)}</strong>
                    <span>{getPhotoCardMeta(item)}</span>
                  </figcaption>
                </figure>
              )) : <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "사진이 아직 없어요."}</div>}
            </div>
          </button>

          <section className="life-calendar-day-card life-calendar-day-card--companions">
            <div className="life-calendar-day-card__head">
              <span>함께한 사람</span>
              <b>{companionCounts.length}명</b>
            </div>
            <div className="life-calendar-day-card__chips">
              {companionCounts.length > 0 ? companionCounts.map((item) => <b key={item.value}>{item.value} · {item.count}회</b>) : <p>이 날 함께한 사람 기록이 아직 없어요.</p>}
            </div>
          </section>

          <section className="life-calendar-day-card life-calendar-day-card--finance">
            <div className="life-calendar-day-card__head">
              <span>총 수입·지출</span>
              <b>{formatNumberWithUnit(finance.net, "원")}</b>
            </div>
            <div className="life-calendar-day-finance">
              <article>
                <span>수입</span>
                <strong>{formatNumberWithUnit(finance.income, "원")}</strong>
              </article>
              <article>
                <span>지출</span>
                <strong>{formatExpenseValueWithUnit(finance.expense, "원")}</strong>
              </article>
            </div>
          </section>

          <section className="life-calendar-day-card life-calendar-day-card--logs">
            <div className="life-calendar-day-card__head">
              <span>하루 기록</span>
              <b>{logItems.length}건</b>
            </div>
            <div className="life-calendar-day-logs">
              {logItems.length > 0 ? logItems.slice(0, 2).map((item) => (
                <article key={item.id}>
                  <span>{item.timeLabel}</span>
                  <p>{item.external.meta || item.external.title}</p>
                </article>
              )) : <p>남은 하루 기록이 없어요.</p>}
            </div>
          </section>
        </div>
      </div>

      {detailView ? (
        <div className="life-detail-overlay" onClick={closeDetail}>
          <section className="life-detail-drawer life-calendar-day-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
            <div className="life-detail-drawer__head">
              <div>
                <span>{detailView === "map" ? "동선 지도" : detailView === "activities" ? "활동 기록" : photoViewer?.title || "사진 갤러리"}</span>
                <h2>{detailView === "map" ? "이 날 방문한 장소 흐름" : detailView === "activities" ? "시간 순 활동 기록" : "사진으로 남은 장면"}</h2>
                <p>
                  {detailView === "map"
                    ? "좌표가 있는 장소는 바로 그리고, 없는 장소는 검색 API로 보강해 동선을 구성합니다."
                    : detailView === "activities"
                      ? "활동 기록만 시간대 순으로 보여줘서 이 날의 실제 움직임이 눈에 잘 들어오게 했어요."
                      : "시간, 연결된 기록, 장소 문맥을 함께 보면서 사진 흐름을 확인할 수 있어요."}
                </p>
              </div>
              <IconButton label="닫기" onClick={closeDetail} tone="outline">
                <X aria-hidden size={18} />
              </IconButton>
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
                {visiblePhotoItems.length > 0 ? visiblePhotoItems.map((item) => (
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
                        <strong>{getPhotoCardTitle(item)}</strong>
                        <span>{getPhotoCardMeta(item)}</span>
                        {getPhotoContextLines(item).map((line) => <em key={`${item.id}-${line}`}>{line}</em>)}
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
  const [isResolvingStops, setIsResolvingStops] = useState(false);

  useEffect(() => {
    if (!naverMapClientId) {
      setMapStatus("missing-key");
      return;
    }

    if (isNaverMapReady()) {
      setMapStatus("ready");
      return;
    }

    loadNaverMapScript().then(
      () => setMapStatus("ready"),
      () => setMapStatus("error"),
    );
  }, []);

  useEffect(() => {
    const unresolvedStops = stops.filter((stop) => !hasCoordinates(stop) && (stop.address || stop.name));
    if (unresolvedStops.length === 0) {
      setIsResolvingStops(false);
      return;
    }

    let isMounted = true;
    setIsResolvingStops(true);
    Promise.all(
      unresolvedStops.map((stop) => resolveDayRouteStopCoordinates(stop)),
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
      setIsResolvingStops(false);
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
      mapRef.current.setZoom(compact ? 16 : 15);
      return;
    }

    const bounds = new window.naver.maps.LatLngBounds();
    visibleStops.forEach((stop) => bounds.extend(new window.naver!.maps.LatLng(stop.latitude!, stop.longitude!)));
    syncDayRouteMapViewport(mapRef.current, bounds, compact);
  }, [compact, mapStatus, visibleStops]);

  useEffect(() => {
    if (!mapElementRef.current || !mapRef.current || !window.naver?.maps || visibleStops.length === 0) return;

    const handleResize = () => {
      const bounds = new window.naver!.maps.LatLngBounds();
      visibleStops.forEach((stop) => bounds.extend(new window.naver!.maps.LatLng(stop.latitude!, stop.longitude!)));
      syncDayRouteMapViewport(mapRef.current, bounds, compact);
    };

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      window.requestAnimationFrame(handleResize);
    });
    observer?.observe(mapElementRef.current);
    window.requestAnimationFrame(handleResize);

    return () => observer?.disconnect();
  }, [compact, visibleStops]);

  useEffect(() => {
    if (visibleStops.length > 0) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    polylineRef.current?.setMap(null);
    polylineRef.current = null;
  }, [visibleStops.length]);

  const overlayMessage =
    mapStatus === "missing-key"
      ? "네이버 지도 키가 없어서 지도를 표시할 수 없어요."
      : visibleStops.length === 0 && isResolvingStops
        ? "장소 좌표를 확인하면서 지도를 준비하고 있어요."
        : visibleStops.length === 0
          ? "지도에 그릴 장소 기록을 더 쌓아보면 여기서 하루 동선이 보입니다."
          : null;

  return (
    <div className={`life-calendar-day-map-shell ${compact ? "life-calendar-day-map-shell--compact" : ""}`}>
      <div className={`life-calendar-day-map ${compact ? "life-calendar-day-map--compact" : ""} ${overlayMessage ? "life-calendar-day-map--hidden" : ""}`} ref={mapElementRef} />
      {overlayMessage ? <div className={`life-calendar-day-map-overlay life-calendar-day-map--empty ${compact ? "life-calendar-day-map--compact" : ""}`}>{overlayMessage}</div> : null}
    </div>
  );
}

async function resolveDayRouteStopCoordinates(stop: DayRouteStop) {
  const candidates = [
    stop.address?.trim(),
    stop.name?.trim(),
    [stop.name, stop.address].filter(Boolean).join(" ").trim(),
  ].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);

  for (const query of candidates) {
    const cached = dayRouteGeocodeCache.get(query);
    if (cached !== undefined) {
      if (cached) return { id: stop.id, latitude: cached.latitude, longitude: cached.longitude };
      continue;
    }

    try {
      const endpoint = query === stop.address?.trim() ? "/api/maps/geocode" : "/api/maps/search-place";
      const response = await fetch(`${endpoint}?query=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as { places?: Array<{ latitude: number; longitude: number }> };
      const firstPlace = payload.places?.[0];
      if (!firstPlace) {
        dayRouteGeocodeCache.set(query, null);
        continue;
      }

      const resolved = { latitude: firstPlace.latitude, longitude: firstPlace.longitude };
      dayRouteGeocodeCache.set(query, resolved);
      return { id: stop.id, latitude: resolved.latitude, longitude: resolved.longitude };
    } catch (error) {
      console.error("Failed to resolve day route stop", error);
      dayRouteGeocodeCache.set(query, null);
    }
  }

  return null;
}

function syncDayRouteMapViewport(map: NaverMap | null, bounds: NaverLatLngBounds, compact: boolean) {
  if (!map || !window.naver?.maps) return;
  const padding = compact ? { bottom: 24, left: 24, right: 24, top: 24 } : { bottom: 56, left: 40, right: 40, top: 40 };
  (window.naver.maps.Event as { trigger?: (target: unknown, eventName: string) => void }).trigger?.(map, "resize");
  map.fitBounds(bounds, padding);
  const boundsCenter = (bounds as NaverLatLngBounds & { getCenter?: () => NaverLatLng }).getCenter?.();
  if (boundsCenter) {
    map.setCenter(boundsCenter);
  }
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

function getPeriodNarrative(
  scope: Exclude<LifeCalendarScope, "day"> | LifeCalendarScope,
  daySummaries: PeriodDaySummary[],
  finance: { expense: number; income: number; net: number },
  topCompanions: Array<{ count: number; value: string }>,
  topPlaces: Array<{ count: number; value: string }>,
) {
  if (scope === "day") return getDayNarrative(daySummaries[0], finance, topCompanions, topPlaces);
  if (daySummaries.length === 0) return "아직 이 기간을 해석할 만큼 쌓인 기록이 없어요.";

  const totalCount = daySummaries.reduce((sum, summary) => sum + summary.totalCount, 0);
  const activeDays = daySummaries.length;
  const totalActivities = daySummaries.reduce((sum, summary) => sum + summary.activityCount, 0);
  const totalRecords = daySummaries.reduce((sum, summary) => sum + summary.recordCount, 0);
  const peakDay = [...daySummaries].sort((left, right) => right.totalCount - left.totalCount || left.date.localeCompare(right.date))[0];
  const density =
    totalCount >= 28 ? "기록 밀도가 꽤 높은 기간" :
    totalCount >= 14 ? "생활 흔적이 비교적 고르게 남은 기간" :
    "비교적 조용하게 지나간 기간";
  const rhythm =
    peakDay && peakDay.totalCount > 0
      ? `${formatMonthDayLabel(peakDay.date)}에 가장 많은 흐름이 몰렸고`
      : "특정 날짜에 크게 쏠리지는 않았고";
  const people =
    topCompanions[0]
      ? `${topCompanions[0].value}와 연결된 장면이 가장 자주 반복됐어요.`
      : "혼자 정리된 기록 비중이 더 높아요.";
  const place =
    topPlaces[0]
      ? `${topPlaces[0].value} 축이 기간 전체의 대표 배경으로 보이고`
      : "뚜렷한 장소 축은 아직 약하고";
  const recordTone =
    totalActivities > totalRecords
      ? `활동 기록(${totalActivities}건)이 사진·하루기록(${totalRecords}건)보다 앞서며 움직임 중심의 기간이었어요.`
      : `사진·하루기록(${totalRecords}건)이 활동 기록(${totalActivities}건)과 비슷하거나 더 많아 회고성이 살아 있는 기간이었어요.`;
  const financeTone =
    finance.net > 0 ? `자금 흐름은 ${formatNumberWithUnit(finance.net, " 순증")}으로 마무리됐어요.` :
    finance.net < 0 ? `자금 흐름은 ${formatNumberWithUnit(finance.net, " 순지출")}이었어요.` :
    "자금 흐름은 큰 편차 없이 균형에 가까웠어요.";

  return `${density}. ${activeDays}일에 기록이 남았고, ${rhythm} ${place} ${people} ${recordTone} ${financeTone}`;
}

function getDayEventCounts(items: DayTimelineItem[]) {
  return items.reduce(
    (counts, item) => {
      if ("event" in item) counts.event += 1;
      if ("task" in item) counts.todo += 1;
      return counts;
    },
    { event: 0, todo: 0 },
  );
}

function buildDayEventGroups(items: DayTimelineItem[]) {
  const groups: Record<"event" | "todo", DayEventPreview[]> = {
    event: [],
    todo: [],
  };

  items.forEach((item) => {
    if ("event" in item) {
      groups.event.push({
        id: item.id,
        meta: item.timeLabel === "하루종일" ? "종일" : item.timeLabel,
        title: item.event.title,
        type: "event",
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
    todo: groups.todo.slice(0, 3),
  };
}

function buildDayRouteStops(items: DayTimelineItem[]) {
  const stops: DayRouteStop[] = [];
  const targetPlaces = buildLinkedTargetPlaceMap(items);
  const photoItems = items.filter((item): item is DayPhotoItem => "external" in item && item.external.type === "photo");
  const linkedPhotosByActivityId = buildLinkedPhotoMap(photoItems);

  items.forEach((item) => {
    if ("event" in item && item.event.place) {
      stops.push({
        address: item.event.place.address,
        id: item.id,
        label: categoryLabels[item.event.type as CalendarCategory],
        latitude: item.event.place.latitude,
        longitude: item.event.place.longitude,
        name: item.event.place.name,
        sortMinutes: item.sortMinutes,
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
        sortMinutes: item.sortMinutes,
        timeLabel: item.timeLabel,
      });
      return;
    }

    if ("external" in item && item.external.type === "activity") {
      if (item.external.placeName) {
        stops.push({
          address: item.external.placeAddress,
          id: item.id,
          label: "활동",
          latitude: item.external.placeLatitude,
          longitude: item.external.placeLongitude,
          name: item.external.placeName,
          sortMinutes: item.sortMinutes,
          timeLabel: item.timeLabel,
        });
        return;
      }

      const linkedPhotos = linkedPhotosByActivityId.get(item.external.id) ?? [];
      const photoSource = linkedPhotos.find((photo) => typeof photo.external.placeLatitude === "number" && typeof photo.external.placeLongitude === "number");
      if (photoSource) {
        stops.push({
          id: item.id,
          label: "활동",
          latitude: photoSource.external.placeLatitude,
          longitude: photoSource.external.placeLongitude,
          name: item.external.title,
          sortMinutes: item.sortMinutes,
          timeLabel: item.timeLabel,
        });
        return;
      }
    }

    if ("external" in item && item.external.type === "photo") {
      if (item.external.linkedTargetType === "activity" && item.external.linkedTargetId) return;

      if (!item.external.linkedTargetId) {
        if (typeof item.external.placeLatitude !== "number" || typeof item.external.placeLongitude !== "number") return;
        stops.push({
          address: item.external.placeAddress,
          id: item.id,
          label: "사진",
          latitude: item.external.placeLatitude,
          longitude: item.external.placeLongitude,
          name: getPhotoStopName(item.external),
          sortMinutes: item.sortMinutes,
          timeLabel: formatPhotoTimeLabel(item.external),
        });
        return;
      }

      const linkedPlace = item.external.linkedTargetId && item.external.linkedTargetType
        ? targetPlaces.get(`${item.external.linkedTargetType}:${item.external.linkedTargetId}`)
        : undefined;
      if (!linkedPlace) return;
      stops.push({
        address: linkedPlace.address,
        id: item.id,
        label: "사진",
        latitude: linkedPlace.latitude,
        longitude: linkedPlace.longitude,
        name: `${formatPhotoTimeLabel(item.external)} 사진`,
        sortMinutes: item.sortMinutes,
        timeLabel: formatPhotoTimeLabel(item.external),
      });
    }
  });

  return stops
    .sort((left, right) => (left.sortMinutes ?? 0) - (right.sortMinutes ?? 0))
    .filter((stop, index, array) => {
      const previous = array[index - 1];
      if (!previous) return true;
      return `${previous.name}|${previous.address ?? ""}` !== `${stop.name}|${stop.address ?? ""}`;
    });
}

function hasCoordinates(stop: DayRouteStop): stop is DayResolvedRouteStop {
  return typeof stop.latitude === "number" && Number.isFinite(stop.latitude) && typeof stop.longitude === "number" && Number.isFinite(stop.longitude);
}

function formatNumberWithUnit(value: number, unit: string) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${new Intl.NumberFormat("ko-KR").format(Math.abs(value))}${unit}`;
}

function formatMonthDayLabel(dateKey: string) {
  return new Intl.DateTimeFormat("ko-KR", { day: "numeric", month: "numeric" }).format(new Date(`${dateKey}T00:00:00`));
}

function buildLinkedTargetPlaceMap(items: DayTimelineItem[]) {
  const placeMap = new Map<string, { address?: string; latitude?: number; longitude?: number; name: string }>();

  items.forEach((item) => {
    if ("event" in item && item.event.place) {
      placeMap.set(`${item.event.type}:${item.event.id}`, {
        address: item.event.place.address,
        latitude: item.event.place.latitude,
        longitude: item.event.place.longitude,
        name: item.event.place.name,
      });
      return;
    }

    if ("task" in item && item.task.place) {
      placeMap.set(`todo:${item.task.id}`, {
        address: item.task.place.address,
        latitude: item.task.place.latitude,
        longitude: item.task.place.longitude,
        name: item.task.place.name,
      });
      return;
    }

    if ("external" in item && item.external.type === "activity" && item.external.placeName) {
      placeMap.set(`activity:${item.external.id}`, {
        address: item.external.placeAddress,
        latitude: item.external.placeLatitude,
        longitude: item.external.placeLongitude,
        name: item.external.placeName,
      });
    }
  });

  return placeMap;
}

function buildLinkedPhotoMap(photoItems: DayPhotoItem[]) {
  const map = new Map<string, DayPhotoItem[]>();

  photoItems.forEach((item) => {
    if (item.external.linkedTargetType !== "activity" || !item.external.linkedTargetId) return;
    const existing = map.get(item.external.linkedTargetId) ?? [];
    existing.push(item);
    map.set(item.external.linkedTargetId, existing);
  });

  return map;
}

function buildStandalonePhotoGroups(photoItems: DayPhotoItem[]) {
  const groups = new Map<string, DayStandalonePhotoGroup>();

  photoItems
    .filter((item) => !item.external.linkedTargetId)
    .forEach((item) => {
      const key = `${item.sortMinutes}-${formatPhotoTimeLabel(item.external)}`;
      const current = groups.get(key);
      if (current) {
        current.items.push(item);
        return;
      }
      groups.set(key, {
        id: `photo-group-${key}`,
        items: [item],
        sortMinutes: item.sortMinutes,
        timeLabel: formatPhotoTimeLabel(item.external),
      });
    });

  return [...groups.values()].sort((left, right) => left.sortMinutes - right.sortMinutes);
}

function formatPhotoTimeLabel(photo: ExternalCalendarItem) {
  if (photo.takenAt) {
    return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(photo.takenAt));
  }
  return photo.startTime ? getTimelineTimeLabel(photo.startTime, photo.isAllDay) : "기록";
}

function getPhotoCardTitle(item: DayPhotoItem) {
  return item.external.caption || item.external.linkedTargetTitle || "사진 기록";
}

function getPhotoCardMeta(item: DayPhotoItem) {
  const values = [
    formatPhotoTimeLabel(item.external),
    item.external.linkedTargetTitle ? `${getLinkedTargetTypeLabel(item.external.linkedTargetType)} · ${item.external.linkedTargetTitle}` : null,
  ].filter(Boolean);

  return values.join(" · ") || "사진 기록";
}

function getPhotoContextLines(item: DayPhotoItem) {
  return [
    item.external.linkedTargetTitle ? `${getLinkedTargetTypeLabel(item.external.linkedTargetType)}에 연결됨` : null,
    item.external.placeName ? item.external.placeName : null,
    item.external.meta && item.external.meta !== item.external.caption ? item.external.meta : null,
  ].filter(Boolean) as string[];
}

function getStandalonePhotoGroupSummary(group: DayStandalonePhotoGroup) {
  const firstPhoto = group.items[0];
  if (!firstPhoto) return "이 시간대에 남은 사진 기록";
  if (group.items.length === 1) return firstPhoto.external.caption || firstPhoto.external.meta || "이 시간대에 남은 사진 기록";
  return `${firstPhoto.external.caption || firstPhoto.external.meta || "사진 기록"} 외 ${group.items.length - 1}장`;
}

function getPhotoStopName(photo: ExternalCalendarItem) {
  const timeLabel = formatPhotoTimeLabel(photo);
  const subject = photo.placeName || photo.caption || "사진";
  return `${timeLabel} ${subject}`;
}

function getLinkedTargetTypeLabel(type?: "todo" | "event" | "activity") {
  if (type === "todo") return "할 일";
  if (type === "event") return "이벤트";
  if (type === "activity") return "활동";
  return "기록";
}

function formatExpenseValueWithUnit(value: number, unit: string) {
  if (value === 0) return `0${unit}`;
  return `-${new Intl.NumberFormat("ko-KR").format(Math.abs(value))}${unit}`;
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
  const weekday = date.getDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  start.setDate(date.getDate() + mondayOffset);
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

function buildPeriodDaySummaries(start: string, end: string, events: CalendarEvent[], tasks: TaskItem[], externalItems: ExternalCalendarItem[]) {
  const allDates = enumerateDates(start, end);
  return allDates
    .map((date) => {
      const dayEvents = events.filter((item) => isDateInRange(date, item.date, item.endDate));
      const dayTasks = tasks.filter((item) => isDateInRange(date, item.scheduledDate, item.dueDate));
      const dayExternalItems = externalItems.filter((item) => item.date === date);
      const items = [
        ...dayTasks.map((item) => createTaskTimelineItem(item)),
        ...dayEvents.map((item) => createEventTimelineItem(item)),
        ...dayExternalItems.map((item) => createExternalTimelineItem(item)),
      ];
      const places = uniquePlanPlaces(
        [...dayEvents, ...dayTasks]
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
        planCount: dayEvents.length + dayTasks.length,
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
  return {
    category: "이벤트",
    companions: event.companions,
    date: event.date,
    endTime: event.endTime,
    expenseAmount: event.expenseAmount,
    isAllDay: event.isAllDay,
    memo: event.meta,
    placeAddress: event.place?.address,
    placeName: event.place?.name,
    sourceId: event.id,
    sourceType: "event",
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
    id: `event-${event.id}`,
    sortMinutes: getTimelineSortMinutes(event.time, event.isAllDay),
    timeLabel: getTimelineTimeLabel(event.time, event.isAllDay),
    type: "event",
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
  const photoTime = external.type === "photo" ? getPhotoTakenTime(external.takenAt) : null;
  const sortMinutes =
    photoTime !== null
      ? photoTime
      : external.startTime
        ? getTimelineSortMinutes(external.startTime, external.isAllDay)
        : 24 * 60 + getTimelineTypeOrder(external.type);
  const timeLabel =
    photoTime !== null
      ? formatMinutesToTimeLabel(photoTime)
      : external.startTime && !external.isAllDay
        ? getTimelineTimeLabel(external.startTime, external.isAllDay)
        : "기록";

  return {
    external,
    id: `${external.type}-${external.id}`,
    sortMinutes,
    timeLabel,
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

function getPhotoTakenTime(takenAt?: string) {
  if (!takenAt) return null;
  const date = new Date(takenAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function formatMinutesToTimeLabel(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatTimelineRange(startLabel: string, endTime?: string) {
  if (!endTime || startLabel === "하루종일" || startLabel === "기록" || startLabel === "시간 미정") return startLabel;
  return `${startLabel} ~ ${endTime}`;
}

function formatExpenseAmount(amount: number) {
  return `-${new Intl.NumberFormat("ko-KR").format(amount)}원`;
}

function getTimelineTypeOrder(type: CalendarCategory | ExternalCalendarCategory) {
  const order: Record<CalendarCategory | ExternalCalendarCategory, number> = {
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
  const planCount = categoryDisplayOrder
    .filter((type) => categories.includes(type))
    .reduce((count, type) => count + (type === "todo" ? tasks.length : events.filter((event) => event.type === type).length), 0);
  const recordCount = externalItems.filter((item) => item.type === "activity" || item.type === "expense" || item.type === "income" || item.type === "daily_log" || item.type === "photo").length;
  return {
    hasPlan: planCount > 0,
    hasRecord: recordCount > 0,
    planCount,
    recordCount,
    totalCount: planCount + recordCount,
  };
}
