"use client";

import type { DragEvent } from "react";
import { useEffect, useMemo, useState } from "react";
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
import type { EventType, PlanPlace, TaskItem, TaskPriority, TaskStatus } from "@/types/domain";
import { deleteLinkedExpenseRecordInDb, syncLinkedExpenseRecordInDb } from "@/features/ledger/api";
import { createLifeActivityInDb, deleteLifeActivitiesBySourceFromDb, updateLifeActivitiesBySourceInDb } from "@/features/life/api";
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
};

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const initialMonth = new Date();
const yearOptions = Array.from({ length: 151 }, (_, index) => new Date().getFullYear() - 75 + index);

export function CalendarView({
  allowedTypes,
  defaultSelectedDate = null,
  description,
  externalItems = [],
  headerVariant = "page",
  keepDateSelected = false,
  showEventAddButton = false,
  showSelectedDatePlacesMap = true,
  title = "일정",
}: CalendarViewProps) {
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
  const [draggingItem, setDraggingItem] = useState<{ id: string; type: CalendarCategory } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; placement: DragPlacement } | null>(null);
  const [activityConversionMessage, setActivityConversionMessage] = useState("");
  const [convertingToActivity, setConvertingToActivity] = useState<{ id: string; type: "event" | "task" } | null>(null);

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

  const visibleEvents = events.filter((event) => categories.includes(event.type as CalendarCategory));
  const visibleCalendarCategories = calendarCategoryFilters.length > 0 ? calendarCategoryFilters : categories;
  const orderedVisibleCalendarCategories = categoryDisplayOrder.filter((type) => visibleCalendarCategories.includes(type));
  const monthDays = getMonthDays(currentMonth.getFullYear(), currentMonth.getMonth());
  const todayKey = useMemo(() => formatDateKey(new Date()), []);
  const selectedSchedules = useMemo(() => (selectedDate ? visibleEvents.filter((event) => isDateInRange(selectedDate, event.date, event.endDate) && event.type === "schedule") : []), [selectedDate, visibleEvents]);
  const selectedEvents = useMemo(() => (selectedDate ? visibleEvents.filter((event) => isDateInRange(selectedDate, event.date, event.endDate) && event.type === "event") : []), [selectedDate, visibleEvents]);
  const selectedTasks = useMemo(() => (selectedDate ? tasks.filter((task) => isDateInRange(selectedDate, task.scheduledDate, task.dueDate)) : []), [selectedDate, tasks]);
  const selectedExternalItems = useMemo(() => (selectedDate ? externalItems.filter((item) => item.date === selectedDate) : []), [externalItems, selectedDate]);
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
    if (!selectedDate) return { schedule: 0, event: 0, todo: 0 };
    return {
      schedule: visibleEvents.filter((event) => isDateInRange(selectedDate, event.date, event.endDate) && event.type === "schedule").length,
      event: visibleEvents.filter((event) => isDateInRange(selectedDate, event.date, event.endDate) && event.type === "event").length,
      todo: selectedTasks.length,
    };
  }, [selectedDate, selectedTasks.length, visibleEvents]);
  const selectedPlanPlaces = useMemo(
    () => uniquePlanPlaces([...selectedSchedules, ...selectedEvents, ...selectedTasks].map((item) => item.place).filter((place): place is PlanPlace => Boolean(place))),
    [selectedEvents, selectedSchedules, selectedTasks],
  );

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

  const saveEvent = async (event: CalendarEvent) => {
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
  };

  const deleteEvent = async (id: string) => {
    const targetEvent = events.find((event) => event.id === id);
    await deleteCalendarEventFromDb(id);
    if (targetEvent) await deleteLinkedExpenseRecordInDb(targetEvent.type === "event" ? "event" : "schedule", id);
    if (targetEvent) await deleteLifeActivitiesBySourceFromDb(targetEvent.type === "event" ? "event" : "schedule", id);
    setEvents((current) => current.filter((item) => item.id !== id));
  };

  const saveTask = async (task: TaskItem) => {
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
  };

  const deleteTask = async (id: string) => {
    await deleteTaskFromDb(id);
    await deleteLinkedExpenseRecordInDb("todo", id);
    await deleteLifeActivitiesBySourceFromDb("todo", id);
    setTasks((current) => current.filter((item) => item.id !== id));
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
        <div className="header-actions">
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
        </div>
      </header>

      <div className={`calendar-layout ${selectedDate ? "calendar-layout--detail-open" : ""}`}>
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
                {categoryLabels[type]}
              </button>
            ))}
          </div>

          <div className="calendar-weekdays">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
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
                  {cell.day ? <span className="calendar-day__number">{cell.day}</span> : null}
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

        {selectedDate ? (
          <aside className="calendar-detail">
            <SectionCard className="date-detail-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">선택한 날짜</p>
                  <h2>{formatSelectedDate(selectedDate)}</h2>
                </div>
              </div>

              {showSelectedDatePlacesMap ? <SelectedDatePlacesMap places={selectedPlanPlaces} /> : null}

              <div className="date-event-list">
                <DayTimelineSection
                  countsByCategory={countsByCategory}
                  draggingItem={draggingItem}
                  dropTarget={dropTarget}
                  externalCount={selectedExternalItems.length}
                  isConvertingToActivity={convertingToActivity}
                  isLoading={isLoading}
                  items={selectedTimelineItems}
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
                  visibleCategories={detailSections.map((section) => section.type)}
                />
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
          onClose={() => {
            setIsEventSheetOpen(false);
            setEditingEvent(null);
          }}
          onSave={saveEvent}
        />
      ) : null}

      {isTaskSheetOpen ? (
        <TaskCreateSheet
          defaultDate={selectedDate ?? formatDateKey(currentMonth)}
          onClose={() => {
            setIsTaskSheetOpen(false);
            setEditingTask(null);
          }}
          onSave={saveTask}
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
  onClose,
  onSave,
}: {
  allowedTypes: CalendarCategory[];
  defaultDate: string;
  defaultType: CalendarCategory;
  event: CalendarEvent | null;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
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
  const [companions, setCompanions] = useState(event?.companions ?? "");
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
      companions: companions.trim() || undefined,
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
              <input placeholder="이름을 쉼표로 구분" value={companions} onChange={(changeEvent) => setCompanions(changeEvent.target.value)} />
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
          <button className="event-sheet__secondary-button" onClick={onClose} type="button">
            취소
          </button>
          <button className="event-sheet__primary-button" onClick={saveCurrentEvent} type="button">
            저장
          </button>
        </footer>
      </section>
    </div>
  );
}

function TaskCreateSheet({
  defaultDate,
  onClose,
  onSave,
  task,
}: {
  defaultDate: string;
  onClose: () => void;
  onSave: (task: TaskItem) => void;
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
  const [companions, setCompanions] = useState(task?.companions ?? "");
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
      companions: companions.trim() || undefined,
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
              <input placeholder="이름을 쉼표로 구분" value={companions} onChange={(event) => setCompanions(event.target.value)} />
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
          <button className="event-sheet__secondary-button" onClick={onClose} type="button">
            취소
          </button>
          <button className="event-sheet__primary-button" onClick={saveTask} type="button">
            저장
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

function getTimelineTypeOrder(type: CalendarCategory | ExternalCalendarCategory) {
  const order: Record<CalendarCategory | ExternalCalendarCategory, number> = {
    schedule: 0,
    todo: 1,
    event: 2,
    activity: 3,
    expense: 3,
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

  const externalSummaries = (["expense", "workout", "weight", "daily_log", "photo"] as const)
    .map((type) => ({
      type,
      count: externalItems.filter((item) => item.type === type).length,
    }))
    .filter((summary) => summary.count > 0);

  return [...planSummaries, ...externalSummaries];
}
