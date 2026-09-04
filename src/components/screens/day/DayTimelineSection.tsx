"use client";

import type { DragEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Activity, Check, Clock3, MapPin, Pencil, Receipt, Trash2, UserRound } from "lucide-react";
import { TimelineRail } from "@/components/screens/day/timeline/TimelineRail";
import { UnifiedTimelineCard } from "@/components/screens/day/timeline/UnifiedTimelineCard";
import { IconButton } from "@/components/ui/IconButton";
import { CalendarFilterChip } from "@/features/calendar/CalendarFilterChip";
import { EmptyDateState } from "@/features/calendar/calendarUiParts";
import { useResponsiveMode } from "@/hooks/useResponsiveMode";
import { categoryLabels, taskPriorityLabels } from "@/features/calendar/presentation";
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
  headerContent,
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
  summaryTitle,
  showSummary = true,
}: {
  countsByCategory?: { event: number; todo: number };
  deletingPlan?: { id: string; type: "event" | "task" } | null;
  draggingItem: { id: string; type: "event" | "todo" } | null;
  dropTarget: { id: string; placement: DragPlacement } | null;
  headerContent?: ReactNode;
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
  summaryTitle?: string;
  showSummary?: boolean;
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
      {showSummary ? (
        <div className="day-timeline__summary">
          <div className="day-timeline__summary-copy">
            <span>{summaryTitle ?? "하루 타임라인"}</span>
            {countsByCategory ? (
              <div className="day-timeline__summary-filters" aria-label="타임라인 필터">
                {([
                  ["todo", "할 일", countsByCategory.todo],
                  ["event", "이벤트", countsByCategory.event],
                ] as const).map(([type, label, count]) => (
                  <CalendarFilterChip
                    active={activeFilters.includes(type)}
                    count={count}
                    key={type}
                    label={label}
                    muted={activeFilters.length > 0 && !activeFilters.includes(type)}
                    onClick={() => toggleFilter(type)}
                    tone={type}
                  />
                ))}
              </div>
            ) : null}
          </div>
          <strong className="day-timeline__summary-meta">{filteredItems.length}개</strong>
        </div>
      ) : headerContent ? (
        <div className="day-timeline__embedded-head">
          {headerContent}
        </div>
      ) : null}

      {filteredItems.length > 0 ? (
        <TimelineRail className="day-timeline__rail" empty={<div className="day-timeline__empty"><EmptyDateState isLoading={isLoading} label="타임라인" /></div>}>
          {filteredItems.map((item) =>
            item.type === "todo" ? (
              <TaskTimelineCard
                dropPlacement={dropTarget?.id === item.task.id && draggingItem?.id !== item.task.id ? dropTarget.placement : null}
                isConverting={isConvertingToActivity?.type === "task" && isConvertingToActivity.id === item.task.id}
                isDeleting={deletingPlan?.type === "task" && deletingPlan.id === item.task.id}
                isDragging={draggingItem?.id === item.task.id}
                key={item.id}
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
              <EventTimelineCard
                dropPlacement={dropTarget?.id === item.event.id && draggingItem?.id !== item.event.id ? dropTarget.placement : null}
                event={item.event}
                isConverting={isConvertingToActivity?.type === "event" && isConvertingToActivity.id === item.event.id}
                isDeleting={deletingPlan?.type === "event" && deletingPlan.id === item.event.id}
                isDragging={draggingItem?.id === item.event.id}
                key={item.id}
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
              <ExternalTimelineItem item={item.external} key={item.id} />
            ),
          )}
        </TimelineRail>
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

function EventTimelineCard({
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
  const { isMobile } = useResponsiveMode();
  const [isExpanded, setIsExpanded] = useState(false);
  const detailRows = getPlanDetailRows({
    companions: event.companions,
    expenseAmount: event.expenseAmount,
    memo: event.meta,
    placeName: event.place?.name,
  });

  return (
    <div
      className={`timeline-accordion-card-shell ${readOnly ? "timeline-accordion-card-shell--readonly" : ""} ${isDragging ? "timeline-accordion-card-shell--dragging" : ""} ${
        dropPlacement ? `timeline-accordion-card-shell--drop-${dropPlacement}` : ""
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
      <UnifiedTimelineCard
        actions={!readOnly ? (
          <>
            <IconButton aria-label="활동으로 기록" disabled={isConverting || isDeleting} label="활동으로 기록" onClick={() => onCreateActivity(event)} size="sm" tone="outline">
              <Activity aria-hidden size={15} />
            </IconButton>
            <IconButton aria-label="수정" disabled={isDeleting} label="수정" onClick={() => onEdit(event)} size="sm" tone="outline">
              <Pencil aria-hidden size={15} />
            </IconButton>
            <IconButton aria-label="삭제" disabled={isDeleting} label="삭제" onClick={() => onDelete(event.id)} size="sm" tone="danger">
              <Trash2 aria-hidden size={15} />
            </IconButton>
          </>
        ) : null}
        badge={<em className="record-timeline-card__badge record-timeline-card__badge--event">{categoryLabels[event.type as CalendarCategory]}</em>}
        details={detailRows.map((item) => ({ icon: item.icon, value: item.value }))}
        expanded={isExpanded}
        isDone={false}
        layout={isMobile ? "mobile" : "desktop"}
        leading={<span className="record-timeline-card__time-badge"><Clock3 aria-hidden size={13} />{event.isAllDay ? "종일" : event.time || "미정"}</span>}
        onToggle={() => setIsExpanded((current) => !current)}
        title={event.title}
        tone="event"
      />
    </div>
  );
}

function TaskTimelineCard({
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
  const { isMobile } = useResponsiveMode();
  const [isExpanded, setIsExpanded] = useState(false);
  const isDone = task.status === "done";
  const detailRows = getPlanDetailRows({
    companions: task.companions,
    expenseAmount: task.expenseAmount,
    memo: task.memo,
    placeName: task.place?.name,
  });

  return (
    <div
      className={`timeline-accordion-card-shell ${readOnly ? "timeline-accordion-card-shell--readonly" : ""} ${isDone ? "timeline-accordion-card-shell--done" : ""} ${isDragging ? "timeline-accordion-card-shell--dragging" : ""} ${
        dropPlacement ? `timeline-accordion-card-shell--drop-${dropPlacement}` : ""
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
      <UnifiedTimelineCard
        actions={!readOnly ? (
          <>
            <IconButton aria-label="활동으로 기록" disabled={isConverting || isDeleting} label="활동으로 기록" onClick={() => onCreateActivity(task)} size="sm" tone="outline">
              <Activity aria-hidden size={15} />
            </IconButton>
            <IconButton aria-label="수정" disabled={isDeleting} label="수정" onClick={() => onEdit(task)} size="sm" tone="outline">
              <Pencil aria-hidden size={15} />
            </IconButton>
            <IconButton aria-label="삭제" disabled={isDeleting} label="삭제" onClick={() => onDelete(task.id)} size="sm" tone="danger">
              <Trash2 aria-hidden size={15} />
            </IconButton>
          </>
        ) : null}
        badge={<em className={`record-timeline-card__badge record-timeline-card__badge--priority-${task.priority}`}>{taskPriorityLabels[task.priority]}</em>}
        details={detailRows.map((item) => ({ icon: item.icon, value: item.value }))}
        expanded={isExpanded}
        isDone={isDone}
        layout={isMobile ? "mobile" : "desktop"}
        leading={
          <span className="record-timeline-card__time-badge record-timeline-card__time-badge--todo">
            <button className={isDone ? "record-timeline-card__check record-timeline-card__check--done" : "record-timeline-card__check"} aria-label={isDone ? "완료 취소" : "완료"} onClick={(event) => {
              event.stopPropagation();
              onToggleDone(task);
            }} type="button">
              {isDone ? <Check aria-hidden size={14} /> : null}
            </button>
            <span>{task.isAllDay ? "종일" : task.startTime || "미정"}</span>
          </span>
        }
        onToggle={() => setIsExpanded((current) => !current)}
        title={task.title}
        tone="todo"
      />
    </div>
  );
}

function getPlanDetailRows({
  companions,
  expenseAmount,
  memo,
  placeName,
}: {
  companions?: string;
  expenseAmount?: number;
  memo?: string;
  placeName?: string;
}) {
  return [
    placeName ? { icon: MapPin, value: placeName } : null,
    companions ? { icon: UserRound, value: companions } : null,
    expenseAmount !== undefined ? { icon: Receipt, value: `${expenseAmount.toLocaleString("ko-KR")}원` } : null,
    memo ? { icon: Activity, value: memo, variant: "memo" as const } : null,
  ].filter(Boolean) as Array<{ icon: typeof MapPin; value: string; variant?: "memo" }>;
}
