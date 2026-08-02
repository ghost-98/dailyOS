"use client";

import { Activity, CalendarDays, Camera, CheckCircle2, Clock3, Dumbbell, MapPin, NotebookPen, Plus, Sparkles, WalletCards } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useDailyOSUser } from "@/components/auth/AuthGate";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import { fetchCalendarEventsFromDb } from "@/features/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";
import { fetchWeightRecordsFromDb, fetchWorkoutSessionsFromDb } from "@/features/health/api";
import { fetchDailyLogsFromDb, fetchLifeActivitiesFromDb, fetchLifePhotosFromDb } from "@/features/life/api";
import { fetchExpenseRecordsFromDb } from "@/features/ledger/api";
import { fetchTasksFromDb } from "@/features/tasks/api";
import type { DailyLogRecord, ExpenseRecord, LifeActivityRecord, LifePhotoRecord, PlanPlace, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

type TimelineKind = "schedule" | "task" | "event" | "activity" | "log" | "photo" | "expense" | "workout" | "weight";

type TimelineItem = {
  id: string;
  title: string;
  description: string;
  timeLabel: string;
  tone: "violet" | "green" | "pink" | "amber" | "muted";
  kind: TimelineKind;
};

const text = {
  commandCenter: "오늘의 기록 허브",
  heroSuffix: "님의 오늘 기록 흐름",
  openCalendar: "활동 기록하기",
  loading: "로딩",
  count: "개",
  won: "원",
  todayDensity: "오늘 기록 밀도",
  todoProgress: "할 일 진행률",
  todayExpense: "오늘 지출",
  todayPlace: "오늘 장소",
  logs: "기록",
  media: "미디어",
  done: "완료",
  left: "남음",
  thisMonth: "이번 달",
  places: "곳",
  connectPlace: "활동이나 계획에 장소를 연결해보세요",
  todayTimeline: "오늘 활동 타임라인",
  noTimeline: "오늘 아직 연결된 활동, 계획, 기록, 사진이 없습니다.",
  dailyLog: "하루 기록",
  noDailyLog: "짧은 하루 기록을 남기면 이곳에 바로 쌓입니다.",
  photoVideo: "사진·영상",
  noPhoto: "오늘의 사진이나 영상을 올리면 메타데이터와 함께 보입니다.",
  todayPlaces: "오늘 간 장소",
  noPlaces: "일정이나 할 일, 활동에 장소를 연결하면 자동으로 모입니다.",
  ledger: "가계부",
  todayUsed: "오늘 사용",
  noLedger: "활동이나 계획에서 지출이 생기면 자동으로 집계합니다.",
  health: "운동·몸 상태",
  todayWorkout: "오늘 운동",
  noWorkout: "기록 없음",
  workoutHint: "운동 기록을 남기면 오늘 흐름에 함께 보입니다.",
  latestWeight: "최근 체중",
  weightHint: "몸 데이터도 삶의 패턴 축으로 붙일 수 있어요.",
  basedOn: "기준",
  open: "열기",
  goRecord: "기록하러 가기",
  allDay: "하루종일",
  unknownTime: "시간 미정",
  unknownSize: "용량 미기록",
  noDetail: "상세 없음",
  scheduleDetail: "일정 상세 없음",
  eventDetail: "이벤트 상세 없음",
  fasted: "공복 측정",
};

const kindLabel: Record<TimelineKind, string> = {
  schedule: "일정",
  task: "할 일",
  event: "이벤트",
  activity: "활동",
  log: "기록",
  photo: "사진",
  expense: "지출",
  workout: "운동",
  weight: "체중",
};

const priorityLabel = {
  high: "\uB192\uC74C",
  normal: "\uBCF4\uD1B5",
  low: "\uB0AE\uC74C",
};

const priorityTone = {
  high: "pink",
  normal: "amber",
  low: "muted",
} as const;

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

const shortDateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
});

const currencyFormatter = new Intl.NumberFormat("ko-KR");

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatCurrency(amount: number) {
  return `${currencyFormatter.format(amount)}${text.won}`;
}

function formatEventTime(event: CalendarEvent) {
  if (event.isAllDay) return text.allDay;
  if (event.time && event.endTime) return `${event.time}-${event.endTime}`;
  return event.time ?? text.unknownTime;
}

function formatTaskTime(task: TaskItem) {
  if (task.isAllDay) return text.allDay;
  if (task.startTime && task.endTime) return `${task.startTime}-${task.endTime}`;
  return task.startTime ?? text.unknownTime;
}

function formatActivityTime(activity: LifeActivityRecord) {
  if (activity.isAllDay || !activity.startTime) return text.unknownTime;
  if (activity.startTime && activity.endTime) return `${activity.startTime}-${activity.endTime}`;
  return activity.startTime;
}

function getTimelineSortMinutes(timeLabel: string, kind: TimelineKind) {
  const [hours, minutes] = timeLabel.slice(0, 5).split(":").map(Number);
  if (Number.isFinite(hours) && Number.isFinite(minutes)) return hours * 60 + minutes;
  const fallbackOrder: Record<TimelineKind, number> = {
    schedule: 0,
    task: 1,
    event: 2,
    activity: 3,
    log: 4,
    photo: 5,
    expense: 6,
    workout: 7,
    weight: 8,
  };
  return 24 * 60 + fallbackOrder[kind];
}

function formatFileSize(sizeBytes?: number) {
  if (!sizeBytes) return text.unknownSize;
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)}KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(1)}MB`;
}

function isDateInRange(date: string, startDate: string, endDate?: string) {
  const normalizedEndDate = endDate || startDate;
  return startDate <= date && date <= normalizedEndDate;
}

function getPlaceKey(place: PlanPlace) {
  return `${place.name}-${place.address}`;
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
  const [activities, setActivities] = useState<LifeActivityRecord[]>([]);
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLogRecord[]>([]);
  const [lifePhotos, setLifePhotos] = useState<LifePhotoRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([
      safeLoad(fetchCalendarEventsFromDb, [] as CalendarEvent[]),
      safeLoad(fetchTasksFromDb, [] as TaskItem[]),
      safeLoad(fetchExpenseRecordsFromDb, [] as ExpenseRecord[]),
      safeLoad(fetchLifeActivitiesFromDb, [] as LifeActivityRecord[]),
      safeLoad(fetchWeightRecordsFromDb, [] as WeightRecord[]),
      safeLoad(fetchWorkoutSessionsFromDb, [] as WorkoutSession[]),
      safeLoad(fetchDailyLogsFromDb, [] as DailyLogRecord[]),
      safeLoad(() => fetchLifePhotosFromDb(todayKey), [] as LifePhotoRecord[]),
    ]).then(([nextEvents, nextTasks, nextExpenses, nextActivities, nextWeights, nextWorkouts, nextDailyLogs, nextLifePhotos]) => {
      if (!isMounted) return;
      setEvents(nextEvents);
      setTasks(nextTasks);
      setExpenses(nextExpenses);
      setActivities(nextActivities);
      setWeights(nextWeights);
      setWorkouts(nextWorkouts);
      setDailyLogs(nextDailyLogs);
      setLifePhotos(nextLifePhotos);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [todayKey]);

  const todaySchedules = events.filter((event) => isDateInRange(todayKey, event.date, event.endDate) && event.type === "schedule");
  const todayEvents = events.filter((event) => isDateInRange(todayKey, event.date, event.endDate) && event.type === "event");
  const todayTasks = tasks.filter((task) => isDateInRange(todayKey, task.scheduledDate, task.dueDate));
  const todayActivities = activities.filter((activity) => activity.date === todayKey);
  const openTasks = todayTasks.filter((task) => task.status !== "done");
  const completedCount = todayTasks.filter((task) => task.status === "done").length;
  const completionRate = todayTasks.length > 0 ? Math.round((completedCount / todayTasks.length) * 100) : 0;
  const todayExpenses = expenses.filter((expense) => expense.date === todayKey);
  const todayExpenseTotal = todayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const monthExpenseTotal = expenses.filter((expense) => expense.date.startsWith(monthKey)).reduce((sum, expense) => sum + expense.amount, 0);
  const todayWorkouts = workouts.filter((workout) => workout.date === todayKey);
  const workoutMinutes = todayWorkouts.reduce((sum, workout) => sum + workout.durationMinutes, 0);
  const todayLogs = dailyLogs.filter((log) => log.date === todayKey);
  const todayPhotos = lifePhotos.filter((photo) => photo.date === todayKey);
  const latestWeight = weights.find((weight) => weight.date <= todayKey) ?? weights[0];
  const monthLogs = dailyLogs.filter((log) => log.date.startsWith(monthKey));
  const monthPhotos = lifePhotos.filter((photo) => photo.date.startsWith(monthKey));

  const places = [
    ...todaySchedules.flatMap((event) => (event.place ? [event.place] : [])),
    ...todayEvents.flatMap((event) => (event.place ? [event.place] : [])),
    ...todayTasks.flatMap((task) => (task.place ? [task.place] : [])),
    ...todayActivities.flatMap((activity) =>
      activity.placeName
        ? [
            {
              address: activity.placeAddress ?? "",
              category: undefined,
              latitude: 0,
              longitude: 0,
              name: activity.placeName,
            } satisfies PlanPlace,
          ]
        : [],
    ),
  ].filter((place, index, list) => list.findIndex((candidate) => getPlaceKey(candidate) === getPlaceKey(place)) === index);

  const timelineItems = [
    ...todaySchedules.map<TimelineItem>((event) => ({
      id: `schedule-${event.id}`,
      title: event.title,
      description: event.place?.name ?? event.meta ?? text.scheduleDetail,
      timeLabel: formatEventTime(event),
      tone: "violet",
      kind: "schedule",
    })),
    ...todayTasks.map<TimelineItem>((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      description: task.place?.name ?? task.memo ?? priorityLabel[task.priority],
      timeLabel: formatTaskTime(task),
      tone: task.status === "done" ? "green" : priorityTone[task.priority],
      kind: "task",
    })),
    ...todayEvents.map<TimelineItem>((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      description: event.place?.name ?? event.meta ?? text.eventDetail,
      timeLabel: formatEventTime(event),
      tone: "pink",
      kind: "event",
    })),
    ...todayActivities.map<TimelineItem>((activity) => ({
      id: `activity-${activity.id}`,
      title: activity.title,
      description: [activity.placeName, activity.food ? `음식 · ${activity.food}` : null, activity.companions ? `함께 · ${activity.companions}` : null, activity.expenseAmount ? formatCurrency(activity.expenseAmount) : null].filter(Boolean).join(" · ") || activity.memo || "실제 활동",
      timeLabel: formatActivityTime(activity),
      tone: "amber",
      kind: "activity",
    })),
    ...todayLogs.map<TimelineItem>((log) => ({
      id: `log-${log.id}`,
      title: log.content.slice(0, 34),
      description: text.dailyLog,
      timeLabel: log.createdAt ? new Date(log.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : text.logs,
      tone: "green",
      kind: "log",
    })),
    ...todayPhotos.map<TimelineItem>((photo) => ({
      id: `photo-${photo.id}`,
      title: photo.caption || photo.fileName,
      description: `${photo.width && photo.height ? `${photo.width}\u00D7${photo.height} · ` : ""}${formatFileSize(photo.sizeBytes)}`,
      timeLabel: photo.takenAt ? new Date(photo.takenAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : kindLabel.photo,
      tone: "amber",
      kind: "photo",
    })),
    ...todayExpenses.map<TimelineItem>((expense) => ({
      id: `expense-${expense.id}`,
      title: expense.title,
      description: formatCurrency(expense.amount),
      timeLabel: kindLabel.expense,
      tone: "muted",
      kind: "expense",
    })),
    ...todayWorkouts.map<TimelineItem>((workout) => ({
      id: `workout-${workout.id}`,
      title: workout.type,
      description: `${workout.durationMinutes}\uBD84 · ${workout.condition}`,
      timeLabel: kindLabel.workout,
      tone: "green",
      kind: "workout",
    })),
    ...(latestWeight?.date === todayKey
      ? [
          {
            id: `weight-${latestWeight.id}`,
            title: `${latestWeight.weightKg}kg`,
            description: latestWeight.measuredFasted ? text.fasted : latestWeight.memo ?? kindLabel.weight,
            timeLabel: kindLabel.weight,
            tone: "green",
            kind: "weight",
          } satisfies TimelineItem,
        ]
      : []),
  ].sort((left, right) => getTimelineSortMinutes(left.timeLabel, left.kind) - getTimelineSortMinutes(right.timeLabel, right.kind));

  const lifeScore = todaySchedules.length + todayEvents.length + todayTasks.length + todayActivities.length + todayLogs.length + todayPhotos.length + todayExpenses.length + todayWorkouts.length;
  const plannedBlocks = todaySchedules.length + todayEvents.length + todayTasks.length;
  const evidenceBlocks = todayActivities.length + todayLogs.length + todayPhotos.length + todayWorkouts.length;
  const coverageLabel = plannedBlocks === 0 ? "계획 없음" : `${Math.min(100, Math.round((evidenceBlocks / Math.max(plannedBlocks, 1)) * 100))}%`;
  const missingSignals = [
    todayActivities.length === 0 ? "실제 활동" : null,
    todayLogs.length === 0 ? "하루기록" : null,
    todayPhotos.length === 0 ? "사진" : null,
    todayWorkouts.length === 0 ? "건강" : null,
  ].filter(Boolean);

  return (
    <div className="today today--compact">
      <header className="today__header page-header today-dashboard-hero">
        <div>
          <p className="eyebrow">{text.commandCenter}</p>
          <h1>
            {displayName}
            {text.heroSuffix}
          </h1>
          <div className="today__date">
            <CalendarDays aria-hidden size={20} />
            <span>{todayLabel}</span>
          </div>
        </div>
        <Link className="header-action" href="/life/activities">
          {text.openCalendar}
        </Link>
      </header>

      <div className="today-summary-grid today-signal-grid">
        <SignalCard icon={<Activity aria-hidden size={20} />} label="오늘 복원도" value={coverageLabel} note={missingSignals.length > 0 ? `빠진 기록 · ${missingSignals.join(", ")}` : "오늘의 근거 기록이 균형 있게 쌓였어요"} />
        <SignalCard icon={<Sparkles aria-hidden size={20} />} label={text.todayDensity} value={isLoading ? text.loading : `${lifeScore}${text.count}`} note={`활동 ${todayActivities.length}${text.count} · ${todayLogs.length}${text.count} ${text.logs} · ${todayPhotos.length}${text.count} ${text.media}`} />
        <SignalCard icon={<CheckCircle2 aria-hidden size={20} />} label={text.todoProgress} value={`${completionRate}%`} note={`${completedCount}${text.count} ${text.done} · ${openTasks.length}${text.count} ${text.left}`} />
        <SignalCard icon={<WalletCards aria-hidden size={20} />} label={text.todayExpense} value={todayExpenseTotal > 0 ? formatCurrency(todayExpenseTotal) : formatCurrency(0)} note={`${text.thisMonth} ${formatCurrency(monthExpenseTotal)}`} />
        <SignalCard icon={<MapPin aria-hidden size={20} />} label={text.todayPlace} value={`${places.length}${text.places}`} note={places[0]?.name ?? text.connectPlace} />
      </div>

      <section className="today-quick-actions" aria-label="오늘 빠른 입력">
        <QuickAction href="/life/activities" icon={<Activity aria-hidden size={18} />} label="활동 기록" note="몇 시부터 어디서 뭘 했는지" />
        <QuickAction href="/life/calendar" icon={<CalendarDays aria-hidden size={18} />} label="계획 입력" note="일정·할일·이벤트" />
        <QuickAction href="/life/logs" icon={<NotebookPen aria-hidden size={18} />} label="하루기록" note="짧은 감상과 맥락" />
        <QuickAction href="/life/photos" icon={<Camera aria-hidden size={18} />} label="사진 추가" note="사건/활동의 증거" />
        <QuickAction href="/life/health" icon={<Dumbbell aria-hidden size={18} />} label="건강 기록" note="러닝·몸무게" />
      </section>

      <div className="today-work-grid today-life-grid">
        <SectionCard className="schedule-card today-command-card today-timeline-card">
          <DashboardHeader href="/life/activities" icon={<Clock3 aria-hidden size={20} />} title={text.todayTimeline} trailing={`${timelineItems.length}${text.count}`} />
          <div className="today-life-timeline">
            {timelineItems.length > 0 ? (
              timelineItems.slice(0, 9).map((item) => (
                <article className="today-life-timeline__item" key={item.id}>
                  <span className={`today-life-timeline__dot today-life-timeline__dot--${item.tone}`} />
                  <div>
                    <div className="today-life-timeline__meta">
                      <span>{item.timeLabel}</span>
                      <Badge tone={item.tone}>{kindLabel[item.kind]}</Badge>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                </article>
              ))
            ) : (
              <EmptyBlock href="/life/activities" text="오늘을 복원하려면 실제 활동부터 하나 남겨보세요." />
            )}
          </div>
        </SectionCard>

        <div className="today-side-grid">
          <SectionCard className="schedule-card today-command-card">
            <DashboardHeader href="/life/logs" icon={<NotebookPen aria-hidden size={20} />} title={text.dailyLog} trailing={`${text.thisMonth} ${monthLogs.length}${text.count}`} />
            <div className="today-log-stack">
              {todayLogs.length > 0 ? (
                todayLogs.slice(0, 3).map((log) => (
                  <article className="today-log-snippet" key={log.id}>
                    <p>{log.content}</p>
                    <span>{log.createdAt ? new Date(log.createdAt).toLocaleString("ko-KR") : shortDateFormatter.format(new Date(`${log.date}T00:00:00`))}</span>
                  </article>
                ))
              ) : (
                <EmptyBlock href="/life/logs" text={text.noDailyLog} />
              )}
            </div>
          </SectionCard>

          <SectionCard className="schedule-card today-command-card">
            <DashboardHeader href="/life/photos" icon={<Camera aria-hidden size={20} />} title={text.photoVideo} trailing={`${text.thisMonth} ${monthPhotos.length}${text.count}`} />
            {todayPhotos.length > 0 ? (
              <div className="today-photo-strip">
                {todayPhotos.slice(0, 4).map((photo) => (
                  <figure className="today-photo-thumb" key={photo.id}>
                    {photo.fileUrl ? <Image alt={photo.caption || photo.fileName} fill sizes="110px" src={photo.fileUrl} /> : <Camera aria-hidden size={24} />}
                  </figure>
                ))}
              </div>
            ) : (
              <EmptyBlock href="/life/photos" text={text.noPhoto} />
            )}
          </SectionCard>
        </div>
      </div>

      <div className="today-support-grid">
        <SectionCard className="schedule-card today-command-card">
          <DashboardHeader href="/life/places-flow" icon={<MapPin aria-hidden size={20} />} title={text.todayPlaces} trailing={`${places.length}${text.places}`} />
          <div className="today-place-list">
            {places.length > 0 ? (
              places.slice(0, 5).map((place) => (
                <article className="today-place-item" key={getPlaceKey(place)}>
                  <strong>{place.name}</strong>
                  <p>{place.address || place.category || text.noDetail}</p>
                </article>
              ))
            ) : (
              <EmptyBlock href="/life/places-flow" text={text.noPlaces} />
            )}
          </div>
        </SectionCard>

        <SectionCard className="schedule-card today-command-card">
          <DashboardHeader href="/ledger" icon={<WalletCards aria-hidden size={20} />} title={text.ledger} trailing={`${todayExpenses.length}\uAC74`} />
          <div className="today-ledger-total">
            <span>{text.todayUsed}</span>
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
              <EmptyBlock href="/life/calendar" text={text.noLedger} />
            )}
          </div>
        </SectionCard>

        <SectionCard className="vitals-card today-command-card today-health-card">
          <DashboardHeader href="/life/health" icon={<Dumbbell aria-hidden size={20} />} title={text.health} />
          <div className="today-health-grid">
            <div className="workout-plan">
              <Dumbbell aria-hidden size={18} />
              <div>
                <span>{text.todayWorkout}</span>
                <strong>{todayWorkouts.length > 0 ? `${todayWorkouts.length}\uAC74 · ${workoutMinutes}\uBD84` : text.noWorkout}</strong>
                <small>{todayWorkouts[0]?.memo ?? todayWorkouts[0]?.type ?? text.workoutHint}</small>
              </div>
            </div>
            <div className="workout-plan workout-plan--weight">
              <Sparkles aria-hidden size={18} />
              <div>
                <span>{text.latestWeight}</span>
                <strong>{latestWeight ? `${latestWeight.weightKg}kg` : text.noWorkout}</strong>
                <small>{latestWeight ? `${shortDateFormatter.format(new Date(`${latestWeight.date}T00:00:00`))} ${text.basedOn}` : text.weightHint}</small>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function SignalCard({ icon, label, note, value }: { icon: ReactNode; label: string; note: string; value: string }) {
  return (
    <SectionCard className="today-focus-card today-signal-card">
      <span className="today-signal-card__icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </SectionCard>
  );
}

function QuickAction({ href, icon, label, note }: { href: string; icon: ReactNode; label: string; note: string }) {
  return (
    <Link className="today-quick-action" href={href}>
      <span>
        {icon}
        <Plus aria-hidden size={14} />
      </span>
      <strong>{label}</strong>
      <p>{note}</p>
    </Link>
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
          {text.open}
        </Link>
      </div>
    </div>
  );
}

function EmptyBlock({ href, text: message }: { href: string; text: string }) {
  return (
    <div className="today-empty-block">
      <p>{message}</p>
      <Link className="empty-dashboard-link" href={href}>
        {text.goRecord}
      </Link>
    </div>
  );
}
