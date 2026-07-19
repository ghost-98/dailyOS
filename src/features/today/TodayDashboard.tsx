"use client";

import { CalendarDays, Camera, CheckCircle2, Clock3, Dumbbell, MapPin, NotebookPen, Sparkles, WalletCards } from "lucide-react";
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
import { fetchDailyLogsFromDb, fetchLifePhotosFromDb } from "@/features/life/api";
import { fetchExpenseRecordsFromDb } from "@/features/ledger/api";
import { fetchTasksFromDb } from "@/features/tasks/api";
import type { DailyLogRecord, ExpenseRecord, LifePhotoRecord, PlanPlace, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

type TimelineKind = "schedule" | "task" | "event" | "log" | "photo" | "expense" | "workout" | "weight";

type TimelineItem = {
  id: string;
  title: string;
  description: string;
  timeLabel: string;
  tone: "violet" | "green" | "pink" | "amber" | "muted";
  kind: TimelineKind;
};

const text = {
  commandCenter: "Life OS Command Center",
  heroSuffix: "\uB2D8\uC758 \uC624\uB298\uC744 \uD55C \uC7A5\uC73C\uB85C",
  openCalendar: "\uB77C\uC774\uD504 \uCEA8\uB9B0\uB354 \uC5F4\uAE30",
  loading: "\uB85C\uB529",
  count: "\uAC1C",
  won: "\uC6D0",
  todayDensity: "\uC624\uB298 \uAE30\uB85D \uBC00\uB3C4",
  todoProgress: "\uD560 \uC77C \uC9C4\uD589\uB960",
  todayExpense: "\uC624\uB298 \uC9C0\uCD9C",
  todayPlace: "\uC624\uB298 \uC7A5\uC18C",
  logs: "\uAE30\uB85D",
  media: "\uBBF8\uB514\uC5B4",
  done: "\uC644\uB8CC",
  left: "\uB0A8\uC74C",
  thisMonth: "\uC774\uBC88 \uB2EC",
  places: "\uACF3",
  connectPlace: "\uC77C\uC815/\uD560 \uC77C\uC5D0 \uC7A5\uC18C\uB97C \uC5F0\uACB0\uD574\uBCF4\uC138\uC694",
  todayTimeline: "\uC624\uB298 \uD0C0\uC784\uB77C\uC778",
  noTimeline: "\uC624\uB298 \uC544\uC9C1 \uC5F0\uACB0\uB41C \uC77C\uC815, \uAE30\uB85D, \uC0AC\uC9C4\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.",
  dailyLog: "\uD558\uB8E8 \uAE30\uB85D",
  noDailyLog: "\uC9E7\uC740 \uD558\uB8E8 \uAE30\uB85D\uC744 \uB0A8\uAE30\uBA74 \uC774\uACF3\uC5D0 \uBC14\uB85C \uC313\uC785\uB2C8\uB2E4.",
  photoVideo: "\uC0AC\uC9C4\u00B7\uC601\uC0C1",
  noPhoto: "\uC624\uB298\uC758 \uC0AC\uC9C4\uC774\uB098 \uC601\uC0C1\uC744 \uC62C\uB9AC\uBA74 \uBA54\uD0C0\uB370\uC774\uD130\uC640 \uD568\uAED8 \uBCF4\uC785\uB2C8\uB2E4.",
  todayPlaces: "\uC624\uB298 \uAC04 \uC7A5\uC18C",
  noPlaces: "\uC77C\uC815\uC774\uB098 \uD560 \uC77C\uC5D0 \uC7A5\uC18C\uB97C \uC5F0\uACB0\uD558\uBA74 \uC790\uB3D9\uC73C\uB85C \uBAA8\uC785\uB2C8\uB2E4.",
  ledger: "\uAC00\uACC4\uBD80",
  todayUsed: "\uC624\uB298 \uC0AC\uC6A9",
  noLedger: "\uC77C\uC815/\uD560 \uC77C\uC758 \uC9C0\uCD9C\uC774 \uC0DD\uAE30\uBA74 \uC790\uB3D9\uC73C\uB85C \uC9D1\uACC4\uB429\uB2C8\uB2E4.",
  health: "\uC6B4\uB3D9\u00B7\uBAB8 \uC0C1\uD0DC",
  todayWorkout: "\uC624\uB298 \uC6B4\uB3D9",
  noWorkout: "\uAE30\uB85D \uC5C6\uC74C",
  workoutHint: "\uC6B4\uB3D9 \uAE30\uB85D\uC744 \uB0A8\uAE30\uBA74 \uC624\uB298 \uD750\uB984\uC5D0 \uD568\uAED8 \uBCF4\uC785\uB2C8\uB2E4.",
  latestWeight: "\uCD5C\uADFC \uCCB4\uC911",
  weightHint: "\uBAB8 \uB370\uC774\uD130\uB3C4 \uC0B6\uC758 \uD328\uD134 \uCD95\uC73C\uB85C \uBD99\uC77C \uC218 \uC788\uC5B4\uC694.",
  basedOn: "\uAE30\uC900",
  open: "\uC5F4\uAE30",
  goRecord: "\uAE30\uB85D\uD558\uB7EC \uAC00\uAE30",
  allDay: "\uD558\uB8E8\uC885\uC77C",
  unknownTime: "\uC2DC\uAC04 \uBBF8\uC815",
  unknownSize: "\uC6A9\uB7C9 \uBBF8\uAE30\uB85D",
  noDetail: "\uC0C1\uC138 \uC5C6\uC74C",
  scheduleDetail: "\uC77C\uC815 \uC0C1\uC138 \uC5C6\uC74C",
  eventDetail: "\uC774\uBCA4\uD2B8 \uC0C1\uC138 \uC5C6\uC74C",
  fasted: "\uACF5\uBCF5 \uCE21\uC815",
};

const kindLabel: Record<TimelineKind, string> = {
  schedule: "\uC77C\uC815",
  task: "\uD560 \uC77C",
  event: "\uC774\uBCA4\uD2B8",
  log: "\uAE30\uB85D",
  photo: "\uC0AC\uC9C4",
  expense: "\uC9C0\uCD9C",
  workout: "\uC6B4\uB3D9",
  weight: "\uCCB4\uC911",
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
      safeLoad(fetchWeightRecordsFromDb, [] as WeightRecord[]),
      safeLoad(fetchWorkoutSessionsFromDb, [] as WorkoutSession[]),
      safeLoad(fetchDailyLogsFromDb, [] as DailyLogRecord[]),
      safeLoad(fetchLifePhotosFromDb, [] as LifePhotoRecord[]),
    ]).then(([nextEvents, nextTasks, nextExpenses, nextWeights, nextWorkouts, nextDailyLogs, nextLifePhotos]) => {
      if (!isMounted) return;
      setEvents(nextEvents);
      setTasks(nextTasks);
      setExpenses(nextExpenses);
      setWeights(nextWeights);
      setWorkouts(nextWorkouts);
      setDailyLogs(nextDailyLogs);
      setLifePhotos(nextLifePhotos);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const todaySchedules = events.filter((event) => isDateInRange(todayKey, event.date, event.endDate) && event.type === "schedule");
  const todayEvents = events.filter((event) => isDateInRange(todayKey, event.date, event.endDate) && event.type === "event");
  const todayTasks = tasks.filter((task) => isDateInRange(todayKey, task.scheduledDate, task.dueDate));
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
  ];

  const lifeScore = todaySchedules.length + todayEvents.length + todayTasks.length + todayLogs.length + todayPhotos.length + todayExpenses.length + todayWorkouts.length;

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
        <Link className="header-action" href="/life/calendar">
          {text.openCalendar}
        </Link>
      </header>

      <div className="today-summary-grid today-signal-grid">
        <SignalCard icon={<Sparkles aria-hidden size={20} />} label={text.todayDensity} value={isLoading ? text.loading : `${lifeScore}${text.count}`} note={`${todayLogs.length}${text.count} ${text.logs} · ${todayPhotos.length}${text.count} ${text.media}`} />
        <SignalCard icon={<CheckCircle2 aria-hidden size={20} />} label={text.todoProgress} value={`${completionRate}%`} note={`${completedCount}${text.count} ${text.done} · ${openTasks.length}${text.count} ${text.left}`} />
        <SignalCard icon={<WalletCards aria-hidden size={20} />} label={text.todayExpense} value={todayExpenseTotal > 0 ? formatCurrency(todayExpenseTotal) : formatCurrency(0)} note={`${text.thisMonth} ${formatCurrency(monthExpenseTotal)}`} />
        <SignalCard icon={<MapPin aria-hidden size={20} />} label={text.todayPlace} value={`${places.length}${text.places}`} note={places[0]?.name ?? text.connectPlace} />
      </div>

      <div className="today-work-grid today-life-grid">
        <SectionCard className="schedule-card today-command-card today-timeline-card">
          <DashboardHeader href="/life/calendar" icon={<Clock3 aria-hidden size={20} />} title={text.todayTimeline} trailing={`${timelineItems.length}${text.count}`} />
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
              <EmptyBlock href="/life/calendar" text={text.noTimeline} />
            )}
          </div>
        </SectionCard>

        <div className="today-side-grid">
          <SectionCard className="schedule-card today-command-card">
            <DashboardHeader href="/life/calendar" icon={<NotebookPen aria-hidden size={20} />} title={text.dailyLog} trailing={`${text.thisMonth} ${monthLogs.length}${text.count}`} />
            <div className="today-log-stack">
              {todayLogs.length > 0 ? (
                todayLogs.slice(0, 3).map((log) => (
                  <article className="today-log-snippet" key={log.id}>
                    <p>{log.content}</p>
                    <span>{log.createdAt ? new Date(log.createdAt).toLocaleString("ko-KR") : shortDateFormatter.format(new Date(`${log.date}T00:00:00`))}</span>
                  </article>
                ))
              ) : (
                <EmptyBlock href="/life/calendar" text={text.noDailyLog} />
              )}
            </div>
          </SectionCard>

          <SectionCard className="schedule-card today-command-card">
            <DashboardHeader href="/life/calendar" icon={<Camera aria-hidden size={20} />} title={text.photoVideo} trailing={`${text.thisMonth} ${monthPhotos.length}${text.count}`} />
            {todayPhotos.length > 0 ? (
              <div className="today-photo-strip">
                {todayPhotos.slice(0, 4).map((photo) => (
                  <figure className="today-photo-thumb" key={photo.id}>
                    {photo.fileUrl ? <Image alt={photo.caption || photo.fileName} fill sizes="110px" src={photo.fileUrl} /> : <Camera aria-hidden size={24} />}
                  </figure>
                ))}
              </div>
            ) : (
              <EmptyBlock href="/life/calendar" text={text.noPhoto} />
            )}
          </SectionCard>
        </div>
      </div>

      <div className="today-support-grid">
        <SectionCard className="schedule-card today-command-card">
          <DashboardHeader href="/life/calendar" icon={<MapPin aria-hidden size={20} />} title={text.todayPlaces} trailing={`${places.length}${text.places}`} />
          <div className="today-place-list">
            {places.length > 0 ? (
              places.slice(0, 5).map((place) => (
                <article className="today-place-item" key={getPlaceKey(place)}>
                  <strong>{place.name}</strong>
                  <p>{place.address || place.category || text.noDetail}</p>
                </article>
              ))
            ) : (
              <EmptyBlock href="/life/calendar" text={text.noPlaces} />
            )}
          </div>
        </SectionCard>

        <SectionCard className="schedule-card today-command-card">
          <DashboardHeader href="/life/calendar" icon={<WalletCards aria-hidden size={20} />} title={text.ledger} trailing={`${todayExpenses.length}\uAC74`} />
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
          <DashboardHeader href="/life/calendar" icon={<Dumbbell aria-hidden size={20} />} title={text.health} />
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
