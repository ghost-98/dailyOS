"use client";

import type { DragEvent } from "react";
import { useMemo, useState } from "react";
import { Activity, Check, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyDateState, ExpenseLine, PeopleLine, PlaceLine } from "@/features/calendar/components";
import { categoryLabels, eventTone, formatPlanDateTime, taskPriorityLabels, taskPriorityTone, taskStatusLabels } from "@/features/calendar/presentation";
import type { CalendarCategory, DayTimelineItem, DragPlacement, ExternalCalendarItem } from "@/features/calendar/types";
import type { CalendarEvent } from "@/features/calendar/data";
import type { TaskItem } from "@/types/domain";

type ActivityConversionState = { id: string; type: "event" | "task" } | null;
type TimelineFilter = "event" | "todo";

export function DayTimelineSection({
  countsByCategory,
  deletingPlan,
  draggingItem,
  dropTarget,
  isConvertingToActivity,
  isLoading,
  items,
  onClearDrag,
  onCreateActivityFromEvent,
  onCreateActivityFromTask,
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
  readOnly = false,
}: {
  countsByCategory?: { event: number; todo: number };
  deletingPlan?: { id: string; type: "event" | "task" } | null;
  draggingItem: { id: string; type: "event" | "todo" } | null;
  dropTarget: { id: string; placement: DragPlacement } | null;
  externalCount?: number;
  isConvertingToActivity?: ActivityConversionState;
  isLoading: boolean;
  items: DayTimelineItem[];
  onClearDrag: () => void;
  onCreateActivityFromEvent: (event: CalendarEvent) => void;
  onCreateActivityFromTask: (task: TaskItem) => void;
  onDeleteEvent: (id: string) => void;
  onDeleteTask: (id: string) => void;
  onDragOverItem: (event: DragEvent<HTMLElement>, targetId: string, targetType: "event" | "todo") => void;
  onEditEvent: (event: CalendarEvent) => void;
  onEditTask: (task: TaskItem) => void;
  onReorderEvent: (targetId: string, placement?: DragPlacement) => void;
  onReorderTask: (targetId: string, placement?: DragPlacement) => void;
  onResolveDropPlacement: (event: DragEvent<HTMLElement>) => DragPlacement;
  onSetDragging: (item: { id: string; type: "event" | "todo" }) => void;
  onToggleDone: (task: TaskItem) => void;
  readOnly?: boolean;
}) {
  const [activeFilters, setActiveFilters] = useState<TimelineFilter[]>([]);

  const filteredItems = useMemo(
    () =>
      activeFilters.length === 0
        ? items
        : items.filter((item) => {
            if ("task" in item) return activeFilters.includes("todo");
            if ("event" in item) return activeFilters.includes("event");
            return true;
          }),
    [activeFilters, items],
  );

  const toggleFilter = (filter: TimelineFilter) => {
    setActiveFilters((current) => (current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]));
  };

  return (
    <section className="day-timeline" aria-label="하루 타임라인">
      <div className="day-timeline__summary">
        <div className="day-timeline__summary-copy">
          <span>하루 타임라인</span>
          <strong>{filteredItems.length}개 기록</strong>
        </div>
        {countsByCategory ? (
          <div className="day-timeline__filters" aria-label="타임라인 필터">
            {([
              ["todo", "할 일", countsByCategory.todo],
              ["event", "이벤트", countsByCategory.event],
            ] as const).map(([type, label, count]) => (
              <button
                className={`calendar-filter calendar-filter--${type} ${activeFilters.includes(type) ? "calendar-filter--active" : ""} ${activeFilters.length > 0 && !activeFilters.includes(type) ? "calendar-filter--muted" : ""}`}
                key={type}
                onClick={() => toggleFilter(type)}
                type="button"
              >
                <span className={`calendar-dot calendar-dot--${type}`} />
                {label}
                <b>{count}</b>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {filteredItems.length > 0 ? (
        <div className="day-timeline__items">
          {filteredItems.map((item) => (
            <div className={`day-timeline__row day-timeline__row--${item.type}`} key={item.id}>
              <div className="day-timeline__time">
                <span>{item.timeLabel}</span>
              </div>
              <div className="day-timeline__marker">
                <span className={`calendar-dot calendar-dot--${item.type}`} />
              </div>
              <div className="day-timeline__body">
                {item.type === "todo" ? (
                  <TaskDateItem
                    dropPlacement={dropTarget?.id === item.task.id && draggingItem?.id !== item.task.id ? dropTarget.placement : null}
                    isConverting={isConvertingToActivity?.type === "task" && isConvertingToActivity.id === item.task.id}
                    isDeleting={deletingPlan?.type === "task" && deletingPlan.id === item.task.id}
                    isDragging={draggingItem?.id === item.task.id}
                    onCreateActivity={onCreateActivityFromTask}
                    onDelete={onDeleteTask}
                    onDragEnd={onClearDrag}
                    onDragOver={(dragEvent) => onDragOverItem(dragEvent, item.task.id, "todo")}
                    onDragStart={() => onSetDragging({ id: item.task.id, type: "todo" })}
                    onDrop={(dragEvent) => onReorderTask(item.task.id, onResolveDropPlacement(dragEvent))}
                    onEdit={onEditTask}
                    onToggleDone={onToggleDone}
                    readOnly={readOnly}
                    task={item.task}
                  />
                ) : "event" in item ? (
                  <EventDateItem
                    dropPlacement={dropTarget?.id === item.event.id && draggingItem?.id !== item.event.id ? dropTarget.placement : null}
                    event={item.event}
                    isConverting={isConvertingToActivity?.type === "event" && isConvertingToActivity.id === item.event.id}
                    isDeleting={deletingPlan?.type === "event" && deletingPlan.id === item.event.id}
                    isDragging={draggingItem?.id === item.event.id}
                    onCreateActivity={onCreateActivityFromEvent}
                    onDelete={onDeleteEvent}
                    onDragEnd={onClearDrag}
                    onDragOver={(dragEvent) => onDragOverItem(dragEvent, item.event.id, item.event.type as CalendarCategory)}
                    onDragStart={() => onSetDragging({ id: item.event.id, type: item.event.type as CalendarCategory })}
                    onDrop={(dragEvent) => onReorderEvent(item.event.id, onResolveDropPlacement(dragEvent))}
                    onEdit={onEditEvent}
                    readOnly={readOnly}
                  />
                ) : (
                  <ExternalTimelineItem item={item.external} />
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyDateState isLoading={isLoading} label="타임라인" />
      )}
    </section>
  );
}

function ExternalTimelineItem({ item }: { item: ExternalCalendarItem }) {
  return (
    <article className="date-life-item day-timeline-external">
      <span className={`calendar-dot calendar-dot--${item.type}`} />
      <div>
        <strong>{item.title}</strong>
        {item.meta ? <p>{item.meta}</p> : null}
      </div>
    </article>
  );
}

function EventDateItem({
  dropPlacement,
  event,
  isConverting,
  isDeleting,
  isDragging,
  onCreateActivity,
  onDelete,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onEdit,
  readOnly,
}: {
  dropPlacement: DragPlacement | null;
  event: CalendarEvent;
  isConverting: boolean;
  isDeleting: boolean;
  isDragging: boolean;
  onCreateActivity: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragStart: () => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onEdit: (event: CalendarEvent) => void;
  readOnly: boolean;
}) {
  return (
    <article
      className={`date-event date-event--${event.type} ${readOnly ? "date-event--readonly" : ""} ${isDragging ? "date-event--dragging" : ""} ${
        dropPlacement ? `date-event--drop-${dropPlacement}` : ""
      }`}
      draggable={!readOnly}
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
      {!readOnly ? (
        <div className="date-event__actions">
          <button aria-label="활동으로 기록" disabled={isConverting || isDeleting} onClick={() => onCreateActivity(event)} title="이 항목을 실제 활동으로 기록" type="button">
            <Activity aria-hidden size={15} />
          </button>
          <button aria-label="수정" disabled={isDeleting} onClick={() => onEdit(event)} type="button">
            <Pencil aria-hidden size={15} />
          </button>
          <button aria-label="삭제" disabled={isDeleting} onClick={() => onDelete(event.id)} type="button">
            <Trash2 aria-hidden size={15} />
          </button>
        </div>
      ) : null}
    </article>
  );
}

function TaskDateItem({
  dropPlacement,
  isConverting,
  isDeleting,
  isDragging,
  onCreateActivity,
  onDelete,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onEdit,
  onToggleDone,
  readOnly,
  task,
}: {
  dropPlacement: DragPlacement | null;
  isConverting: boolean;
  isDeleting: boolean;
  isDragging: boolean;
  onCreateActivity: (task: TaskItem) => void;
  onDelete: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragStart: () => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
  onEdit: (task: TaskItem) => void;
  onToggleDone: (task: TaskItem) => void;
  readOnly: boolean;
  task: TaskItem;
}) {
  const isDone = task.status === "done";

  return (
    <article
      className={`date-event date-event--todo date-event--task ${readOnly ? "date-event--readonly" : ""} ${isDone ? "date-event--task-done" : ""} ${isDragging ? "date-event--dragging" : ""} ${
        dropPlacement ? `date-event--drop-${dropPlacement}` : ""
      }`}
      draggable={!readOnly}
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
      {!readOnly ? (
        <div className="date-event__actions">
          <button aria-label="활동으로 기록" disabled={isConverting || isDeleting} onClick={() => onCreateActivity(task)} title="이 할 일을 실제 활동으로 기록" type="button">
            <Activity aria-hidden size={15} />
          </button>
          <button aria-label="수정" disabled={isDeleting} onClick={() => onEdit(task)} type="button">
            <Pencil aria-hidden size={15} />
          </button>
          <button aria-label="삭제" disabled={isDeleting} onClick={() => onDelete(task.id)} type="button">
            <Trash2 aria-hidden size={15} />
          </button>
        </div>
      ) : null}
    </article>
  );
}
