"use client";

import { CalendarDays, Dumbbell, HeartPulse, WalletCards } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useDailyOSUser } from "@/components/auth/AuthGate";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { fetchCalendarEventsFromDb } from "@/features/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";
import { fetchWeightRecordsFromDb, fetchWorkoutSessionsFromDb } from "@/features/health/api";
import { fetchExpenseRecordsFromDb } from "@/features/ledger/api";
import { fetchTasksFromDb } from "@/features/tasks/api";
import type { ExpenseRecord, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

type TodayPlanTab = "schedule" | "todo" | "event";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

const currencyFormatter = new Intl.NumberFormat("ko-KR");

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

const planTabs: Array<{ key: TodayPlanTab; label: string }> = [
  { key: "schedule", label: "일정" },
  { key: "todo", label: "할 일" },
  { key: "event", label: "이벤트" },
];

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatCurrency(amount: number) {
  return `${currencyFormatter.format(amount)}원`;
}

function formatEventTime(event: CalendarEvent) {
  return event.time ?? "시간 없음";
}

async function safeLoad<T>(loader: () => Promise<T | null>, fallback: T) {
  try {
    return (await loader()) ?? fallback;
  } catch (error) {
    console.error("Failed to load today dashboard data", error);
    return fallback;
  }
}

export function TodayDashboard() {
  const { displayName } = useDailyOSUser();
  const todayKey = useMemo(getTodayKey, []);
  const monthKey = todayKey.slice(0, 7);
  const todayLabel = useMemo(() => dateFormatter.format(new Date()), []);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [activePlanTab, setActivePlanTab] = useState<TodayPlanTab>("schedule");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      safeLoad(fetchCalendarEventsFromDb, [] as CalendarEvent[]),
      safeLoad(fetchTasksFromDb, [] as TaskItem[]),
      safeLoad(fetchExpenseRecordsFromDb, [] as ExpenseRecord[]),
      safeLoad(fetchWeightRecordsFromDb, [] as WeightRecord[]),
      safeLoad(fetchWorkoutSessionsFromDb, [] as WorkoutSession[]),
    ]).then(([nextEvents, nextTasks, nextExpenses, nextWeights, nextWorkouts]) => {
      if (!isMounted) return;
      setEvents(nextEvents);
      setTasks(nextTasks);
      setExpenses(nextExpenses);
      setWeights(nextWeights);
      setWorkouts(nextWorkouts);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const todaySchedules = events.filter((event) => event.date === todayKey && event.type === "schedule");
  const todayEvents = events.filter((event) => event.date === todayKey && event.type === "event");
  const todayTasks = tasks.filter((task) => task.scheduledDate === todayKey);
  const openTasks = todayTasks.filter((task) => task.status !== "done");
  const completedCount = todayTasks.filter((task) => task.status === "done").length;
  const completionRate = todayTasks.length > 0 ? Math.round((completedCount / todayTasks.length) * 100) : 0;
  const todayExpenses = expenses.filter((expense) => expense.date === todayKey);
  const todayExpenseTotal = todayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const monthExpenseTotal = expenses.filter((expense) => expense.date.startsWith(monthKey)).reduce((sum, expense) => sum + expense.amount, 0);
  const todayWorkouts = workouts.filter((workout) => workout.date === todayKey);
  const workoutMinutes = todayWorkouts.reduce((sum, workout) => sum + workout.durationMinutes, 0);
  const latestWeight = weights[0];
  const activePlanCount = activePlanTab === "schedule" ? todaySchedules.length : activePlanTab === "todo" ? openTasks.length : todayEvents.length;

  return (
    <div className="today today--compact">
      <header className="today__header page-header">
        <div>
          <h1>{displayName}의 오늘</h1>
          <div className="today__date">
            <CalendarDays aria-hidden size={20} />
            <span>{todayLabel}</span>
          </div>
        </div>
      </header>

      <div className="today-summary-grid">
        <SectionCard className="today-focus-card">
          <span>오늘 시간 관리</span>
          <strong>{todaySchedules.length + todayEvents.length + openTasks.length}</strong>
          <p>{isLoading ? "불러오는 중입니다." : `${todaySchedules.length}개 일정 · ${openTasks.length}개 할 일 · ${todayEvents.length}개 이벤트`}</p>
        </SectionCard>
        <SectionCard className="today-focus-card">
          <span>오늘 지출</span>
          <strong>{todayExpenseTotal > 0 ? formatCurrency(todayExpenseTotal) : "-"}</strong>
          <p>{todayExpenses.length}건 · 이번 달 {formatCurrency(monthExpenseTotal)}</p>
        </SectionCard>
        <SectionCard className="today-focus-card">
          <span>건강 기록</span>
          <strong>{todayWorkouts.length > 0 ? `${workoutMinutes}분` : latestWeight ? `${latestWeight.weightKg} kg` : "-"}</strong>
          <p>{todayWorkouts.length > 0 ? `${todayWorkouts.length}개 운동 기록` : latestWeight ? "최근 몸무게 기준" : "아직 기록이 없습니다."}</p>
        </SectionCard>
      </div>

      <div className="today-work-grid">
        <SectionCard className="schedule-card today-plan-card">
          <DashboardHeader href="/schedule" icon={<CalendarDays aria-hidden size={20} />} title="시간 관리" trailing={`${completionRate}% 완료`} />
          <div className="today-plan-tabs" aria-label="오늘 시간 관리 분류">
            {planTabs.map((tab) => {
              const count = tab.key === "schedule" ? todaySchedules.length : tab.key === "todo" ? openTasks.length : todayEvents.length;
              return (
                <button className={activePlanTab === tab.key ? "today-plan-tab today-plan-tab--active" : "today-plan-tab"} key={tab.key} onClick={() => setActivePlanTab(tab.key)} type="button">
                  <span>{tab.label}</span>
                  <strong>{count}</strong>
                </button>
              );
            })}
          </div>

          <div className="today-plan-panel">
            <div className="today-plan-section__head">
              <span>{planTabs.find((tab) => tab.key === activePlanTab)?.label}</span>
              <strong>{activePlanCount}</strong>
            </div>
            {activePlanTab === "todo" ? (
              <div className="todo-list">
                {openTasks.length > 0 ? (
                  openTasks.slice(0, 5).map((task) => (
                    <article className={`todo-item todo-item--${task.status}`} key={task.id}>
                      <span className="todo-check" />
                      <div>
                        <h3>{task.title}</h3>
                        <p>{task.place?.name ?? (task.dueDate ? `마감 ${task.dueDate}` : "마감일 없음")}</p>
                      </div>
                      <Badge tone={priorityTone[task.priority]}>{priorityLabel[task.priority]}</Badge>
                    </article>
                  ))
                ) : (
                  <EmptyBlock href="/schedule" text="오늘 처리할 할 일이 없습니다." />
                )}
              </div>
            ) : (
              <div className="schedule-list">
                {(activePlanTab === "schedule" ? todaySchedules : todayEvents).length > 0 ? (
                  (activePlanTab === "schedule" ? todaySchedules : todayEvents).slice(0, 5).map((event) => (
                    <article className="schedule-item" key={event.id}>
                      <div>
                        <span>{formatEventTime(event)}</span>
                        <h3>{event.title}</h3>
                        <p>{event.place?.name ?? event.meta}</p>
                      </div>
                      <Badge tone={event.type === "event" ? "pink" : "violet"}>{event.type === "event" ? "이벤트" : "일정"}</Badge>
                    </article>
                  ))
                ) : (
                  <EmptyBlock href="/schedule" text={activePlanTab === "schedule" ? "오늘 등록된 일정이 없습니다." : "오늘 등록된 이벤트가 없습니다."} />
                )}
              </div>
            )}
          </div>
        </SectionCard>

        <div className="today-side-grid">
          <SectionCard className="schedule-card today-ledger-card">
            <DashboardHeader href="/ledger" icon={<WalletCards aria-hidden size={20} />} title="가계부" trailing={`${todayExpenses.length}건`} />
            <div className="today-ledger-total">
              <span>오늘 사용</span>
              <strong>{formatCurrency(todayExpenseTotal)}</strong>
            </div>
            <div className="today-ledger-list">
              {todayExpenses.length > 0 ? (
                todayExpenses.slice(0, 4).map((expense) => (
                  <article className="today-ledger-item" key={expense.id}>
                    <div>
                      <strong>{expense.title}</strong>
                      <p>{expense.memo ? `${expense.category} · ${expense.memo}` : expense.category}</p>
                    </div>
                    <b>{formatCurrency(expense.amount)}</b>
                  </article>
                ))
              ) : (
                <EmptyBlock href="/ledger" text="오늘 기록된 지출이 없습니다." />
              )}
            </div>
          </SectionCard>

          <SectionCard className="vitals-card today-health-card">
            <DashboardHeader href="/health" icon={<HeartPulse aria-hidden size={20} />} title="건강" />
            <div className="today-health-grid">
              <div className="workout-plan">
                <Dumbbell aria-hidden size={18} />
                <div>
                  <span>오늘 운동</span>
                  <strong>{todayWorkouts.length > 0 ? `${todayWorkouts.length}건 · ${workoutMinutes}분` : "기록 없음"}</strong>
                  <small>{todayWorkouts[0]?.type ?? "운동을 기록하면 오늘 화면에 바로 보입니다."}</small>
                </div>
              </div>
              <div className="workout-plan workout-plan--weight">
                <HeartPulse aria-hidden size={18} />
                <div>
                  <span>몸무게</span>
                  <strong>{latestWeight ? `${latestWeight.weightKg} kg` : "기록 없음"}</strong>
                  <small>{latestWeight?.measuredFasted ? "공복 측정" : latestWeight ? "최근 측정값" : "공복 여부까지 함께 관리합니다."}</small>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function DashboardHeader({ href, icon, title, trailing }: { href: string; icon: ReactNode; title: string; trailing?: string }) {
  return (
    <div className="section-heading">
      <div className="card-title">
        {icon}
        <span>{title}</span>
      </div>
      <div className="today-heading-actions">
        {trailing ? <strong>{trailing}</strong> : null}
        <Link className="empty-dashboard-link" href={href}>
          열기
        </Link>
      </div>
    </div>
  );
}

function EmptyBlock({ href, text }: { href: string; text: string }) {
  return (
    <div className="today-empty-block">
      <p>{text}</p>
      <Link className="empty-dashboard-link" href={href}>
        등록하러 가기
      </Link>
    </div>
  );
}
