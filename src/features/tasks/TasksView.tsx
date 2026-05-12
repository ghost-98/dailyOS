import { ArrowRight, CalendarClock, Check, ChevronRight, Clock3, ListTodo, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import type { TaskItem, TaskPriority, TaskStatus } from "@/types/domain";
import { tasks } from "./data";

const today = "2026-05-12";

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

function formatDateLabel(date: string) {
  const diff = getDaysBetween(today, date);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === -1) return "어제";
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

function getDeadlineState(task: TaskItem) {
  if (!task.dueDate || task.status === "done") return null;
  const diff = getDaysBetween(today, task.dueDate);
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
  const completedCount = tasks.filter((task) => task.status === "done").length;
  const todayScheduledCount = tasks.filter((task) => task.scheduledDate === today && task.status !== "done").length;
  const urgentCount = tasks.filter((task) => {
    const deadline = getDeadlineState(task);
    return deadline?.tone === "danger" || deadline?.tone === "warning";
  }).length;
  const completionRate = Math.round((completedCount / tasks.length) * 100);
  const columns = groupTasksByStatus(tasks);

  return (
    <div className="tasks-page">
      <header className="tasks-header">
        <div>
          <p className="eyebrow">TASK OPERATIONS</p>
          <h1>할 일</h1>
          <div className="today__date">
            <ListTodo aria-hidden size={20} />
            <span>예정일은 오늘의 배치, 마감일은 지켜야 할 기한입니다.</span>
          </div>
        </div>
        <button className="header-action">
          <Plus aria-hidden size={18} />
          할 일 추가
        </button>
      </header>

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
              {column.items.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: TaskItem }) {
  const deadline = getDeadlineState(task);
  const canDefer = task.status !== "done";

  return (
    <article className={`task-card task-card--${task.status}`}>
      <div className="task-card__top">
        <span className="task-check">{task.status === "done" ? <Check aria-hidden size={15} /> : null}</span>
        <Badge tone={priorityTone[task.priority]}>{priorityLabels[task.priority]}</Badge>
        {deadline ? <span className={`deadline-badge deadline-badge--${deadline.tone}`}>{deadline.label}</span> : null}
      </div>

      <h3>{task.title}</h3>

      <div className="task-card__meta">
        <span>
          <CalendarClock aria-hidden size={15} />
          예정 {formatDateLabel(task.scheduledDate)}
        </span>
        {task.dueDate ? (
          <span>
            <Clock3 aria-hidden size={15} />
            마감 {formatDateLabel(task.dueDate)}
          </span>
        ) : null}
      </div>

      {task.memo ? <p>{task.memo}</p> : null}

      <div className="task-card__footer">
        {task.deferredCount > 0 ? <span className="defer-count">미룸 {task.deferredCount}회</span> : <span />}
        {canDefer ? (
          <button>
            내일로
            <ArrowRight aria-hidden size={15} />
          </button>
        ) : (
          <span className="completed-label">완료됨</span>
        )}
      </div>
    </article>
  );
}
