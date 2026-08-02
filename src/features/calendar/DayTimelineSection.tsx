"use client";

import type { DragEvent } from "react";
import { useState } from "react";
import { Activity, Check, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyDateState, ExpenseLine, PeopleLine, PlaceLine } from "@/features/calendar/components";
import { categoryLabels, eventTone, formatPlanDateTime, isExternalTimelineType, taskPriorityLabels, taskPriorityTone, taskStatusLabels } from "@/features/calendar/presentation";
import type { CalendarCategory, DayTimelineFilter, DayTimelineItem, DragPlacement, ExternalCalendarItem } from "@/features/calendar/types";
import type { CalendarEvent } from "@/features/calendar/data";
import type { TaskItem } from "@/types/domain";

type ActivityConversionState = { id: string; type: "event" | "task" } | null;

export function DayTimelineSection({
  countsByCategory,
  deletingPlan,
  draggingItem,
  dropTarget,
  externalCount,
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
  visibleCategories,
}: {
  countsByCategory: Record<CalendarCategory, number>;
  deletingPlan?: { id: string; type: "event" | "task" } | null;
  draggingItem: { id: string; type: CalendarCategory } | null;
  dropTarget: { id: string; placement: DragPlacement } | null;
  externalCount: number;
  isConvertingToActivity?: ActivityConversionState;
  isLoading: boolean;
  items: DayTimelineItem[];
  onClearDrag: () => void;
  onCreateActivityFromEvent: (event: CalendarEvent) => void;
  onCreateActivityFromTask: (task: TaskItem) => void;
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
  readOnly?: boolean;
  visibleCategories: CalendarCategory[];
}) {
  const [activeFilters, setActiveFilters] = useState<DayTimelineFilter[]>([]);
  const totalCount = visibleCategories.reduce((sum, type) => sum + countsByCategory[type], 0) + externalCount;
  const filterChips = [
    ...visibleCategories.map((type) => ({ count: countsByCategory[type], label: categoryLabels[type], type })),
    ...(externalCount > 0 ? [{ count: externalCount, label: "생활 기록", type: "life" as const }] : []),
  ];
  const filteredItems =
    activeFilters.length === 0 ? items : items.filter((item) => (isExternalTimelineType(item.type) ? activeFilters.includes("life") : activeFilters.includes(item.type)));

  const toggleFilter = (type: DayTimelineFilter) => {
    setActiveFilters((current) => (current.includes(type) ? current.filter((filter) => filter !== type) : [...current, type]));
  };

  return (
    <section className="day-timeline" aria-label="하루 타임라인">
      <div className="day-timeline__summary">
        <div>
          <span>하루 타임라인</span>
          <strong>{totalCount}개 기록</strong>
        </div>
        <div className="day-timeline__chips" aria-label="기록 필터">
          {filterChips.map((filter) => {
            const isActive = activeFilters.includes(filter.type);
            const isMuted = activeFilters.length > 0 && !isActive;

            return (
              <button
                aria-pressed={isActive}
                className={`day-timeline__chip ${isActive ? "day-timeline__chip--active" : ""} ${isMuted ? "day-timeline__chip--muted" : ""}`}
                key={filter.type}
                onClick={() => toggleFilter(filter.type)}
                type="button"
              >
                {filter.type !== "life" ? <span className={`calendar-dot calendar-dot--${filter.type}`} /> : null}
                {filter.label}
                <strong>{filter.count}</strong>
              </button>
            );
          })}
        </div>
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
      {!readOnly ? <div className="date-event__actions">
        <button aria-label="활동으로 기록" disabled={isConverting || isDeleting} onClick={() => onCreateActivity(event)} title="이 계획을 실제 활동으로 기록" type="button">
          <Activity aria-hidden size={15} />
        </button>
        <button aria-label="수정" disabled={isDeleting} onClick={() => onEdit(event)} type="button">
          <Pencil aria-hidden size={15} />
        </button>
        <button aria-label="삭제" disabled={isDeleting} onClick={() => onDelete(event.id)} type="button">
          <Trash2 aria-hidden size={15} />
        </button>
      </div> : null}
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
      {!readOnly ? <div className="date-event__actions">
        <button aria-label="활동으로 기록" disabled={isConverting || isDeleting} onClick={() => onCreateActivity(task)} title="이 할 일을 실제 활동으로 기록" type="button">
          <Activity aria-hidden size={15} />
        </button>
        <button aria-label="수정" disabled={isDeleting} onClick={() => onEdit(task)} type="button">
          <Pencil aria-hidden size={15} />
        </button>
        <button aria-label="삭제" disabled={isDeleting} onClick={() => onDelete(task.id)} type="button">
          <Trash2 aria-hidden size={15} />
        </button>
      </div> : null}
    </article>
  );
}
