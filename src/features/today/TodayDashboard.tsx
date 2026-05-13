import { BriefcaseBusiness, CalendarDays, Check, Dumbbell, HeartPulse } from "lucide-react";
import Link from "next/link";
import { SectionCard } from "@/components/ui/SectionCard";
import { careerEvents, health, schedules, todos } from "./data";

const todayLabel = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
}).format(new Date());

export function TodayDashboard() {
  const activeSchedules = schedules.filter((schedule) => schedule.status !== "canceled");
  const openTodos = todos.filter((todo) => todo.status !== "done");
  const completedCount = todos.filter((todo) => todo.status === "done").length;
  const completionRate = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0;
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
          <span>오늘 일정</span>
          <strong>{activeSchedules.length}</strong>
          <p>등록된 일정만 오늘 화면에 표시됩니다.</p>
        </SectionCard>
        <SectionCard className="today-focus-card">
          <span>남은 할 일</span>
          <strong>{openTodos.length}</strong>
          <p>완료율 {completionRate}%</p>
        </SectionCard>
        <SectionCard className="today-focus-card">
          <span>최근 몸무게</span>
          <strong>{health ? `${health.weightKg} kg` : "-"}</strong>
          <p>{health?.muscleMassKg ? `골격근량 ${health.muscleMassKg} kg` : "아직 기록이 없습니다."}</p>
        </SectionCard>
      </div>

      <div className="today-work-grid">
        <EmptyDashboardCard
          href="/schedule"
          icon={<CalendarDays aria-hidden size={20} />}
          title="일정"
          description="회의, 약속, 시험 같은 시간 기반 항목을 등록하세요."
        />
        <EmptyDashboardCard
          href="/tasks"
          icon={<Check aria-hidden size={20} />}
          title="할 일"
          description="오늘 처리할 작업과 마감일이 있는 일을 관리하세요."
        />
        <EmptyDashboardCard
          href="/health"
          icon={<HeartPulse aria-hidden size={20} />}
          title="건강"
          description="몸무게와 운동 기록을 쌓으면 추이를 볼 수 있습니다."
        />
        <EmptyDashboardCard
          href="/career/applied"
          icon={<BriefcaseBusiness aria-hidden size={20} />}
          title="취업"
          description={urgentCareerEvents.length > 0 ? "임박한 취업 일정이 있습니다." : "지원 기업, 예정 기업, 자격증을 등록하세요."}
        />
      </div>

      <SectionCard className="vitals-card today-health-card">
        <div className="card-title">
          <Dumbbell aria-hidden size={20} />
          <span>오늘의 시작</span>
        </div>
        <p className="empty-dashboard-copy">dailyOS는 샘플 데이터 없이 시작합니다. 필요한 항목을 하나씩 등록하면 오늘 화면이 자동으로 채워집니다.</p>
      </SectionCard>
    </div>
  );
}

function EmptyDashboardCard({ description, href, icon, title }: { description: string; href: string; icon: React.ReactNode; title: string }) {
  return (
    <SectionCard className="schedule-card empty-dashboard-card">
      <div className="section-heading">
        <div className="card-title">
          {icon}
          <span>{title}</span>
        </div>
      </div>
      <p>{description}</p>
      <Link className="empty-dashboard-link" href={href}>등록하러 가기</Link>
    </SectionCard>
  );
}
