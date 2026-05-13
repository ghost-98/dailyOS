"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Bell, CalendarClock, Check, ChevronLeft, ChevronRight, Clock3, ListTodo, Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import type { TaskItem, TaskPriority, TaskStatus } from "@/types/domain";
import { tasks } from "./data";

const initialDate = "2026-05-12";

const statusLabels: Record<TaskStatus, string> = {
  todo: "할 일",
  inProgress: "진행 중",
  done: "완료",
};

const priorityLabels: Record<TaskPriority, string> = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};

const priorityTone: Record<TaskPriority, "pink" | "amber" | "muted"> = {
  high: "pink",
  normal: "amber",
  low: "muted",
};

function getDaysBetween(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(date: string, baseDate: string) {
  const diff = getDaysBetween(baseDate, date);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === -1) return "어제";
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

function formatSelectedDay(date: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${date}T00:00:00`));
}

function getDeadlineState(task: TaskItem, baseDate: string) {
  if (!task.dueDate || task.status === "done") return null;
  const diff = getDaysBetween(baseDate, task.dueDate);
  const scheduledAfterDeadline = getDaysBetween(task.dueDate, task.scheduledDate) > 0;

  if (diff < 0 || scheduledAfterDeadline) return { label: "기한 지남", tone: "danger" as const };
  if (diff === 0) return { label: "오늘 마감", tone: "danger" as const };
  if (diff <= 3) return { label: `D-${diff}`, tone: "warning" as const };
  return { label: `D-${diff}`, tone: "quiet" as const };
}

function groupTasksByStatus(items: TaskItem[]) {
  return (Object.keys(statusLabels) as TaskStatus[]).map((status) => ({
    status,
    items: items.filter((task) => task.status === status),
  }));
}

export function TasksView() {
  const [items, setItems] = useState<TaskItem[]>(tasks);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const visibleTasks = useMemo(() => items.filter((task) => task.scheduledDate === selectedDate), [items, selectedDate]);
  const completedCount = visibleTasks.filter((task) => task.status === "done").length;
  const todayScheduledCount = visibleTasks.filter((task) => task.status !== "done").length;
  const urgentCount = visibleTasks.filter((task) => {
    const deadline = getDeadlineState(task, selectedDate);
    return deadline?.tone === "danger" || deadline?.tone === "warning";
  }).length;
  const completionRate = visibleTasks.length > 0 ? Math.round((completedCount / visibleTasks.length) * 100) : 0;
  const columns = groupTasksByStatus(visibleTasks);

  return (
    <div className="tasks-page">
      <header className="tasks-header page-header">
        <div>
          <h1>할 일</h1>
          <div className="today__date">
            <ListTodo aria-hidden size={20} />
            <span>예정일은 오늘의 배치, 마감일은 지켜야 할 기한입니다.</span>
          </div>
        </div>
        <button className="header-action" onClick={() => {
          setEditingTask(null);
          setIsTaskSheetOpen(true);
        }}>
          <Plus aria-hidden size={18} />
          할 일 추가
        </button>
      </header>

      <SectionCard className="task-day-switcher">
        <button aria-label="이전 날짜" onClick={() => setSelectedDate((date) => addDays(date, -1))}>
          <ChevronLeft aria-hidden size={20} />
        </button>
        <button className="task-date-trigger" onClick={() => setIsDatePickerOpen(true)}>
          {formatSelectedDay(selectedDate)}
        </button>
        <button aria-label="다음 날짜" onClick={() => setSelectedDate((date) => addDays(date, 1))}>
          <ChevronRight aria-hidden size={20} />
        </button>
      </SectionCard>

      <div className="task-stats">
        <SectionCard className="task-stat-card">
          <span>오늘 예정</span>
          <strong>{todayScheduledCount}</strong>
          <p>오늘 처리하도록 배치된 미완료 작업</p>
        </SectionCard>
        <SectionCard className="task-stat-card task-stat-card--urgent">
          <span>마감 압박</span>
          <strong>{urgentCount}</strong>
          <p>오늘 마감, 기한 지남, D-3 이내</p>
        </SectionCard>
        <SectionCard className="task-stat-card">
          <span>완료율</span>
          <strong>{completionRate}%</strong>
          <div className="task-progress">
            <span style={{ width: `${completionRate}%` }} />
          </div>
        </SectionCard>
      </div>

      <div className="task-board">
        {columns.map((column) => (
          <SectionCard className={`task-column task-column--${column.status}`} key={column.status}>
            <div className="task-column__header">
              <div>
                <span>{statusLabels[column.status]}</span>
                <strong>{column.items.length}</strong>
              </div>
              <button aria-label={`${statusLabels[column.status]} 필터`}>
                <ChevronRight aria-hidden size={18} />
              </button>
            </div>

            <div className="task-list">
              {column.items.length > 0 ? column.items.map((task) => (
                <TaskCard
                  key={task.id}
                  onDelete={(id) => setItems((current) => current.filter((item) => item.id !== id))}
                  onDefer={(id) => setItems((current) => current.map((item) => item.id === id ? { ...item, scheduledDate: addDays(item.scheduledDate, 1), deferredCount: item.deferredCount + 1 } : item))}
                  onEdit={(target) => {
                    setEditingTask(target);
                    setIsTaskSheetOpen(true);
                  }}
                  onToggleDone={(id) => setItems((current) => current.map((item) => item.id === id ? { ...item, status: item.status === "done" ? "todo" : "done", completedAt: item.status === "done" ? undefined : new Date().toISOString() } : item))}
                  selectedDate={selectedDate}
                  task={task}
                />
              )) : <EmptyTaskColumn status={column.status} />}
            </div>
          </SectionCard>
        ))}
      </div>

      {isTaskSheetOpen ? (
        <TaskCreateSheet
          selectedDate={selectedDate}
          task={editingTask}
          onClose={() => {
            setIsTaskSheetOpen(false);
            setEditingTask(null);
          }}
          onSave={(task) => {
            setItems((current) => {
              const exists = current.some((item) => item.id === task.id);
              return exists ? current.map((item) => item.id === task.id ? task : item) : [task, ...current];
            });
            setIsTaskSheetOpen(false);
            setEditingTask(null);
          }}
        />
      ) : null}
      {isDatePickerOpen ? (
        <TaskDatePickerSheet
          selectedDate={selectedDate}
          onClose={() => setIsDatePickerOpen(false)}
          onSelect={(date) => {
            setSelectedDate(date);
            setIsDatePickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function TaskCard({
  onDelete,
  onDefer,
  onEdit,
  onToggleDone,
  selectedDate,
  task,
}: {
  onDelete: (id: string) => void;
  onDefer: (id: string) => void;
  onEdit: (task: TaskItem) => void;
  onToggleDone: (id: string) => void;
  selectedDate: string;
  task: TaskItem;
}) {
  const deadline = getDeadlineState(task, selectedDate);
  const canDefer = task.status !== "done";

  return (
    <article className={`task-card task-card--${task.status}`}>
      <div className="task-card__top">
        <button className="task-check" aria-label="완료 전환" onClick={() => onToggleDone(task.id)}>{task.status === "done" ? <Check aria-hidden size={15} /> : null}</button>
        <Badge tone={priorityTone[task.priority]}>{priorityLabels[task.priority]}</Badge>
        {deadline ? <span className={`deadline-badge deadline-badge--${deadline.tone}`}>{deadline.label}</span> : null}
      </div>

      <h3>{task.title}</h3>

      <div className="task-card__meta">
        <span>
          <CalendarClock aria-hidden size={15} />
          예정 {formatDateLabel(task.scheduledDate, selectedDate)}
        </span>
        {task.dueDate ? (
          <span>
            <Clock3 aria-hidden size={15} />
            마감 {formatDateLabel(task.dueDate, selectedDate)}
          </span>
        ) : null}
      </div>

      {task.memo ? <p>{task.memo}</p> : null}

      <div className="task-card__footer">
        {task.deferredCount > 0 ? <span className="defer-count">미룸 {task.deferredCount}회</span> : <span />}
        <div className="task-card__actions">
          <button aria-label="수정" onClick={() => onEdit(task)}>
            <Pencil aria-hidden size={15} />
          </button>
          {canDefer ? (
            <button onClick={() => onDefer(task.id)}>
              내일로
              <ArrowRight aria-hidden size={15} />
            </button>
          ) : (
            <span className="completed-label">완료됨</span>
          )}
          <button aria-label="삭제" onClick={() => onDelete(task.id)}>
            <Trash2 aria-hidden size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyTaskColumn({ status }: { status: TaskStatus }) {
  return (
    <div className="task-empty-column">
      <ListTodo aria-hidden size={22} />
      <strong>{statusLabels[status]} 항목이 없습니다.</strong>
      <p>선택한 날짜의 작업만 표시됩니다.</p>
    </div>
  );
}

function TaskCreateSheet({
  onClose,
  onSave,
  selectedDate,
  task,
}: {
  onClose: () => void;
  onSave: (task: TaskItem) => void;
  selectedDate: string;
  task: TaskItem | null;
}) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [memo, setMemo] = useState(task?.memo ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "normal");
  const [scheduledDate, setScheduledDate] = useState(task?.scheduledDate ?? selectedDate);
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
      <section
        aria-labelledby="task-sheet-title"
        aria-modal="true"
        className="event-sheet task-sheet"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header">
          <button className="event-sheet__text-button" onClick={onClose}>취소</button>
          <h2 id="task-sheet-title">{task ? "할 일 수정" : "새로운 할 일"}</h2>
          <button className="event-sheet__done-button" onClick={saveTask}>{task ? "저장" : "추가"}</button>
        </header>

        <div className="event-sheet__body">
          <div className="event-form-card event-form-card--title">
            <label>
              <span>제목</span>
              <input autoFocus placeholder="할 일 제목" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              <span>메모</span>
              <input placeholder="필요한 내용을 짧게 적어두세요" value={memo} onChange={(event) => setMemo(event.target.value)} />
            </label>
          </div>

          <div className="event-form-card">
            <label className="event-form-row event-form-row--select">
              <div className="event-form-row__label">
                <ListTodo aria-hidden size={18} />
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
              <span>예정일</span>
              <input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />
            </label>
            <label className="event-form-row event-form-row--field">
              <span>마감일</span>
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
          </div>

          <div className="event-form-card">
            <label className="event-note">
              <span>상세 메모</span>
              <textarea placeholder="작업 기준, 링크, 체크할 내용을 적어두세요." rows={4} />
            </label>
          </div>
        </div>

        <button className="event-sheet__floating-close" aria-label="닫기" onClick={onClose}>
          <X aria-hidden size={18} />
        </button>
      </section>
    </div>
  );
}

function TaskDatePickerSheet({
  selectedDate,
  onClose,
  onSelect,
}: {
  selectedDate: string;
  onClose: () => void;
  onSelect: (date: string) => void;
}) {
  const [year, setYear] = useState(Number(selectedDate.slice(0, 4)));
  const [month, setMonth] = useState(Number(selectedDate.slice(5, 7)));
  const [day, setDay] = useState(Number(selectedDate.slice(8, 10)));
  const daysInMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, daysInMonth);

  const applyDate = () => {
    onSelect(`${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`);
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="task-date-picker-title"
        aria-modal="true"
        className="event-sheet date-picker-sheet"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header">
          <button className="event-sheet__text-button" onClick={onClose}>취소</button>
          <h2 id="task-date-picker-title">날짜 선택</h2>
          <button className="event-sheet__done-button" onClick={applyDate}>완료</button>
        </header>

        <div className="date-picker-body">
          <div className="date-picker-preview">{formatSelectedDay(`${year}-${String(month).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`)}</div>
          <div className="date-picker-grid">
            <label>
              <span>연도</span>
              <select value={year} onChange={(event) => setYear(Number(event.target.value))}>
                {Array.from({ length: 11 }, (_, index) => 2021 + index).map((value) => (
                  <option key={value} value={value}>{value}년</option>
                ))}
              </select>
            </label>
            <label>
              <span>월</span>
              <select value={month} onChange={(event) => setMonth(Number(event.target.value))}>
                {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>{value}월</option>
                ))}
              </select>
            </label>
            <label>
              <span>일</span>
              <select value={safeDay} onChange={(event) => setDay(Number(event.target.value))}>
                {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>{value}일</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>
    </div>
  );
}
