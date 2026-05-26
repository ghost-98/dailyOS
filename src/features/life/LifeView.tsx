"use client";

import { Activity, HeartPulse, MapPin, NotebookPen, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { fetchCalendarEventsFromDb } from "@/features/calendar/api";
import { CalendarView, type ExternalCalendarItem } from "@/features/calendar/CalendarView";
import type { CalendarEvent } from "@/features/calendar/data";
import { fetchWeightRecordsFromDb, fetchWorkoutSessionsFromDb } from "@/features/health/api";
import { HealthView } from "@/features/health/HealthView";
import { fetchExpenseRecordsFromDb } from "@/features/ledger/api";
import { LedgerView } from "@/features/ledger/LedgerView";
import { fetchTasksFromDb } from "@/features/tasks/api";
import type { ExpenseRecord, PlanPlace, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

export type LifeViewMode = "calendar" | "map";

type LifeViewProps = {
  mode: LifeViewMode;
};

type PlaceTimelineItem = {
  date: string;
  id: string;
  kind: "schedule" | "task" | "event";
  meta: string;
  place: PlanPlace;
  title: string;
};

const lifeCalendarSections = [
  {
    label: "가계부",
    description: "지출은 날짜별 금액과 카테고리로 시간축에 붙습니다.",
    icon: WalletCards,
  },
  {
    label: "건강",
    description: "몸무게와 운동 기록은 하루 단위 생활 기록으로 관리합니다.",
    icon: HeartPulse,
  },
  {
    label: "하루 기록",
    description: "하루 회고와 메모는 같은 날짜 흐름 안에서 이어갈 영역입니다.",
    icon: NotebookPen,
  },
];

const kindLabels: Record<PlaceTimelineItem["kind"], string> = {
  schedule: "일정",
  task: "할 일",
  event: "이벤트",
};

export function LifeView({ mode }: LifeViewProps) {
  return (
    <div className="life-page">
      <header className="page-header life-header">
        <div>
          <h1>라이프</h1>
          <div className="today__date">
            <Activity aria-hidden size={20} />
            <span>{mode === "calendar" ? "시간축으로 생활 기록을 관리합니다." : "장소축으로 일정과 할 일을 확인합니다."}</span>
          </div>
        </div>
      </header>

      {mode === "calendar" ? <LifeCalendarView /> : <LifeMapView />}
    </div>
  );
}

function LifeCalendarView() {
  const [externalItems, setExternalItems] = useState<ExternalCalendarItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchExpenseRecordsFromDb(), fetchWeightRecordsFromDb(), fetchWorkoutSessionsFromDb()])
      .then(([expenses, weights, workouts]) => {
        if (!isMounted) return;
        setExternalItems(buildExternalCalendarItems(expenses ?? [], weights ?? [], workouts ?? []));
      })
      .catch((error) => console.error("Failed to load life calendar records from Supabase", error));

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="life-axis-view">
      <CalendarView allowedTypes={["schedule", "event", "todo"]} externalItems={externalItems} showEventAddButton title="라이프 캘린더" />

      <section className="life-axis-summary" aria-label="시간축 생활 관리 영역">
        {lifeCalendarSections.map((section) => {
          const Icon = section.icon;

          return (
            <article className="life-axis-summary__item" key={section.label}>
              <Icon aria-hidden size={19} />
              <div>
                <strong>{section.label}</strong>
                <p>{section.description}</p>
              </div>
            </article>
          );
        })}
      </section>

      <LedgerView />
      <HealthView />

      <section className="daily-log-page life-daily-log-panel">
        <header className="page-header">
          <div>
            <h2>하루 기록</h2>
            <div className="today__date">
              <NotebookPen aria-hidden size={18} />
              <span>하루 회고와 메모를 같은 날짜 흐름에 연결할 예정입니다.</span>
            </div>
          </div>
        </header>
      </section>
    </div>
  );
}

function LifeMapView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchCalendarEventsFromDb(), fetchTasksFromDb(), fetchExpenseRecordsFromDb(), fetchWeightRecordsFromDb(), fetchWorkoutSessionsFromDb()])
      .then(([dbEvents, dbTasks, dbExpenses, dbWeights, dbWorkouts]) => {
        if (!isMounted) return;
        setEvents(dbEvents ?? []);
        setTasks(dbTasks ?? []);
        setExpenses(dbExpenses ?? []);
        setWeights(dbWeights ?? []);
        setWorkouts(dbWorkouts ?? []);
      })
      .catch((error) => console.error("Failed to load life map data from Supabase", error))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const timelineItems = useMemo(() => buildPlaceTimeline(events, tasks), [events, tasks]);
  const groups = useMemo(() => groupTimelineByPlace(timelineItems), [timelineItems]);
  const unlinkedCount = expenses.length + weights.length + workouts.length;

  return (
    <div className="life-map-view">
      <section className="life-map-hero">
        <div>
          <MapPin aria-hidden size={22} />
          <h2>장소축 라이프</h2>
          <p>장소가 연결된 일정과 할 일을 모아서 어디에서 무엇을 했는지 확인합니다. 가계부, 운동, 몸무게는 장소 필드가 연결되는 다음 단계부터 같은 지도축에 올라갑니다.</p>
        </div>
      </section>

      <section className="life-map-coverage" aria-label="장소축 연결 상태">
        <article>
          <span>장소 연결됨</span>
          <strong>{timelineItems.length}건</strong>
          <p>일정, 이벤트, 할 일</p>
        </article>
        <article>
          <span>장소 필드 필요</span>
          <strong>{unlinkedCount}건</strong>
          <p>가계부, 운동, 몸무게</p>
        </article>
      </section>

      {groups.length > 0 ? (
        <div className="life-place-grid">
          {groups.map((group) => (
            <SectionCard className="life-place-card" key={group.key}>
              <div className="life-place-card__head">
                <div>
                  <span>{group.place.address}</span>
                  <h3>{group.place.name}</h3>
                </div>
                <strong>{group.items.length}건</strong>
              </div>

              <div className="life-place-card__items">
                {group.items.slice(0, 6).map((item) => (
                  <article className="life-place-event" key={item.id}>
                    <span>{kindLabels[item.kind]}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.date} · {item.meta}</p>
                    </div>
                  </article>
                ))}
              </div>
            </SectionCard>
          ))}
        </div>
      ) : (
        <SectionCard className="life-map-empty">
          <MapPin aria-hidden size={32} />
          <strong>{isLoading ? "장소 기록을 불러오는 중입니다." : "장소가 연결된 라이프 항목이 없습니다."}</strong>
          <p>일정이나 할 일에 장소를 추가하면 이 화면에서 장소별 타임라인으로 묶어 볼 수 있습니다.</p>
        </SectionCard>
      )}
    </div>
  );
}

function buildPlaceTimeline(events: CalendarEvent[], tasks: TaskItem[]) {
  const eventItems: PlaceTimelineItem[] = events
    .filter((event) => (event.type === "schedule" || event.type === "event") && Boolean(event.place))
    .map((event) => ({
      id: event.id,
      date: event.date,
      kind: event.type === "event" ? "event" : "schedule",
      title: event.title,
      meta: event.time ?? event.meta,
      place: event.place as PlanPlace,
    }));

  const taskItems: PlaceTimelineItem[] = tasks
    .filter((task) => Boolean(task.place))
    .map((task) => ({
      id: task.id,
      date: task.scheduledDate,
      kind: "task",
      title: task.title,
      meta: task.dueDate ? `마감 ${task.dueDate}` : task.status,
      place: task.place as PlanPlace,
    }));

  return [...eventItems, ...taskItems].sort((a, b) => b.date.localeCompare(a.date));
}

function groupTimelineByPlace(items: PlaceTimelineItem[]) {
  const grouped = new Map<string, { items: PlaceTimelineItem[]; key: string; place: PlanPlace }>();

  for (const item of items) {
    const key = item.place.providerPlaceId ?? `${item.place.latitude}:${item.place.longitude}:${item.place.name}`;
    const current = grouped.get(key);
    if (current) {
      current.items.push(item);
    } else {
      grouped.set(key, { key, place: item.place, items: [item] });
    }
  }

  return [...grouped.values()].sort((a, b) => b.items.length - a.items.length || a.place.name.localeCompare(b.place.name));
}

function buildExternalCalendarItems(expenses: ExpenseRecord[], weights: WeightRecord[], workouts: WorkoutSession[]): ExternalCalendarItem[] {
  const expenseItems = expenses.map((expense) => ({
    id: expense.id,
    date: expense.date,
    type: "expense" as const,
    title: expense.title,
    meta: `${expense.amount.toLocaleString("ko-KR")}원`,
  }));

  const weightItems = weights.map((weight) => ({
    id: weight.id,
    date: weight.date,
    type: "weight" as const,
    title: "몸무게",
    meta: `${weight.weightKg}kg${weight.measuredFasted ? " · 공복" : ""}`,
  }));

  const workoutItems = workouts.map((workout) => ({
    id: workout.id,
    date: workout.date,
    type: "workout" as const,
    title: "운동",
    meta: `${workout.durationMinutes}분`,
  }));

  return [...expenseItems, ...weightItems, ...workoutItems].sort((a, b) => a.date.localeCompare(b.date));
}
