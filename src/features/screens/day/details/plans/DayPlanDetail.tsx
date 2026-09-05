import { CalendarDays, Check, ListChecks, MapPin, Pencil, Trash2 } from "lucide-react";
import type { DayItemActions, DayPlanItem } from "@/features/screens/day/dayDetailTypes";

type DayPlanDetailProps = {
  actions?: DayItemActions;
  items: DayPlanItem[];
};

export function DayPlanDetail({ actions, items }: DayPlanDetailProps) {
  const tasks = items.filter((item): item is Extract<DayPlanItem, { task: unknown }> => item.type === "todo");
  const events = items.filter((item): item is Extract<DayPlanItem, { event: unknown }> => item.type === "event");

  return (
    <div className="life-day-plan-groups">
      <PlanSection count={tasks.length} icon={ListChecks} title="할 일">
        {tasks.map((item) => {
          const isDone = item.task.status === "done";
          return (
            <article className={`life-day-plan-card ${isDone ? "life-day-plan-card--done" : ""}`} key={item.id}>
              <button aria-label={`${item.task.title} ${isDone ? "완료 취소" : "완료"}`} aria-pressed={isDone} className="life-day-plan-card__check" disabled={!actions} onClick={() => void actions?.toggleTask(item.task)} type="button">
                {isDone ? <Check aria-hidden size={14} /> : null}
              </button>
              <div className="life-day-plan-card__content">
                <span>{item.timeLabel}</span>
                <strong>{item.task.title}</strong>
                {item.task.place?.name ? <small><MapPin aria-hidden size={12} /> {item.task.place.name}</small> : null}
              </div>
              {actions ? <PlanActions onDelete={() => actions.deleteTask(item.task.id)} onEdit={() => actions.editTask(item.task)} type="할 일" /> : null}
            </article>
          );
        })}
      </PlanSection>

      <PlanSection count={events.length} icon={CalendarDays} title="이벤트">
        {events.map((item) => (
          <article className="life-day-plan-card" key={item.id}>
            <span className="life-day-plan-card__event-icon"><CalendarDays aria-hidden size={15} /></span>
            <div className="life-day-plan-card__content">
              <span>{item.timeLabel}</span>
              <strong>{item.event.title}</strong>
              {item.event.place?.name ? <small><MapPin aria-hidden size={12} /> {item.event.place.name}</small> : null}
            </div>
            {actions ? <PlanActions onDelete={() => actions.deleteEvent(item.event.id)} onEdit={() => actions.editEvent(item.event)} type="이벤트" /> : null}
          </article>
        ))}
      </PlanSection>
    </div>
  );
}

function PlanSection({ children, count, icon: Icon, title }: { children: React.ReactNode; count: number; icon: typeof CalendarDays; title: string }) {
  return (
    <section className="life-day-plan-group">
      <header className="life-day-plan-group__heading">
        <span><Icon aria-hidden size={15} /> {title}</span>
        <b>{count}건</b>
      </header>
      <div className="life-day-plan-list">{count > 0 ? children : <p className="life-day-plan-group__empty">등록된 {title}이 없어요.</p>}</div>
    </section>
  );
}

function PlanActions({ onDelete, onEdit, type }: { onDelete: () => Promise<void> | void; onEdit: () => Promise<void> | void; type: string }) {
  return (
    <div className="life-calendar-day-item-actions">
      <button aria-label={`${type} 수정`} onClick={() => void onEdit()} type="button"><Pencil aria-hidden size={13} /></button>
      <button aria-label={`${type} 삭제`} onClick={() => void onDelete()} type="button"><Trash2 aria-hidden size={13} /></button>
    </div>
  );
}
