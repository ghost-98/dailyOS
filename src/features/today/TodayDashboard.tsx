import { BriefcaseBusiness, CalendarDays, Check, Dumbbell, HeartPulse } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { careerEvents, health, schedules, todos } from "./data";

const todayLabel = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
}).format(new Date());

const priorityLabel = {
  high: "높음",
  normal: "보통",
  low: "낮음",
};

const priorityTone = {
  high: "pink",
  normal: "amber",
  low: "muted",
} as const;

export function TodayDashboard() {
  const activeSchedules = schedules.filter((schedule) => schedule.status !== "canceled");
  const openTodos = todos.filter((todo) => todo.status !== "done");
  const completedCount = todos.filter((todo) => todo.status === "done").length;
  const completionRate = Math.round((completedCount / todos.length) * 100);
  const urgentCareerEvents = careerEvents.slice(0, 2);

  return (
    <div className="today today--compact">
      <header className="today__header page-header">
        <div>
          <h1>오늘</h1>
          <div className="today__date">
            <CalendarDays aria-hidden size={20} />
            <span>{todayLabel}</span>
          </div>
        </div>
      </header>

      <div className="today-summary-grid">
        <SectionCard className="today-focus-card">
          <span>다음 일정</span>
          <strong>{activeSchedules[0]?.title ?? "예정 없음"}</strong>
          <p>{activeSchedules[0] ? `${activeSchedules[0].startsAt} · ${activeSchedules[0].place}` : "오늘 남은 일정이 없습니다."}</p>
        </SectionCard>
        <SectionCard className="today-focus-card">
          <span>남은 할 일</span>
          <strong>{openTodos.length}</strong>
          <p>완료율 {completionRate}%</p>
        </SectionCard>
        <SectionCard className="today-focus-card">
          <span>최근 몸무게</span>
          <strong>{health.weightKg} kg</strong>
          <p>골격근량 {health.muscleMassKg} kg</p>
        </SectionCard>
      </div>

      <div className="today-work-grid">
        <SectionCard className="schedule-card">
          <div className="section-heading">
            <div className="card-title">
              <CalendarDays aria-hidden size={20} />
              <span>오늘 일정</span>
            </div>
          </div>
          <div className="schedule-list">
            {activeSchedules.slice(0, 3).map((schedule) => (
              <article className="schedule-item" key={schedule.id}>
                <div>
                  <span>{schedule.startsAt}</span>
                  <h3>{schedule.title}</h3>
                  <p>{schedule.place}</p>
                </div>
                <Badge tone="violet">{schedule.category}</Badge>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="todo-card">
          <div className="section-heading">
            <div className="card-title">
              <Check aria-hidden size={20} />
              <span>오늘 할 일</span>
            </div>
            <strong>{completionRate}%</strong>
          </div>
          <div className="todo-list">
            {openTodos.slice(0, 4).map((todo) => (
              <article className={`todo-item todo-item--${todo.status}`} key={todo.id}>
                <span className="todo-check" />
                <div>
                  <h3>{todo.title}</h3>
                  <p>{todo.dueLabel}</p>
                </div>
                <Badge tone={priorityTone[todo.priority]}>{priorityLabel[todo.priority]}</Badge>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="vitals-card today-health-card">
          <div className="card-title">
            <HeartPulse aria-hidden size={20} />
            <span>건강</span>
          </div>
          <div className="workout-plan">
            <Dumbbell aria-hidden size={18} />
            <div>
              <span>오늘 운동</span>
              <strong>{health.workoutPlan}</strong>
              <small>{health.workoutDetail}</small>
            </div>
          </div>
        </SectionCard>

        <SectionCard className="career-card">
          <div className="section-heading">
            <div className="card-title">
              <BriefcaseBusiness aria-hidden size={20} />
              <span>임박한 취업 일정</span>
            </div>
          </div>
          <div className="career-list">
            {urgentCareerEvents.map((event) => (
              <article className={`career-item career-item--${event.status}`} key={event.id}>
                <div>
                  <span>{event.kind.toUpperCase()}</span>
                  <h3>{event.company}</h3>
                  <p>{event.dateLabel}</p>
                </div>
                <strong>{event.dday}</strong>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
