import { BriefcaseBusiness, CalendarDays, Check, Clock3, Dumbbell, Filter, HeartPulse } from "lucide-react";
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
  high: "HIGH PRIORITY",
  normal: "NORMAL",
  low: "LOW",
};

const priorityTone = {
  high: "pink",
  normal: "muted",
  low: "muted",
} as const;

export function TodayDashboard() {
  const completedCount = todos.filter((todo) => todo.status === "done").length;
  const completionRate = Math.round((completedCount / todos.length) * 100);

  return (
    <div className="today">
      <header className="today__header">
        <div>
          <p className="eyebrow">CURRENT VECTOR</p>
          <h1>좋은 아침입니다, 사용자님.</h1>
          <div className="today__date">
            <CalendarDays aria-hidden size={20} />
            <span>{todayLabel}</span>
          </div>
        </div>
        <button className="header-action">
          <Clock3 aria-hidden size={18} />
          오늘 동기화
        </button>
      </header>

      <div className="dashboard-grid">
        <SectionCard className="hero-card">
          <div className="hero-card__backdrop" aria-hidden />
          <div className="hero-card__time">
            <p>현재 시간</p>
            <strong>14:42</strong>
            <span>PM</span>
          </div>
          <div className="hero-card__event">
            <div className="accent-line" />
            <div>
              <p>Next Sync Protocol</p>
              <h2>팀 주간 회의</h2>
              <span>Design Review & Sprint Allocation</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard className="vitals-card">
          <div className="card-title">
            <HeartPulse aria-hidden size={20} />
            <span>건강 요약</span>
          </div>
          <div className="vitals-ring" style={{ "--value": `${health.vitalsIndex}%` } as React.CSSProperties}>
            <strong>{health.vitalsIndex}</strong>
            <span>VITALS INDEX</span>
          </div>
          <div className="metrics-row">
            <div>
              <span>체중</span>
              <strong>{health.weightKg} kg</strong>
            </div>
            <div>
              <span>골격근량</span>
              <strong>{health.muscleMassKg} kg</strong>
            </div>
          </div>
          <div className="workout-plan">
            <Dumbbell aria-hidden size={18} />
            <div>
              <span>오늘의 운동 계획</span>
              <strong>{health.workoutPlan}</strong>
              <small>{health.workoutDetail}</small>
            </div>
          </div>
        </SectionCard>

        <SectionCard className="schedule-card">
          <div className="section-heading">
            <div className="card-title">
              <CalendarDays aria-hidden size={20} />
              <span>오늘 일정 요약</span>
            </div>
            <button>모두 보기</button>
          </div>
          <div className="schedule-list">
            {schedules.map((schedule) => (
              <article className={`schedule-item ${schedule.status === "canceled" ? "schedule-item--muted" : ""}`} key={schedule.id}>
                <div>
                  <span>{schedule.startsAt}</span>
                  <h3>{schedule.title}</h3>
                  <p>{schedule.place}</p>
                </div>
                <Badge tone={schedule.status === "canceled" ? "muted" : "violet"}>{schedule.category}</Badge>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="todo-card">
          <div className="section-heading">
            <div className="card-title">
              <Check aria-hidden size={20} />
              <span>할 일</span>
            </div>
            <div className="progress-meter">
              <span style={{ width: `${completionRate}%` }} />
            </div>
            <strong>{completionRate}%</strong>
          </div>

          <div className="todo-list">
            {todos.map((todo) => (
              <article className={`todo-item todo-item--${todo.status}`} key={todo.id}>
                <span className="todo-check">{todo.status === "done" ? <Check aria-hidden size={16} /> : null}</span>
                <div>
                  <h3>{todo.title}</h3>
                  <p>{todo.dueLabel}</p>
                </div>
                <Badge tone={priorityTone[todo.priority]}>{priorityLabel[todo.priority]}</Badge>
              </article>
            ))}
          </div>
        </SectionCard>

        <SectionCard className="career-card">
          <div className="section-heading">
            <div className="card-title">
              <BriefcaseBusiness aria-hidden size={20} />
              <span>취업 마감 임박</span>
            </div>
            <button aria-label="필터">
              <Filter aria-hidden size={18} />
            </button>
          </div>

          <div className="career-list">
            {careerEvents.map((event) => (
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

        <SectionCard className="system-log">
          <div>
            <p className="eyebrow">SYSTEM LOG</p>
            <h2>하루 운영 로그</h2>
            <ul>
              <li>오늘 일정 3개 중 2개가 활성 상태입니다.</li>
              <li>할 일 완료율은 {completionRate}%입니다.</li>
              <li>가장 가까운 취업 이벤트는 네이버 테크 인턴십 마감입니다.</li>
            </ul>
          </div>
          <div className="system-chip">PWA READY</div>
        </SectionCard>
      </div>
    </div>
  );
}
