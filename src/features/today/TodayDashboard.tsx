"use client";

import { BriefcaseBusiness, CalendarDays, Check, Dumbbell, HeartPulse } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { fetchCalendarEventsFromDb } from "@/features/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";
import { fetchCareerRecordsFromDb } from "@/features/career/api";
import type { ApplicationEvent, CareerRecord } from "@/features/career/data";
import { fetchWeightRecordsFromDb, fetchWorkoutSessionsFromDb } from "@/features/health/api";
import { fetchTasksFromDb } from "@/features/tasks/api";
import type { TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

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

type CareerAgendaItem = {
  id: string;
  company: string;
  date: string;
  dday: string;
  kind: string;
  status: "urgent" | "normal" | "muted";
};

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getDaysBetween(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
}

function formatDday(date: string, todayKey: string) {
  const diff = getDaysBetween(todayKey, date);
  if (diff === 0) return "D-DAY";
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

async function safeLoad<T>(loader: () => Promise<T | null>, fallback: T) {
  try {
    return (await loader()) ?? fallback;
  } catch (error) {
    console.error("Failed to load today dashboard data", error);
    return fallback;
  }
}

function buildCareerAgenda(records: CareerRecord[], todayKey: string) {
  const items: CareerAgendaItem[] = [];

  records.forEach((record) => {
    if (record.tab === "applied") {
      addCareerDate(items, record, "마감", record.deadlineDate, todayKey);
      addCareerDate(items, record, "시험", record.examDate, todayKey);
      addCareerDate(items, record, "면접", record.interviewDate, todayKey);
      addCareerDate(items, record, "결과", record.resultDate, todayKey);
      record.applicationEvents?.forEach((event) => addApplicationEvent(items, record, event, todayKey));
    }

    if (record.tab === "certificates") {
      addCareerDate(items, record, "자격증 만료", record.deadlineDate, todayKey);
    }
  });

  return items
    .filter((item) => getDaysBetween(todayKey, item.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
}

function addCareerDate(items: CareerAgendaItem[], record: CareerRecord, kind: string, date: string | undefined, todayKey: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const diff = getDaysBetween(todayKey, date);
  items.push({
    id: `${record.id}-${kind}-${date}`,
    company: record.title,
    date,
    dday: formatDday(date, todayKey),
    kind,
    status: diff <= 3 ? "urgent" : diff <= 7 ? "normal" : "muted",
  });
}

function addApplicationEvent(items: CareerAgendaItem[], record: CareerRecord, event: ApplicationEvent, todayKey: string) {
  const labels = {
    document: "서류",
    written: "필기",
    interview: "면접",
  };
  addCareerDate(items, record, labels[event.stage], event.date, todayKey);
}

export function TodayDashboard() {
  const todayKey = useMemo(getTodayKey, []);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [careerRecords, setCareerRecords] = useState<CareerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      safeLoad(fetchCalendarEventsFromDb, [] as CalendarEvent[]),
      safeLoad(fetchTasksFromDb, [] as TaskItem[]),
      safeLoad(fetchWeightRecordsFromDb, [] as WeightRecord[]),
      safeLoad(fetchWorkoutSessionsFromDb, [] as WorkoutSession[]),
      safeLoad(fetchCareerRecordsFromDb, [] as CareerRecord[]),
    ]).then(([nextEvents, nextTasks, nextWeights, nextWorkouts, nextCareerRecords]) => {
      if (!isMounted) return;
      setEvents(nextEvents);
      setTasks(nextTasks);
      setWeights(nextWeights);
      setWorkouts(nextWorkouts);
      setCareerRecords(nextCareerRecords);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const todayEvents = events.filter((event) => event.date === todayKey && (event.type === "schedule" || event.type === "event"));
  const todayTasks = tasks.filter((task) => task.scheduledDate === todayKey);
  const openTasks = todayTasks.filter((task) => task.status !== "done");
  const completedCount = todayTasks.filter((task) => task.status === "done").length;
  const completionRate = todayTasks.length > 0 ? Math.round((completedCount / todayTasks.length) * 100) : 0;
  const todayWorkouts = workouts.filter((workout) => workout.date === todayKey);
  const workoutMinutes = todayWorkouts.reduce((sum, workout) => sum + workout.durationMinutes, 0);
  const latestWeight = weights[0];
  const careerAgenda = buildCareerAgenda(careerRecords, todayKey);

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
          <strong>{todayEvents.length}</strong>
          <p>{isLoading ? "불러오는 중입니다." : "일정과 이벤트를 합산했습니다."}</p>
        </SectionCard>
        <SectionCard className="today-focus-card">
          <span>남은 할 일</span>
          <strong>{openTasks.length}</strong>
          <p>완료율 {completionRate}%</p>
        </SectionCard>
        <SectionCard className="today-focus-card">
          <span>최근 몸무게</span>
          <strong>{latestWeight ? `${latestWeight.weightKg} kg` : "-"}</strong>
          <p>{latestWeight?.muscleMassKg ? `골격근량 ${latestWeight.muscleMassKg} kg` : "아직 기록이 없습니다."}</p>
        </SectionCard>
      </div>

      <div className="today-work-grid">
        <SectionCard className="schedule-card">
          <DashboardHeader href="/schedule" icon={<CalendarDays aria-hidden size={20} />} title="오늘 일정" />
          <div className="schedule-list">
            {todayEvents.length > 0 ? todayEvents.slice(0, 4).map((event) => (
              <article className="schedule-item" key={event.id}>
                <div>
                  <span>{event.time ?? "시간 없음"}</span>
                  <h3>{event.title}</h3>
                  <p>{event.meta}</p>
                </div>
                <Badge tone={event.type === "event" ? "pink" : "violet"}>{event.type === "event" ? "이벤트" : "일정"}</Badge>
              </article>
            )) : <EmptyBlock href="/schedule" text="오늘 등록된 일정이 없습니다." />}
          </div>
        </SectionCard>

        <SectionCard className="todo-card">
          <DashboardHeader href="/tasks" icon={<Check aria-hidden size={20} />} title="오늘 할 일" trailing={`${completionRate}%`} />
          <div className="todo-list">
            {openTasks.length > 0 ? openTasks.slice(0, 4).map((task) => (
              <article className={`todo-item todo-item--${task.status}`} key={task.id}>
                <span className="todo-check" />
                <div>
                  <h3>{task.title}</h3>
                  <p>{task.dueDate ? `마감 ${task.dueDate}` : "마감일 없음"}</p>
                </div>
                <Badge tone={priorityTone[task.priority]}>{priorityLabel[task.priority]}</Badge>
              </article>
            )) : <EmptyBlock href="/tasks" text="오늘 남은 할 일이 없습니다." />}
          </div>
        </SectionCard>

        <SectionCard className="vitals-card today-health-card">
          <DashboardHeader href="/health" icon={<HeartPulse aria-hidden size={20} />} title="건강" />
          <div className="workout-plan">
            <Dumbbell aria-hidden size={18} />
            <div>
              <span>오늘 운동</span>
              <strong>{todayWorkouts.length > 0 ? `${todayWorkouts.length}건 · ${workoutMinutes}분` : "기록 없음"}</strong>
              <small>{latestWeight ? `최근 몸무게 ${latestWeight.weightKg}kg` : "몸무게를 기록해 보세요."}</small>
            </div>
          </div>
        </SectionCard>

        <SectionCard className="career-card">
          <DashboardHeader href="/career/applied" icon={<BriefcaseBusiness aria-hidden size={20} />} title="취업 일정" />
          <div className="career-list">
            {careerAgenda.length > 0 ? careerAgenda.map((event) => (
              <article className={`career-item career-item--${event.status}`} key={event.id}>
                <div>
                  <span>{event.kind}</span>
                  <h3>{event.company}</h3>
                  <p>{event.date}</p>
                </div>
                <strong>{event.dday}</strong>
              </article>
            )) : <EmptyBlock href="/career/applied" text="다가오는 취업 일정이 없습니다." />}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function DashboardHeader({ href, icon, title, trailing }: { href: string; icon: React.ReactNode; title: string; trailing?: string }) {
  return (
    <div className="section-heading">
      <div className="card-title">
        {icon}
        <span>{title}</span>
      </div>
      {trailing ? <strong>{trailing}</strong> : <Link className="empty-dashboard-link" href={href}>관리</Link>}
    </div>
  );
}

function EmptyBlock({ href, text }: { href: string; text: string }) {
  return (
    <div className="today-empty-block">
      <p>{text}</p>
      <Link className="empty-dashboard-link" href={href}>등록하러 가기</Link>
    </div>
  );
}
