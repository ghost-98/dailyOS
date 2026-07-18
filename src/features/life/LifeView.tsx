"use client";

import { MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { fetchCalendarEventsFromDb } from "@/features/calendar/api";
import { CalendarView } from "@/features/calendar/CalendarView";
import type { CalendarEvent } from "@/features/calendar/data";
import { fetchWeightRecordsFromDb, fetchWorkoutSessionsFromDb } from "@/features/health/api";
import { fetchExpenseRecordsFromDb } from "@/features/ledger/api";
import { LedgerView } from "@/features/ledger/LedgerView";
import { fetchTasksFromDb } from "@/features/tasks/api";
import type { ExpenseRecord, PlanPlace, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

export type LifeViewMode = "calendar" | "map";

type LifeViewProps = {
  mode: LifeViewMode;
};

type LifeCalendarTab = "events" | "ledger";

type PlaceTimelineItem = {
  date: string;
  id: string;
  kind: "schedule" | "task" | "event";
  meta: string;
  place: PlanPlace;
  title: string;
};

const kindLabels: Record<PlaceTimelineItem["kind"], string> = {
  schedule: "일정",
  task: "할 일",
  event: "이벤트",
};

export function LifeView({ mode }: LifeViewProps) {
  return <div className="life-page">{mode === "calendar" ? <LifeCalendarView /> : <LifeMapView />}</div>;
}

function LifeCalendarView() {
  const [activeTab, setActiveTab] = useState<LifeCalendarTab>("events");

  return (
    <div className="life-axis-view">
      <div className="life-calendar-switch" aria-label="라이프 캘린더 보기 전환">
        <button
          className={activeTab === "events" ? "life-calendar-switch__item life-calendar-switch__item--active" : "life-calendar-switch__item"}
          onClick={() => setActiveTab("events")}
          type="button"
        >
          사건
        </button>
        <button
          className={activeTab === "ledger" ? "life-calendar-switch__item life-calendar-switch__item--active" : "life-calendar-switch__item"}
          onClick={() => setActiveTab("ledger")}
          type="button"
        >
          가계부
        </button>
      </div>

      {activeTab === "events" ? <CalendarView allowedTypes={["schedule", "event", "todo"]} showEventAddButton title="라이프 캘린더" /> : <LedgerView />}
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
          <p>장소가 연결된 일정과 할 일을 모아서 어디에서 무엇이 있었는지 확인합니다.</p>
        </div>
      </section>

      <section className="life-map-coverage" aria-label="장소축 연결 상태">
        <article>
          <span>장소 연결됨</span>
          <strong>{timelineItems.length}건</strong>
          <p>일정, 이벤트, 할 일</p>
        </article>
        <article>
          <span>장소 연결 필요</span>
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
      meta: formatTimelineMeta(formatEventTimeRange(event.time, event.endTime, event.isAllDay), event.companions, event.expenseAmount, event.meta),
      place: event.place as PlanPlace,
    }));

  const taskItems: PlaceTimelineItem[] = tasks
    .filter((task) => Boolean(task.place))
    .map((task) => ({
      id: task.id,
      date: task.scheduledDate,
      kind: "task",
      title: task.title,
      meta: formatTimelineMeta(formatEventTimeRange(task.startTime, task.endTime, task.isAllDay), task.companions, task.expenseAmount, task.memo ?? task.status),
      place: task.place as PlanPlace,
    }));

  return [...eventItems, ...taskItems].sort((a, b) => b.date.localeCompare(a.date));
}

function formatEventTimeRange(startTime?: string, endTime?: string, isAllDay = true) {
  if (isAllDay) return "하루종일";
  if (startTime && endTime) return `${startTime}-${endTime}`;
  return startTime;
}

function formatTimelineMeta(timeLabel?: string, companions?: string, expenseAmount?: number, memo?: string) {
  return [timeLabel, companions, expenseAmount !== undefined ? `${new Intl.NumberFormat("ko-KR").format(expenseAmount)}원` : undefined, memo].filter(Boolean).join(" · ");
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
