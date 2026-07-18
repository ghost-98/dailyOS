"use client";

import type { DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListChecks,
  ListFilter,
  MapPin,
  Maximize2,
  Pencil,
  Plus,
  Route,
  Search,
  Trash2,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import type { EventType, PlanPlace, PlaceRecord, TaskItem, TaskPriority, TaskStatus } from "@/types/domain";
import { createTaskInDb, deleteTaskFromDb, fetchTasksFromDb, updateTaskInDb } from "@/features/tasks/api";
import { createCalendarEventInDb, deleteCalendarEventFromDb, fetchCalendarEventsFromDb, updateCalendarEventInDb } from "./api";
import type { CalendarEvent } from "./data";

type CalendarCategory = "schedule" | "event" | "todo";
type ExternalCalendarCategory = "expense" | "workout" | "weight" | "daily_log";
export type ExternalCalendarItem = {
  date: string;
  id: string;
  meta?: string;
  title: string;
  type: ExternalCalendarCategory;
};
type DragPlacement = "before" | "after";

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
        Polyline: new (options: Record<string, unknown>) => NaverPolyline;
        Point: new (x: number, y: number) => unknown;
      };
    };
  }
}

const categoryDisplayOrder: CalendarCategory[] = ["schedule", "todo", "event"];
const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const initialMonth = new Date();
const yearOptions = Array.from({ length: 151 }, (_, index) => new Date().getFullYear() - 75 + index);
const naverMapClientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID;

const categoryLabels: Record<CalendarCategory, string> = {
  schedule: "일정",
  event: "이벤트",
  todo: "할 일",
};

const eventTone: Record<CalendarCategory, "violet" | "green" | "pink"> = {
  schedule: "violet",
  event: "pink",
  todo: "green",
};

const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "할 일",
  inProgress: "진행 중",
  done: "완료",
};

const taskPriorityLabels: Record<TaskPriority, string> = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};

const taskPriorityTone: Record<TaskPriority, "pink" | "amber" | "muted"> = {
  high: "pink",
  normal: "amber",
  low: "muted",
};

type CalendarViewProps = {
  allowedTypes?: EventType[];
  externalItems?: ExternalCalendarItem[];
  showEventAddButton?: boolean;
  title?: string;
};

export function CalendarView({
  allowedTypes,
  externalItems = [],
  showEventAddButton = false,
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
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeDateCategory, setActiveDateCategory] = useState<CalendarCategory>("schedule");
  const [sheetDefaultType, setSheetDefaultType] = useState<CalendarCategory>("schedule");
  const [isLoading, setIsLoading] = useState(true);
  const [draggingItem, setDraggingItem] = useState<{ id: string; type: CalendarCategory } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; placement: DragPlacement } | null>(null);

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
  const detailSections = useMemo(
    () =>
      [
        { type: "schedule" as const, events: selectedSchedules },
        { type: "todo" as const, tasks: selectedTasks },
        { type: "event" as const, events: selectedEvents },
      ].filter((section) => categories.includes(section.type)),
    [categories, selectedEvents, selectedSchedules, selectedTasks],
  );
  const selectedDetailSection = detailSections.find((section) => section.type === activeDateCategory) ?? detailSections[0];

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
    setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() + direction, 1));
    setSelectedDate(null);
  };

  const handleDateClick = (date: string) => {
    setSelectedDate((current) => (current === date ? null : date));
    setActiveDateCategory(categories.includes("schedule") ? "schedule" : categories[0]);
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
    const savedEvent = exists ? await updateCalendarEventInDb(event) : await createCalendarEventInDb(event);
    const nextEvent = savedEvent ?? event;

    setEvents((current) => (exists ? current.map((item) => (item.id === event.id ? nextEvent : item)) : [nextEvent, ...current]));
    setIsEventSheetOpen(false);
    setEditingEvent(null);
  };

  const deleteEvent = async (id: string) => {
    await deleteCalendarEventFromDb(id);
    setEvents((current) => current.filter((item) => item.id !== id));
  };

  const saveTask = async (task: TaskItem) => {
    const exists = tasks.some((item) => item.id === task.id);
    const savedTask = exists ? await updateTaskInDb(task) : await createTaskInDb(task);
    const nextTask = savedTask ?? task;

    setTasks((current) => (exists ? current.map((item) => (item.id === task.id ? nextTask : item)) : [nextTask, ...current]));
    setIsTaskSheetOpen(false);
    setEditingTask(null);
  };

  const deleteTask = async (id: string) => {
    await deleteTaskFromDb(id);
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
      <header className="calendar-header page-header">
        <div>
          <h1>{title}</h1>
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

              <SelectedDatePlacesMap places={selectedPlanPlaces} />

              <div className="date-event-list">
                <div className="date-category-tabs" aria-label="날짜별 항목">
                  {detailSections.map((section) => {
                    const isActive = section.type === selectedDetailSection?.type;

                    return (
                      <button
                        className={`date-category-tab ${isActive ? "date-category-tab--active" : ""}`}
                        key={section.type}
                        onClick={() => setActiveDateCategory(section.type)}
                        type="button"
                      >
                        <span className={`calendar-dot calendar-dot--${section.type}`} />
                        {categoryLabels[section.type]}
                        <strong>{countsByCategory[section.type]}</strong>
                      </button>
                    );
                  })}
                </div>

                {selectedDetailSection ? (
                  <DateDetailSection
                    key={selectedDetailSection.type}
                    countsByCategory={countsByCategory}
                    draggingItem={draggingItem}
                    dropTarget={dropTarget}
                    isLoading={isLoading}
                    onAdd={() => openCreateEventSheet(selectedDetailSection.type)}
                    onClearDrag={clearDragState}
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
                    section={selectedDetailSection}
                    showHeader={false}
                  />
                ) : null}

                {selectedExternalItems.length > 0 ? (
                  <div className="date-life-section">
                    <div className="date-life-section__head">
                      <span>생활 기록</span>
                      <strong>{selectedExternalItems.length}</strong>
                    </div>
                    {selectedExternalItems.map((item) => (
                      <article className="date-life-item" key={`${item.type}-${item.id}`}>
                        <span className={`calendar-dot calendar-dot--${item.type}`} />
                        <div>
                          <strong>{item.title}</strong>
                          {item.meta ? <p>{item.meta}</p> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
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

function DateDetailSection({
  countsByCategory,
  draggingItem,
  dropTarget,
  isLoading,
  onAdd,
  onClearDrag,
  onDeleteEvent,
  onDeleteTask,
  onDragOverItem,
  onEditEvent,
  onEditTask,
  onReorderEvent,
  onReorderTask,
  onResolveDropPlacement,
  onSetDragging,
  onToggleDone,
  section,
  showHeader = true,
}: {
  countsByCategory: Record<CalendarCategory, number>;
  draggingItem: { id: string; type: CalendarCategory } | null;
  dropTarget: { id: string; placement: DragPlacement } | null;
  isLoading: boolean;
  onAdd: () => void;
  onClearDrag: () => void;
  onDeleteEvent: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onDragOverItem: (event: DragEvent<HTMLElement>, targetId: string, targetType: CalendarCategory) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onEditTask: (task: TaskItem) => void;
  onReorderEvent: (targetId: string, placement?: DragPlacement) => void;
  onReorderTask: (targetId: string, placement?: DragPlacement) => void;
  onResolveDropPlacement: (event: DragEvent<HTMLElement>) => DragPlacement;
  onSetDragging: (item: { id: string; type: CalendarCategory }) => void;
  onToggleDone: (task: TaskItem) => void;
  section:
    | { type: "schedule" | "event"; events: CalendarEvent[]; tasks?: never }
    | { type: "todo"; tasks: TaskItem[]; events?: never };
  showHeader?: boolean;
}) {
  const itemCount = countsByCategory[section.type];
  const isTodoSection = section.type === "todo";
  const items = isTodoSection ? section.tasks : section.events;

  return (
    <section className="date-detail-section">
      {showHeader ? (
        <div className="date-detail-section__header">
          <div>
            <span className={`calendar-dot calendar-dot--${section.type}`} />
            <strong>{categoryLabels[section.type]}</strong>
            <em>{itemCount}</em>
          </div>
        </div>
      ) : null}

      <div className="date-detail-section__items">
        {items.length > 0 ? (
          isTodoSection ? (
            section.tasks.map((task) => (
              <TaskDateItem
                dropPlacement={dropTarget?.id === task.id && draggingItem?.id !== task.id ? dropTarget.placement : null}
                isDragging={draggingItem?.id === task.id}
                key={task.id}
                onDelete={onDeleteTask}
                onDragEnd={onClearDrag}
                onDragOver={(dragEvent) => onDragOverItem(dragEvent, task.id, "todo")}
                onDragStart={() => onSetDragging({ id: task.id, type: "todo" })}
                onDrop={(dragEvent) => onReorderTask(task.id, onResolveDropPlacement(dragEvent))}
                onEdit={onEditTask}
                onToggleDone={onToggleDone}
                task={task}
              />
            ))
          ) : (
            section.events.map((event) => (
              <EventDateItem
                dropPlacement={dropTarget?.id === event.id && draggingItem?.id !== event.id ? dropTarget.placement : null}
                event={event}
                isDragging={draggingItem?.id === event.id}
                key={event.id}
                onDelete={onDeleteEvent}
                onDragEnd={onClearDrag}
                onDragOver={(dragEvent) => onDragOverItem(dragEvent, event.id, event.type as CalendarCategory)}
                onDragStart={() => onSetDragging({ id: event.id, type: event.type as CalendarCategory })}
                onDrop={(dragEvent) => onReorderEvent(event.id, onResolveDropPlacement(dragEvent))}
                onEdit={onEditEvent}
              />
            ))
          )
        ) : (
          <EmptyDateState isLoading={isLoading} label={categoryLabels[section.type]} onAdd={onAdd} />
        )}
      </div>
    </section>
  );
}

function EventDateItem({
  dropPlacement,
  event,
  isDragging,
  onDelete,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onEdit,
}: {
  dropPlacement: DragPlacement | null;
  event: CalendarEvent;
  isDragging: boolean;
  onDelete: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragStart: () => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onEdit: (event: CalendarEvent) => void;
}) {
  return (
    <article
      className={`date-event date-event--${event.type} ${isDragging ? "date-event--dragging" : ""} ${
        dropPlacement ? `date-event--drop-${dropPlacement}` : ""
      }`}
      draggable
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={(dragEvent) => {
        dragEvent.preventDefault();
        onDrop(dragEvent);
      }}
    >
      <div className="date-event__content">
        <div className="date-event__topline">
          <Badge tone={eventTone[event.type as CalendarCategory]}>{categoryLabels[event.type as CalendarCategory]}</Badge>
          <span>{formatPlanDateTime(event.date, event.endDate, event.time, event.endTime, event.isAllDay)}</span>
        </div>
        <h3>{event.title}</h3>
        {event.place ? <PlaceLine place={event.place} /> : null}
        {event.companions ? <PeopleLine companions={event.companions} /> : null}
        {event.expenseAmount !== undefined ? <ExpenseLine amount={event.expenseAmount} /> : null}
        {event.meta ? <p>{event.meta}</p> : null}
      </div>
      <div className="date-event__actions">
        <button aria-label="수정" onClick={() => onEdit(event)} type="button">
          <Pencil aria-hidden size={15} />
        </button>
        <button aria-label="삭제" onClick={() => onDelete(event.id)} type="button">
          <Trash2 aria-hidden size={15} />
        </button>
      </div>
    </article>
  );
}

function TaskDateItem({
  dropPlacement,
  isDragging,
  onDelete,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onEdit,
  onToggleDone,
  task,
}: {
  dropPlacement: DragPlacement | null;
  isDragging: boolean;
  onDelete: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragStart: () => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onEdit: (task: TaskItem) => void;
  onToggleDone: (task: TaskItem) => void;
  task: TaskItem;
}) {
  const isDone = task.status === "done";

  return (
    <article
      className={`date-event date-event--todo date-event--task ${isDone ? "date-event--task-done" : ""} ${isDragging ? "date-event--dragging" : ""} ${
        dropPlacement ? `date-event--drop-${dropPlacement}` : ""
      }`}
      draggable
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDrop={(dragEvent) => {
        dragEvent.preventDefault();
        onDrop(dragEvent);
      }}
    >
      <button className="date-event__check" aria-label={isDone ? "완료 취소" : "완료"} onClick={() => onToggleDone(task)} type="button">
        {isDone ? <Check aria-hidden size={15} /> : null}
      </button>
      <div className="date-event__task-body">
        <div className="date-event__topline">
          <Badge tone={taskPriorityTone[task.priority]}>{taskPriorityLabels[task.priority]}</Badge>
          <span>{taskStatusLabels[task.status]}</span>
          <span>{formatPlanDateTime(task.scheduledDate, task.dueDate, task.startTime, task.endTime, task.isAllDay)}</span>
        </div>
        <h3>{task.title}</h3>
        {task.place ? <PlaceLine place={task.place} /> : null}
        {task.companions ? <PeopleLine companions={task.companions} /> : null}
        {task.expenseAmount !== undefined ? <ExpenseLine amount={task.expenseAmount} /> : null}
        {task.memo ? <p>{task.memo}</p> : null}
      </div>
      <div className="date-event__actions">
        <button aria-label="수정" onClick={() => onEdit(task)} type="button">
          <Pencil aria-hidden size={15} />
        </button>
        <button aria-label="삭제" onClick={() => onDelete(task.id)} type="button">
          <Trash2 aria-hidden size={15} />
        </button>
      </div>
    </article>
  );
}

function EmptyDateState({ isLoading, label, onAdd }: { isLoading: boolean; label: string; onAdd?: () => void }) {
  return (
    <div className="date-empty-state">
      <ListFilter aria-hidden size={24} />
      <strong>{label} 항목이 없습니다.</strong>
      <p>{isLoading ? "불러오는 중입니다." : "상단 추가 버튼으로 새 항목을 등록할 수 있습니다."}</p>
      {!isLoading && onAdd ? (
        <button className="date-empty-state__add" onClick={onAdd} type="button">
          <Plus aria-hidden size={15} />
          {label} 추가
        </button>
      ) : null}
    </div>
  );
}

function PlaceSearchField({ onSelect, selectedPlace }: { onSelect: (place: PlanPlace | undefined) => void; selectedPlace?: PlanPlace }) {
  const [query, setQuery] = useState(selectedPlace?.name ?? "");
  const [results, setResults] = useState<PlaceRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState("");

  const searchPlaces = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setIsSearching(true);
    setMessage("");

    try {
      const response = await fetch(`/api/maps/search-place?query=${encodeURIComponent(trimmedQuery)}`);
      const payload = await readPlaceSearchResponse(response);
      if (!response.ok) {
        setMessage(payload.error ?? "장소 검색에 실패했습니다.");
        setResults([]);
        return;
      }

      const nextResults = payload.places ?? [];
      setResults(nextResults);
      if (nextResults.length === 0) setMessage("검색 결과가 없습니다.");
    } catch (error) {
      console.error("Failed to search plan place", error);
      setMessage("장소 검색 중 문제가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const choosePlace = (place: PlaceRecord) => {
    onSelect(convertPlaceRecordToPlanPlace(place));
    setQuery(place.name);
    setResults([]);
    setMessage("");
  };

  return (
    <div className="event-form-card schedule-place-card">
      <div className="schedule-place-card__header">
        <div>
          <span>장소</span>
          <strong>{selectedPlace ? selectedPlace.name : "장소 검색"}</strong>
        </div>
        {selectedPlace ? (
          <button onClick={() => onSelect(undefined)} type="button">
            선택 해제
          </button>
        ) : null}
      </div>
      <div className="schedule-place-search">
        <MapPin aria-hidden size={18} />
        <input
          placeholder="장소명이나 주소 검색"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void searchPlaces();
            }
          }}
        />
        <button disabled={isSearching || query.trim().length === 0} onClick={() => void searchPlaces()} type="button">
          <Search aria-hidden size={16} />
          {isSearching ? "검색 중" : "검색"}
        </button>
      </div>
      {selectedPlace ? <PlaceLine place={selectedPlace} /> : null}
      {message ? <p className="schedule-place-message">{message}</p> : null}
      {results.length > 0 ? (
        <div className="schedule-place-results">
          {results.map((place) => (
            <button key={`${place.providerPlaceId ?? place.id}-${place.name}`} onClick={() => choosePlace(place)} type="button">
              <strong>{place.name}</strong>
              <span>{place.address || place.category || "주소 정보 없음"}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

async function readPlaceSearchResponse(response: Response): Promise<{ places?: PlaceRecord[]; error?: string }> {
  const body = await response.text();
  if (!body.trim()) {
    return { error: "장소 검색 응답이 비어 있습니다.", places: [] };
  }

  try {
    return JSON.parse(body) as { places?: PlaceRecord[]; error?: string };
  } catch {
    return { error: "장소 검색 응답을 읽지 못했습니다.", places: [] };
  }
}

function SelectedDatePlacesMap({ places }: { places: PlanPlace[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLargeMapOpen, setIsLargeMapOpen] = useState(false);
  const [isRouteVisible, setIsRouteVisible] = useState(false);
  const [isPortalReady, setIsPortalReady] = useState(false);
  const placeKeys = useMemo(() => places.map((place) => getPlanPlaceKey(place)), [places]);
  const [visiblePlaceKeys, setVisiblePlaceKeys] = useState<string[]>(placeKeys);
  const visiblePlaceKeySet = useMemo(() => new Set(visiblePlaceKeys), [visiblePlaceKeys]);
  const visiblePlaces = useMemo(
    () => places.filter((place) => visiblePlaceKeySet.has(getPlanPlaceKey(place))),
    [places, visiblePlaceKeySet],
  );

  useEffect(() => {
    setIsPortalReady(true);
  }, []);

  useEffect(() => {
    setVisiblePlaceKeys(placeKeys);
  }, [placeKeys]);

  const togglePlaceVisibility = (place: PlanPlace) => {
    const placeKey = getPlanPlaceKey(place);
    setVisiblePlaceKeys((current) =>
      current.includes(placeKey) ? current.filter((key) => key !== placeKey) : [...current, placeKey],
    );
  };

  if (places.length === 0) {
    return (
      <div className="schedule-date-map schedule-date-map--empty">
        <button className="schedule-date-map__toggle" onClick={() => setIsOpen((current) => !current)} type="button">
          <span>
            <MapPin aria-hidden size={18} />
            이날 간 장소
          </span>
          <strong>0곳</strong>
        </button>
        {isOpen ? <p>이 날짜에 연결된 장소가 없습니다.</p> : null}
      </div>
    );
  }

  return (
    <>
      <div className={`schedule-date-map ${isOpen ? "schedule-date-map--open" : ""}`}>
        <div className="schedule-date-map__header">
          <button className="schedule-date-map__toggle" onClick={() => setIsOpen((current) => !current)} type="button">
            <span>
              <MapPin aria-hidden size={18} />
              이날 간 장소
            </span>
            <strong>{places.length}곳</strong>
          </button>
          <div className="schedule-date-map__actions" aria-label="지도 동작">
            <button aria-label="크게 보기" title="크게 보기" onClick={() => setIsLargeMapOpen(true)} type="button">
              <Maximize2 aria-hidden size={16} />
            </button>
            <button
              aria-label="경로 그리기"
              className={isRouteVisible ? "schedule-date-map__route-button schedule-date-map__route-button--active" : "schedule-date-map__route-button"}
              disabled={visiblePlaces.length < 2}
              onClick={() => {
                setIsRouteVisible((current) => !current);
                setIsLargeMapOpen(true);
              }}
              title="경로 그리기"
              type="button"
            >
              <Route aria-hidden size={16} />
            </button>
          </div>
        </div>
        {isOpen ? (
          <div className="schedule-date-map__body">
            <DatePlacesMapCanvas className="schedule-date-map__canvas" places={visiblePlaces} routeVisible={false} />
            <div className="schedule-date-map__places">
              {places.map((place, index) => {
                const isVisible = visiblePlaceKeySet.has(getPlanPlaceKey(place));

                return (
                  <button
                    aria-pressed={isVisible}
                    className={isVisible ? "schedule-date-map__place schedule-date-map__place--active" : "schedule-date-map__place"}
                    key={getPlanPlaceKey(place)}
                    onClick={() => togglePlaceVisibility(place)}
                    type="button"
                  >
                    <b>{index + 1}</b>
                    {place.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
      {isLargeMapOpen && isPortalReady ? createPortal(
        <div className="schedule-map-modal-backdrop" role="presentation" onMouseDown={() => setIsLargeMapOpen(false)}>
          <section aria-modal="true" className="schedule-map-modal" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
            <header className="schedule-map-modal__header">
              <div>
                <span>이날 간 장소</span>
                <h2>{visiblePlaces.length}/{places.length}곳 지도</h2>
              </div>
              <div className="schedule-map-modal__actions">
                <button
                  aria-label="경로 그리기"
                  className={isRouteVisible ? "schedule-date-map__route-button schedule-date-map__route-button--active" : "schedule-date-map__route-button"}
                  disabled={visiblePlaces.length < 2}
                  onClick={() => setIsRouteVisible((current) => !current)}
                  title="경로 그리기"
                  type="button"
                >
                  <Route aria-hidden size={16} />
                </button>
                <button onClick={() => setIsLargeMapOpen(false)} type="button">닫기</button>
              </div>
            </header>
            <div className="schedule-map-modal__content">
              <DatePlacesMapCanvas className="schedule-map-modal__canvas" places={visiblePlaces} routeVisible={isRouteVisible} />
              <ol className="schedule-map-modal__list">
                {places.map((place, index) => {
                  const isVisible = visiblePlaceKeySet.has(getPlanPlaceKey(place));

                  return (
                    <li className={isVisible ? "schedule-map-modal__place schedule-map-modal__place--active" : "schedule-map-modal__place"} key={getPlanPlaceKey(place)}>
                      <button aria-pressed={isVisible} onClick={() => togglePlaceVisibility(place)} type="button">
                        <b>{index + 1}</b>
                        <div>
                          <strong>{place.name}</strong>
                          {place.address ? <span>{place.address}</span> : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

function getPlanPlaceKey(place: PlanPlace) {
  return `${place.providerPlaceId ?? place.name}-${place.latitude}-${place.longitude}`;
}

function DatePlacesMapCanvas({ className, places, routeVisible }: { className: string; places: PlanPlace[]; routeVisible: boolean }) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const markersRef = useRef<NaverMarker[]>([]);
  const routeRef = useRef<NaverPolyline | null>(null);
  const [mapStatus, setMapStatus] = useState<"idle" | "loading" | "ready" | "missing" | "error">("idle");

  useEffect(() => {
    if (!naverMapClientId) {
      setMapStatus("missing");
      return;
    }

    if (window.naver?.maps) {
      setMapStatus("ready");
      return;
    }

    setMapStatus("loading");
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-dailyos-naver-map]");
    if (existingScript) {
      existingScript.addEventListener("load", () => setMapStatus("ready"), { once: true });
      existingScript.addEventListener("error", () => setMapStatus("error"), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.dailyosNaverMap = "true";
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(naverMapClientId)}`;
    script.async = true;
    script.onload = () => setMapStatus("ready");
    script.onerror = () => setMapStatus("error");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (mapStatus !== "ready" || !mapElementRef.current || !window.naver?.maps) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    routeRef.current?.setMap(null);
    routeRef.current = null;

    if (places.length === 0) return;

    const firstPlace = places[0];
    if (!mapRef.current) {
      mapRef.current = new window.naver.maps.Map(mapElementRef.current, {
        center: new window.naver.maps.LatLng(firstPlace.latitude, firstPlace.longitude),
        zoom: places.length === 1 ? 15 : 12,
      });
    }

    markersRef.current = places.map(
      (place, index) =>
        new window.naver!.maps.Marker({
          icon: {
            anchor: new window.naver!.maps.Point(16, 42),
            content: getSchedulePlaceMarkerContent(place, index),
          },
          map: mapRef.current!,
          position: new window.naver!.maps.LatLng(place.latitude, place.longitude),
          title: place.name,
        }),
    );

    if (routeVisible && places.length > 1) {
      routeRef.current = new window.naver.maps.Polyline({
        map: mapRef.current,
        path: places.map((place) => new window.naver!.maps.LatLng(place.latitude, place.longitude)),
        strokeColor: "#c8b6ff",
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeOpacity: 0.95,
        strokeWeight: 5,
      });
    }

    if (places.length === 1) {
      mapRef.current.setCenter(new window.naver.maps.LatLng(firstPlace.latitude, firstPlace.longitude));
      mapRef.current.setZoom(15);
      return;
    }

    const bounds = new window.naver.maps.LatLngBounds();
    places.forEach((place) => bounds.extend(new window.naver!.maps.LatLng(place.latitude, place.longitude)));
    mapRef.current.fitBounds(bounds);
  }, [mapStatus, places, routeVisible]);

  return (
    <div className={className} ref={mapElementRef}>
      {mapStatus === "loading" ? <span>지도를 불러오는 중입니다.</span> : null}
      {mapStatus === "missing" ? <span>네이버 지도 키가 필요합니다.</span> : null}
      {mapStatus === "error" ? <span>지도를 불러오지 못했습니다.</span> : null}
      {mapStatus === "ready" && places.length === 0 ? <span>표시할 장소를 선택해 주세요.</span> : null}
    </div>
  );
}

function PlaceLine({ place }: { place: PlanPlace }) {
  return (
    <p className="date-event__place">
      <MapPin aria-hidden size={14} />
      <span>{place.name}</span>
      {place.address ? <em>{place.address}</em> : null}
    </p>
  );
}

function PeopleLine({ companions }: { companions: string }) {
  return (
    <p className="date-event__place">
      <UsersRound aria-hidden size={14} />
      <span>{companions}</span>
    </p>
  );
}

function ExpenseLine({ amount }: { amount: number }) {
  return (
    <p className="date-event__place">
      <WalletCards aria-hidden size={14} />
      <span>{formatCurrency(amount)}</span>
    </p>
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
  const [isAllDay, setIsAllDay] = useState(event?.isAllDay ?? !event?.time);
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
      endDate: endDate && endDate !== date ? endDate : undefined,
      type,
      title: trimmedTitle,
      time: isAllDay ? undefined : time || undefined,
      endTime: isAllDay ? undefined : endTime || undefined,
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

          <PlaceSearchField selectedPlace={place} onSelect={setPlace} />

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

          <div className="event-form-card schedule-form-card schedule-form-card--grid">
            <label className="event-form-row event-form-row--field schedule-field">
              <div className="event-form-row__label">
                <CalendarDays aria-hidden size={18} />
                <span>날짜</span>
              </div>
              <input type="date" value={date} onChange={(changeEvent) => setDate(changeEvent.target.value)} />
            </label>

            <label className="event-form-row event-form-row--field schedule-field">
              <div className="event-form-row__label">
                <CalendarDays aria-hidden size={18} />
                <span>종료일</span>
              </div>
              <input type="date" value={endDate} onChange={(changeEvent) => setEndDate(changeEvent.target.value)} />
            </label>

            <label className="event-form-row event-form-row--select schedule-field">
              <div className="event-form-row__label">
                <Clock3 aria-hidden size={18} />
                <span>시간 형태</span>
              </div>
              <select value={isAllDay ? "all-day" : "time-range"} onChange={(changeEvent) => setIsAllDay(changeEvent.target.value === "all-day")}>
                <option value="all-day">하루종일</option>
                <option value="time-range">시간 지정</option>
              </select>
            </label>

            <label className="event-form-row event-form-row--field schedule-field">
              <div className="event-form-row__label">
                <Clock3 aria-hidden size={18} />
                <span>시간</span>
              </div>
              <input disabled={isAllDay} type="time" value={time} onChange={(changeEvent) => setTime(changeEvent.target.value)} />
            </label>

            <label className="event-form-row event-form-row--field schedule-field">
              <div className="event-form-row__label">
                <Clock3 aria-hidden size={18} />
                <span>종료 시간</span>
              </div>
              <input disabled={isAllDay} type="time" value={endTime} onChange={(changeEvent) => setEndTime(changeEvent.target.value)} />
            </label>

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
  const [isAllDay, setIsAllDay] = useState(task?.isAllDay ?? !task?.startTime);
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
      dueDate: dueDate && dueDate !== scheduledDate ? dueDate : undefined,
      startTime: isAllDay ? undefined : startTime || undefined,
      endTime: isAllDay ? undefined : endTime || undefined,
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

          <PlaceSearchField selectedPlace={place} onSelect={setPlace} />

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

          <div className="event-form-card schedule-form-card schedule-form-card--grid">
            <label className="event-form-row event-form-row--field schedule-field">
              <div className="event-form-row__label">
                <CalendarDays aria-hidden size={18} />
                <span>예정일</span>
              </div>
              <input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />
            </label>

            <label className="event-form-row event-form-row--field schedule-field">
              <div className="event-form-row__label">
                <Clock3 aria-hidden size={18} />
                <span>마감일</span>
              </div>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>

            <label className="event-form-row event-form-row--select schedule-field">
              <div className="event-form-row__label">
                <Clock3 aria-hidden size={18} />
                <span>시간 형태</span>
              </div>
              <select value={isAllDay ? "all-day" : "time-range"} onChange={(event) => setIsAllDay(event.target.value === "all-day")}>
                <option value="all-day">하루종일</option>
                <option value="time-range">시간 지정</option>
              </select>
            </label>

            <label className="event-form-row event-form-row--field schedule-field">
              <div className="event-form-row__label">
                <Clock3 aria-hidden size={18} />
                <span>시작 시간</span>
              </div>
              <input disabled={isAllDay} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </label>

            <label className="event-form-row event-form-row--field schedule-field">
              <div className="event-form-row__label">
                <Clock3 aria-hidden size={18} />
                <span>종료 시간</span>
              </div>
              <input disabled={isAllDay} type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </label>
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

function MonthPickerSheet({
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

function getMonthDays(year: number, monthIndex: number) {
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leadingEmptyDays = firstDay.getDay();

  return [
    ...Array.from({ length: leadingEmptyDays }, (_, index) => ({ key: `empty-${index}`, day: null, date: null })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { key: date, day, date };
    }),
  ];
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatSelectedDate(dateKey: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${dateKey}T00:00:00`));
}

function formatShortDate(dateKey: string) {
  return `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8, 10))}`;
}

function isDateInRange(date: string, startDate: string, endDate?: string) {
  const normalizedEndDate = endDate || startDate;
  return startDate <= date && date <= normalizedEndDate;
}

function formatPlanDateTime(startDate: string, endDate?: string, startTime?: string, endTime?: string, isAllDay = true) {
  const dateLabel = endDate && endDate !== startDate ? `${formatShortDate(startDate)}-${formatShortDate(endDate)}` : formatShortDate(startDate);
  if (isAllDay) return `${dateLabel} · 하루종일`;
  if (startTime && endTime) return `${dateLabel} · ${startTime}-${endTime}`;
  if (startTime) return `${dateLabel} · ${startTime}`;
  return dateLabel;
}

function parseOptionalAmount(value: string) {
  if (!value.trim()) return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : undefined;
}

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat("ko-KR").format(value)}원`;
}

function summarizeDay(events: CalendarEvent[], tasks: TaskItem[], categories: CalendarCategory[], externalItems: ExternalCalendarItem[]) {
  const planSummaries = categoryDisplayOrder
    .filter((type) => categories.includes(type))
    .map((type) => ({
      type,
      count: type === "todo" ? tasks.length : events.filter((event) => event.type === type).length,
    }))
    .filter((summary) => summary.count > 0);

  const externalSummaries = (["expense", "workout", "weight", "daily_log"] as const)
    .map((type) => ({
      type,
      count: externalItems.filter((item) => item.type === type).length,
    }))
    .filter((summary) => summary.count > 0);

  return [...planSummaries, ...externalSummaries];
}

function getCalendarSummaryLabel(type: CalendarCategory | ExternalCalendarCategory) {
  if (type === "expense") return "가계부";
  if (type === "workout") return "운동";
  if (type === "weight") return "몸무게";
  if (type === "daily_log") return "기록";
  return categoryLabels[type];
}

function convertPlaceRecordToPlanPlace(place: PlaceRecord): PlanPlace {
  return {
    name: place.name,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    providerPlaceId: place.providerPlaceId,
    phone: place.phone,
    category: place.category,
    url: place.url,
  };
}

function uniquePlanPlaces(places: PlanPlace[]) {
  const uniquePlaces = new Map<string, PlanPlace>();
  places.forEach((place) => {
    const key = `${place.providerPlaceId ?? ""}|${place.name}|${place.latitude}|${place.longitude}`;
    if (!uniquePlaces.has(key)) uniquePlaces.set(key, place);
  });
  return [...uniquePlaces.values()];
}

function getSchedulePlaceMarkerContent(place: PlanPlace, index: number) {
  const safeName = escapeHtml(place.name);
  return `
    <div class="schedule-place-marker">
      <span>${index + 1}</span>
      <strong>${safeName}</strong>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function reorderScopedItems<T extends { id: string }>(
  items: T[],
  belongsToScope: (item: T) => boolean,
  sourceId: string,
  targetId: string,
  placement: DragPlacement,
) {
  const scopedItems = items.filter(belongsToScope);
  const sourceIndex = scopedItems.findIndex((item) => item.id === sourceId);
  const targetIndex = scopedItems.findIndex((item) => item.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0) return items;

  const reordered = [...scopedItems];
  const [movedItem] = reordered.splice(sourceIndex, 1);
  let insertionIndex = targetIndex + (placement === "after" ? 1 : 0);

  if (sourceIndex < insertionIndex) {
    insertionIndex -= 1;
  }

  insertionIndex = Math.max(0, Math.min(insertionIndex, reordered.length));
  reordered.splice(insertionIndex, 0, movedItem);

  let nextScopedIndex = 0;
  return items.map((item) => (belongsToScope(item) ? reordered[nextScopedIndex++] : item));
}
