"use client";

import type { DragEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListChecks,
  ListFilter,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import type { EventType, TaskItem, TaskPriority, TaskStatus } from "@/types/domain";
import { createTaskInDb, deleteTaskFromDb, fetchTasksFromDb, updateTaskInDb } from "@/features/tasks/api";
import { createCalendarEventInDb, deleteCalendarEventFromDb, fetchCalendarEventsFromDb, updateCalendarEventInDb } from "./api";
import type { CalendarEvent } from "./data";

type CalendarCategory = "schedule" | "event" | "todo";
type DragPlacement = "before" | "after";

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
const initialMonth = new Date();
const yearOptions = Array.from({ length: 151 }, (_, index) => new Date().getFullYear() - 75 + index);

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
  description?: string;
  showEventAddButton?: boolean;
  title?: string;
};

export function CalendarView({
  allowedTypes,
  description = "일정, 이벤트, 할 일을 날짜 기준으로 함께 관리합니다.",
  showEventAddButton = false,
  title = "일정",
}: CalendarViewProps) {
  const categories = useMemo(() => getCategories(allowedTypes), [allowedTypes]);
  const defaultCategory = categories.includes("schedule") ? "schedule" : categories[0];
  const [activeCategory, setActiveCategory] = useState<CalendarCategory>(defaultCategory);
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
  const monthDays = getMonthDays(currentMonth.getFullYear(), currentMonth.getMonth());
  const selectedEvents = selectedDate
    ? visibleEvents.filter((event) => event.date === selectedDate && event.type === activeCategory)
    : [];
  const selectedTasks = selectedDate ? tasks.filter((task) => task.scheduledDate === selectedDate) : [];

  const countsByCategory = useMemo(() => {
    if (!selectedDate) return { schedule: 0, event: 0, todo: 0 };
    return {
      schedule: visibleEvents.filter((event) => event.date === selectedDate && event.type === "schedule").length,
      event: visibleEvents.filter((event) => event.date === selectedDate && event.type === "event").length,
      todo: selectedTasks.length,
    };
  }, [selectedDate, selectedTasks.length, visibleEvents]);

  const moveMonth = (direction: -1 | 1) => {
    setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() + direction, 1));
    setSelectedDate(null);
    setActiveCategory(defaultCategory);
  };

  const handleDateClick = (date: string) => {
    setSelectedDate((current) => (current === date ? null : date));
    setActiveCategory(defaultCategory);
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

  const reorderEvent = (targetId: string) => {
    if (!draggingItem || draggingItem.type === "todo" || !selectedDate || draggingItem.id === targetId || !dropTarget) return;
    const targetType = draggingItem.type;
    setEvents((current) =>
      reorderScopedItems(
        current,
        (event) => event.date === selectedDate && event.type === targetType,
        draggingItem.id,
        targetId,
        dropTarget.placement,
      ),
    );
    clearDragState();
  };

  const reorderTask = (targetId: string) => {
    if (!draggingItem || draggingItem.type !== "todo" || !selectedDate || draggingItem.id === targetId || !dropTarget) return;
    setTasks((current) => reorderScopedItems(current, (task) => task.scheduledDate === selectedDate, draggingItem.id, targetId, dropTarget.placement));
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
              <span className={`calendar-filter calendar-filter--${type}`} key={type}>
                {categoryLabels[type]}
              </span>
            ))}
          </div>

          <div className="calendar-weekdays">
            {weekdays.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {monthDays.map((cell) => {
              const dayEvents = cell.date ? visibleEvents.filter((event) => event.date === cell.date) : [];
              const dayTasks = cell.date ? tasks.filter((task) => task.scheduledDate === cell.date) : [];
              const eventSummaries = summarizeDay(dayEvents, dayTasks, categories);
              return (
                <button
                  className={`calendar-day ${cell.date === selectedDate ? "calendar-day--selected" : ""}`}
                  disabled={!cell.date}
                  key={cell.key}
                  onClick={() => (cell.date ? handleDateClick(cell.date) : undefined)}
                  type="button"
                >
                  {cell.day ? <span className="calendar-day__number">{cell.day}</span> : null}
                  <div className="calendar-day__events">
                    {eventSummaries.slice(0, 4).map((summary) => (
                      <span
                        aria-label={`${categoryLabels[summary.type]} ${summary.count}개`}
                        className="calendar-day__event-chip"
                        key={summary.type}
                        title={`${categoryLabels[summary.type]} ${summary.count}개`}
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

              <div className="date-category-tabs" aria-label="날짜별 항목">
                {categories.map((type) => (
                  <button
                    className={`date-category-tab ${activeCategory === type ? "date-category-tab--active" : ""}`}
                    key={type}
                    onClick={() => setActiveCategory(type)}
                    type="button"
                  >
                    <span className={`calendar-dot calendar-dot--${type}`} />
                    {categoryLabels[type]}
                    <strong>{countsByCategory[type]}</strong>
                  </button>
                ))}
              </div>

              <div className="date-event-list">
                {activeCategory === "todo" ? (
                  selectedTasks.length > 0 ? (
                    selectedTasks.map((task) => (
                      <TaskDateItem
                        dropPlacement={dropTarget?.id === task.id && draggingItem?.id !== task.id ? dropTarget.placement : null}
                        isDragging={draggingItem?.id === task.id}
                        key={task.id}
                        onDelete={deleteTask}
                        onDragEnd={clearDragState}
                        onDragOver={(dragEvent) => handleDragOverItem(dragEvent, task.id, "todo")}
                        onDragStart={() => setDraggingItem({ id: task.id, type: "todo" })}
                        onDrop={() => reorderTask(task.id)}
                        onEdit={(target) => {
                          setEditingTask(target);
                          setIsTaskSheetOpen(true);
                        }}
                        onToggleDone={toggleTaskDone}
                        task={task}
                      />
                    ))
                  ) : (
                    <EmptyDateState isLoading={isLoading} label="할 일" />
                  )
                ) : selectedEvents.length > 0 ? (
                  selectedEvents.map((event) => (
                    <article
                      className={`date-event date-event--${event.type} ${draggingItem?.id === event.id ? "date-event--dragging" : ""} ${
                        dropTarget?.id === event.id && draggingItem?.id !== event.id ? `date-event--drop-${dropTarget.placement}` : ""
                      }`}
                      draggable
                      key={event.id}
                      onDragEnd={clearDragState}
                      onDragOver={(dragEvent) => handleDragOverItem(dragEvent, event.id, event.type as CalendarCategory)}
                      onDragStart={() => setDraggingItem({ id: event.id, type: event.type as CalendarCategory })}
                      onDrop={() => reorderEvent(event.id)}
                    >
                      <div>
                        <Badge tone={eventTone[event.type as CalendarCategory]}>{categoryLabels[event.type as CalendarCategory]}</Badge>
                        <h3>{event.title}</h3>
                        <p>{event.time ? `${event.time} · ${event.meta}` : event.meta}</p>
                      </div>
                      <div className="date-event__actions">
                        <button
                          aria-label="수정"
                          onClick={() => {
                            setEditingEvent(event);
                            setSheetDefaultType(event.type as CalendarCategory);
                            setIsEventSheetOpen(true);
                          }}
                          type="button"
                        >
                          <Pencil aria-hidden size={15} />
                        </button>
                        <button aria-label="삭제" onClick={() => deleteEvent(event.id)} type="button">
                          <Trash2 aria-hidden size={15} />
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyDateState isLoading={isLoading} label={categoryLabels[activeCategory]} />
                )}
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
            setActiveCategory(defaultCategory);
            setIsMonthPickerOpen(false);
          }}
        />
      ) : null}
    </div>
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
  onDrop: () => void;
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
      onDrop={onDrop}
    >
      <button className="date-event__check" aria-label={isDone ? "완료 취소" : "완료"} onClick={() => onToggleDone(task)} type="button">
        {isDone ? <Check aria-hidden size={15} /> : null}
      </button>
      <div className="date-event__task-body">
        <Badge tone={taskPriorityTone[task.priority]}>{taskPriorityLabels[task.priority]}</Badge>
        <h3>{task.title}</h3>
        <p>
          {taskStatusLabels[task.status]}
          {task.dueDate ? ` · 마감 ${formatShortDate(task.dueDate)}` : ""}
        </p>
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

function EmptyDateState({ isLoading, label }: { isLoading: boolean; label: string }) {
  return (
    <div className="date-empty-state">
      <ListFilter aria-hidden size={24} />
      <strong>{label} 항목이 없습니다.</strong>
      <p>{isLoading ? "불러오는 중입니다." : "상단 추가 버튼으로 새 항목을 등록할 수 있습니다."}</p>
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
  const [time, setTime] = useState(event?.time ?? "");
  const [type, setType] = useState<CalendarCategory>(event?.type === "event" ? "event" : defaultType);
  const [meta, setMeta] = useState(event?.meta ?? "");

  const saveCurrentEvent = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onSave({
      id: event?.id ?? `calendar-${Date.now()}`,
      date,
      type,
      title: trimmedTitle,
      time: time || undefined,
      meta: meta.trim() || "메모 없음",
    });
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="event-sheet-title" aria-modal="true" className="event-sheet" role="dialog" onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header">
          <div>
            <h2 id="event-sheet-title">{event ? "항목 수정" : `${categoryLabels[type]} 추가`}</h2>
            <p>{event ? "등록된 내용을 수정합니다." : "날짜와 종류를 정해 계획에 추가합니다."}</p>
          </div>
          <button className="event-sheet__icon-button" aria-label="닫기" onClick={onClose} type="button">
            <X aria-hidden size={18} />
          </button>
        </header>

        <div className="event-sheet__body">
          <div className="event-form-card event-form-card--title">
            <label>
              <span>제목</span>
              <input autoFocus placeholder={`${categoryLabels[type]} 제목`} value={title} onChange={(changeEvent) => setTitle(changeEvent.target.value)} />
            </label>
            <label>
              <span>메모</span>
              <input placeholder="장소, 링크, 간단한 설명" value={meta} onChange={(changeEvent) => setMeta(changeEvent.target.value)} />
            </label>
          </div>

          <div className="event-form-card">
            <label className="event-form-row event-form-row--field">
              <div className="event-form-row__label">
                <CalendarDays aria-hidden size={18} />
                <span>날짜</span>
              </div>
              <input type="date" value={date} onChange={(changeEvent) => setDate(changeEvent.target.value)} />
            </label>

            <label className="event-form-row event-form-row--field">
              <div className="event-form-row__label">
                <Clock3 aria-hidden size={18} />
                <span>시간</span>
              </div>
              <input type="time" value={time} onChange={(changeEvent) => setTime(changeEvent.target.value)} />
            </label>

            <label className="event-form-row event-form-row--select">
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
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");

  const saveTask = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    onSave({
      id: task?.id ?? `task-${Date.now()}`,
      title: trimmedTitle,
      status,
      priority,
      scheduledDate,
      dueDate: dueDate || undefined,
      completedAt: status === "done" ? task?.completedAt ?? new Date().toISOString() : undefined,
      deferredCount: task?.deferredCount ?? 0,
      memo: memo.trim() || undefined,
    });
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="task-sheet-title" aria-modal="true" className="event-sheet task-sheet" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header">
          <div>
            <h2 id="task-sheet-title">{task ? "할 일 수정" : "할 일 추가"}</h2>
            <p>{task ? "상태와 날짜를 조정합니다." : "예정일 기준으로 할 일을 추가합니다."}</p>
          </div>
          <button className="event-sheet__icon-button" aria-label="닫기" onClick={onClose} type="button">
            <X aria-hidden size={18} />
          </button>
        </header>

        <div className="event-sheet__body">
          <div className="event-form-card event-form-card--title">
            <label>
              <span>제목</span>
              <input autoFocus placeholder="할 일 제목" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              <span>메모</span>
              <input placeholder="필요한 내용을 적어주세요." value={memo} onChange={(event) => setMemo(event.target.value)} />
            </label>
          </div>

          <div className="event-form-card">
            <label className="event-form-row event-form-row--select">
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

            <label className="event-form-row event-form-row--select">
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

          <div className="event-form-card">
            <label className="event-form-row event-form-row--field">
              <div className="event-form-row__label">
                <CalendarDays aria-hidden size={18} />
                <span>예정일</span>
              </div>
              <input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />
            </label>

            <label className="event-form-row event-form-row--field">
              <div className="event-form-row__label">
                <Clock3 aria-hidden size={18} />
                <span>마감일</span>
              </div>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
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
  const source = allowedTypes ?? ["schedule", "event", "todo"];
  return source.filter((type): type is CalendarCategory => type === "schedule" || type === "event" || type === "todo");
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

function summarizeDay(events: CalendarEvent[], tasks: TaskItem[], categories: CalendarCategory[]) {
  return categories
    .map((type) => ({
      type,
      count: type === "todo" ? tasks.length : events.filter((event) => event.type === type).length,
    }))
    .filter((summary) => summary.count > 0);
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
