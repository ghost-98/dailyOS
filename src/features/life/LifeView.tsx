"use client";

import Image from "next/image";
import { Activity, ChevronLeft, ChevronRight, ImagePlus, MapPin, NotebookPen, Scale, Search, X } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { fetchCalendarEventsFromDb } from "@/features/calendar/api";
import { CalendarView, ExternalCalendarItem, MonthPickerSheet, SelectedDatePlacesMap } from "@/features/calendar/CalendarView";
import type { CalendarEvent } from "@/features/calendar/data";
import {
  createWeightRecordInDb,
  createWorkoutSessionInDb,
  deleteWeightRecordFromDb,
  deleteWorkoutSessionFromDb,
  fetchWeightRecordsFromDb,
  fetchWorkoutSessionsFromDb,
  updateWeightRecordInDb,
  updateWorkoutSessionInDb,
} from "@/features/health/api";
import { fetchExpenseRecordsFromDb } from "@/features/ledger/api";
import { LedgerView } from "@/features/ledger/LedgerView";
import { createDailyLogInDb, deleteDailyLogFromDb, deleteLifePhotoFromDb, fetchDailyLogsFromDb, fetchLifePhotosFromDb, updateDailyLogInDb, uploadLifePhotosToDb } from "@/features/life/api";
import { fetchTasksFromDb } from "@/features/tasks/api";
import type { DailyLogRecord, ExpenseRecord, LifeMediaUploadInput, LifePhotoRecord, PlanPlace, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

export type LifeViewMode = "calendar" | "map";

type LifeViewProps = {
  mode: LifeViewMode;
};

type LifeCalendarTab = "events" | "report" | "monthly" | "search" | "places" | "ledger" | "logs" | "photos" | "health";

type PlaceTimelineItem = {
  date: string;
  id: string;
  kind: "schedule" | "task" | "event";
  meta: string;
  place: PlanPlace;
  title: string;
};

type LifeMediaPreview = LifeMediaUploadInput & {
  id: string;
  name: string;
  objectUrl: string;
  mimeType: string;
  sizeBytes: number;
  lastModified: number;
};

const kindLabels: Record<PlaceTimelineItem["kind"], string> = {
  schedule: "일정",
  task: "할 일",
  event: "이벤트",
};

type LifeContextBundle = {
  expenses: ExpenseRecord[];
  key: string;
  label: string;
  logs: DailyLogRecord[];
  meta?: string;
  photos: LifePhotoRecord[];
  place?: PlanPlace;
  title: string;
};

type LifeSearchItem = {
  date: string;
  description: string;
  id: string;
  label: string;
  tags: string[];
  title: string;
  type: "schedule" | "todo" | "event" | "expense" | "daily_log" | "photo" | "workout" | "weight";
};

export function LifeView({ mode }: LifeViewProps) {
  return <div className="life-page">{mode === "calendar" ? <LifeCalendarView /> : <LifeMapView />}</div>;
}

const lifeTabs: Array<{ key: LifeCalendarTab; label: string }> = [
  { key: "events", label: "캘린더" },
  { key: "report", label: "하루 리포트" },
  { key: "monthly", label: "월간 회고" },
  { key: "search", label: "전체 검색" },
  { key: "places", label: "장소" },
  { key: "ledger", label: "가계부" },
  { key: "logs", label: "하루기록" },
  { key: "photos", label: "사진" },
  { key: "health", label: "건강" },
];

function LifeCalendarView() {
  const [activeTab, setActiveTab] = useState<LifeCalendarTab>("events");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLogRecord[]>([]);
  const [lifePhotos, setLifePhotos] = useState<LifePhotoRecord[]>([]);
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [isLifeDataLoading, setIsLifeDataLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchCalendarEventsFromDb(), fetchTasksFromDb(), fetchExpenseRecordsFromDb(), fetchDailyLogsFromDb(), fetchLifePhotosFromDb(), fetchWeightRecordsFromDb(), fetchWorkoutSessionsFromDb()])
      .then(([nextEvents, nextTasks, nextExpenses, logs, photos, nextWeights, nextWorkouts]) => {
        if (!isMounted) return;
        setEvents(nextEvents ?? []);
        setTasks(nextTasks ?? []);
        setExpenses(nextExpenses ?? []);
        setDailyLogs(logs ?? []);
        setLifePhotos(photos ?? []);
        setWeights(nextWeights ?? []);
        setWorkouts(nextWorkouts ?? []);
      })
      .catch((error) => console.error("Failed to load life capture data from Supabase", error))
      .finally(() => {
        if (isMounted) setIsLifeDataLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const externalItems = useMemo<ExternalCalendarItem[]>(
    () => [
      ...dailyLogs.map((log) => ({
        date: log.date,
        id: log.id,
        meta: log.content.slice(0, 42),
        title: "하루 기록",
        type: "daily_log" as const,
      })),
      ...lifePhotos.map((photo) => ({
        date: photo.date,
        id: photo.id,
        meta: photo.caption || photo.fileName,
        title: "사진 기록",
        type: "photo" as const,
      })),
      ...expenses.map((expense) => ({
        date: expense.date,
        id: expense.id,
        meta: `${formatWon(expense.amount)} · ${expense.title}`,
        title: "지출 기록",
        type: "expense" as const,
      })),
      ...workouts.map((workout) => ({
        date: workout.date,
        id: workout.id,
        meta: workout.type === "running" ? [workout.distanceKm ? `${workout.distanceKm}km` : null, formatRunDuration(workout.durationSeconds ?? workout.durationMinutes * 60)].filter(Boolean).join(" · ") : workout.memo,
        title: workout.type === "running" ? "러닝 기록" : "운동 기록",
        type: "workout" as const,
      })),
      ...weights.map((weight) => ({
        date: weight.date,
        id: weight.id,
        meta: `${weight.weightKg}kg`,
        title: "아침 몸무게",
        type: "weight" as const,
      })),
    ],
    [dailyLogs, expenses, lifePhotos, weights, workouts],
  );

  const createDailyLog = async (date: string, content: string, linkedTarget?: { id: string; title: string; type: "schedule" | "todo" | "event" }) => {
    const savedLog = await createDailyLogInDb(date, content, linkedTarget);
    if (savedLog) setDailyLogs((current) => [savedLog, ...current]);
  };

  const updateDailyLog = async (log: DailyLogRecord) => {
    const savedLog = await updateDailyLogInDb(log);
    if (savedLog) setDailyLogs((current) => current.map((item) => (item.id === savedLog.id ? savedLog : item)));
  };

  const deleteDailyLog = async (id: string) => {
    await deleteDailyLogFromDb(id);
    setDailyLogs((current) => current.filter((item) => item.id !== id));
  };

  const uploadLifePhotos = async (date: string, uploads: LifeMediaUploadInput[], caption?: string, linkedTarget?: { id: string; title: string; type: "schedule" | "todo" | "event" }) => {
    const savedPhotos = await uploadLifePhotosToDb(date, uploads, caption, linkedTarget);
    if (savedPhotos?.length) setLifePhotos((current) => [...savedPhotos, ...current]);
  };

  const deleteLifePhoto = async (photo: LifePhotoRecord) => {
    await deleteLifePhotoFromDb(photo);
    setLifePhotos((current) => current.filter((item) => item.id !== photo.id));
  };

  return (
    <div className="life-axis-view">
      <div className="life-calendar-switch" aria-label="라이프 캘린더 보기 전환">
        {lifeTabs.map((tab) => (
          <button
            className={activeTab === tab.key ? "life-calendar-switch__item life-calendar-switch__item--active" : "life-calendar-switch__item"}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "events" ? (
        <CalendarView
          allowedTypes={["schedule", "event", "todo"]}
          defaultSelectedDate={formatDateKey(new Date())}
          description="일정과 할 일을 날짜별로 묶고, 필요한 항목을 바로 추가하세요."
          externalItems={externalItems}
          headerVariant="tab"
          keepDateSelected
          showEventAddButton
          showSelectedDatePlacesMap={false}
          title="라이프 캘린더"
        />
      ) : activeTab === "report" ? (
        <LifeReportView dailyLogs={dailyLogs} events={events} expenses={expenses} isLoading={isLifeDataLoading} photos={lifePhotos} tasks={tasks} weights={weights} workouts={workouts} />
      ) : activeTab === "monthly" ? (
        <LifeMonthlyReviewView dailyLogs={dailyLogs} events={events} expenses={expenses} photos={lifePhotos} tasks={tasks} weights={weights} workouts={workouts} />
      ) : activeTab === "search" ? (
        <LifeSearchView dailyLogs={dailyLogs} events={events} expenses={expenses} photos={lifePhotos} tasks={tasks} weights={weights} workouts={workouts} />
      ) : activeTab === "places" ? (
        <LifePlacesView />
      ) : activeTab === "ledger" ? (
        <LedgerView variant="tab" />
      ) : activeTab === "logs" ? (
        <LifeLogsView logs={dailyLogs} onCreateLog={createDailyLog} onDeleteLog={deleteDailyLog} onUpdateLog={updateDailyLog} />
      ) : activeTab === "photos" ? (
        <LifePhotosView onDeletePhoto={deleteLifePhoto} onUploadPhotos={uploadLifePhotos} photos={lifePhotos} />
      ) : (
        <LifeHealthView setWeights={setWeights} setWorkouts={setWorkouts} weights={weights} workouts={workouts} />
      )}
    </div>
  );
}

function LifeReportView({
  dailyLogs,
  events,
  expenses,
  isLoading,
  photos,
  tasks,
  weights,
  workouts,
}: {
  dailyLogs: DailyLogRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  isLoading: boolean;
  photos: LifePhotoRecord[];
  tasks: TaskItem[];
  weights: WeightRecord[];
  workouts: WorkoutSession[];
}) {
  const [date, setDate] = useState(formatDateKey(new Date()));
  const [selectedBundle, setSelectedBundle] = useState<LifeContextBundle | null>(null);
  const monthKey = date.slice(0, 7);
  const dayEvents = events.filter((event) => isDateInRange(date, event.date, event.endDate));
  const dayTasks = tasks.filter((task) => isDateInRange(date, task.scheduledDate, task.dueDate));
  const dayExpenses = expenses.filter((expense) => expense.date === date);
  const dayLogs = dailyLogs.filter((log) => log.date === date);
  const dayPhotos = photos.filter((photo) => photo.date === date);
  const dayWeights = weights.filter((weight) => weight.date === date);
  const dayWorkouts = workouts.filter((workout) => workout.date === date);
  const monthExpenses = expenses.filter((expense) => expense.date.startsWith(monthKey));
  const monthLogs = dailyLogs.filter((log) => log.date.startsWith(monthKey));
  const monthPhotos = photos.filter((photo) => photo.date.startsWith(monthKey));
  const monthWorkouts = workouts.filter((workout) => workout.date.startsWith(monthKey));
  const totalExpense = dayExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const monthExpenseTotal = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const monthRunningKm = monthWorkouts.reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0);
  const places = uniquePlanPlaces([...dayEvents.flatMap((event) => (event.place ? [event.place] : [])), ...dayTasks.flatMap((task) => (task.place ? [task.place] : []))]);
  const contextBundles = buildLifeContextBundles(date, dayEvents, dayTasks, dayExpenses, dayLogs, dayPhotos);
  const dateOnlyLogs = dayLogs.filter((log) => !log.linkedTargetId);
  const dateOnlyPhotos = dayPhotos.filter((photo) => !photo.linkedTargetId);
  const dateOnlyExpenses = dayExpenses.filter((expense) => !contextBundles.some((bundle) => bundle.expenses.some((item) => item.id === expense.id)));

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="하루 리포트" description="날짜 하나를 기준으로 사건, 장소, 지출, 사진, 기록, 건강을 한 장의 개인 DB 뷰로 묶어봅니다." />
      <SectionCard className="life-report-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">선택한 날짜</p>
            <h2>{formatFullDate(date)}</h2>
          </div>
          <label className="life-health-date-control">
            <span>리포트 날짜</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </div>

        <div className="life-report-metrics">
          <ReportMetric label="하루 밀도" value={`${dayEvents.length + dayTasks.length + dayLogs.length + dayPhotos.length + dayWorkouts.length + dayWeights.length}건`} hint="계획·기록·건강" />
          <ReportMetric label="지출" value={totalExpense > 0 ? formatWon(totalExpense) : "-"} hint={`${dayExpenses.length}건 연결`} />
          <ReportMetric label="장소" value={`${places.length}곳`} hint={places[0]?.name ?? "장소 연결 없음"} />
          <ReportMetric label="미디어/기록" value={`${dayPhotos.length + dayLogs.length}개`} hint={`사진 ${dayPhotos.length} · 기록 ${dayLogs.length}`} />
        </div>

        <div className="life-report-month">
          <article>
            <span>이번 달 기록</span>
            <strong>{monthLogs.length + monthPhotos.length}개</strong>
            <p>하루기록 {monthLogs.length} · 사진 {monthPhotos.length}</p>
          </article>
          <article>
            <span>이번 달 지출</span>
            <strong>{monthExpenseTotal > 0 ? formatWon(monthExpenseTotal) : "-"}</strong>
            <p>사건/할일에서 발생한 지출 합계</p>
          </article>
          <article>
            <span>이번 달 러닝</span>
            <strong>{monthRunningKm > 0 ? `${monthRunningKm.toFixed(1)}km` : "-"}</strong>
            <p>{monthWorkouts.length}회 운동 기록</p>
          </article>
        </div>

        <div className="life-report-sections">
          <section>
            <h3>사건별 연결 맥락</h3>
            {contextBundles.length > 0 ? (
              <div className="life-context-list">
                {contextBundles.map((bundle) => (
                  <button className="life-context-card life-context-card--button" key={bundle.key} onClick={() => setSelectedBundle(bundle)} type="button">
                    <div className="life-context-card__head">
                      <span>{bundle.label}</span>
                      <strong>{bundle.title}</strong>
                    </div>
                    <div className="life-context-card__chips">
                      <b>지출 {bundle.expenses.length}</b>
                      <b>장소 {bundle.place ? 1 : 0}</b>
                      <b>기록 {bundle.logs.length}</b>
                      <b>사진 {bundle.photos.length}</b>
                    </div>
                    {bundle.meta ? <p>{bundle.meta}</p> : null}
                    {bundle.place ? <p>장소 · {bundle.place.name}</p> : null}
                    {bundle.expenses.length > 0 ? <p>지출 · {formatWon(bundle.expenses.reduce((sum, expense) => sum + expense.amount, 0))}</p> : null}
                    {bundle.logs[0] ? <blockquote>{bundle.logs[0].content}</blockquote> : null}
                    {bundle.photos.length > 0 ? <span className="life-context-card__media">사진/영상 {bundle.photos.length}개 연결됨</span> : null}
                  </button>
                ))}
              </div>
            ) : (
              <div className="life-map-empty life-map-empty--compact">
                <NotebookPen aria-hidden size={28} />
                <strong>{isLoading ? "리포트를 불러오는 중입니다." : "이날 연결된 사건 맥락이 없습니다."}</strong>
                <p>일정/할일에 장소·지출을 넣고, 사진과 하루기록을 사건에 연결하면 이곳이 채워집니다.</p>
              </div>
            )}
          </section>

          <section>
            <h3>날짜 단독 기록</h3>
            <div className="life-date-only-grid">
              <ReportList title="하루기록" empty="날짜에만 붙은 하루기록 없음" items={dateOnlyLogs.map((log) => log.content)} />
              <ReportList title="사진/영상" empty="날짜에만 붙은 사진 없음" items={dateOnlyPhotos.map((photo) => photo.caption || photo.fileName)} />
              <ReportList title="지출" empty="사건 밖 지출 없음" items={dateOnlyExpenses.map((expense) => `${expense.title} · ${formatWon(expense.amount)}`)} />
              <ReportList title="건강" empty="건강 기록 없음" items={[...dayWorkouts.map((workout) => `${workout.type === "running" ? "러닝" : "운동"} · ${formatRunDuration(workout.durationSeconds ?? workout.durationMinutes * 60)}`), ...dayWeights.map((weight) => `아침 몸무게 · ${weight.weightKg}kg`)]} />
            </div>
          </section>
        </div>
      </SectionCard>
      {selectedBundle ? <LifeContextDetailDrawer bundle={selectedBundle} onClose={() => setSelectedBundle(null)} /> : null}
    </div>
  );
}

function LifeContextDetailDrawer({ bundle, onClose }: { bundle: LifeContextBundle; onClose: () => void }) {
  const totalExpense = bundle.expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <div className="life-detail-overlay" role="presentation" onMouseDown={onClose}>
      <aside className="life-detail-drawer" aria-label="사건 상세" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="life-detail-drawer__head">
          <div>
            <span>{bundle.label}</span>
            <h2>{bundle.title}</h2>
            {bundle.meta ? <p>{bundle.meta}</p> : null}
          </div>
          <button aria-label="닫기" onClick={onClose} type="button">
            <X aria-hidden size={18} />
          </button>
        </div>

        <div className="life-detail-summary">
          <ReportMetric label="지출" value={totalExpense > 0 ? formatWon(totalExpense) : "-"} hint={`${bundle.expenses.length}건`} />
          <ReportMetric label="기록" value={`${bundle.logs.length}개`} hint="하루기록 연결" />
          <ReportMetric label="미디어" value={`${bundle.photos.length}개`} hint="사진/영상 연결" />
        </div>

        {bundle.place ? (
          <section className="life-detail-section">
            <h3>장소</h3>
            <p>{bundle.place.name}</p>
            <span>{bundle.place.address || bundle.place.category || "주소 정보 없음"}</span>
          </section>
        ) : null}

        <section className="life-detail-section">
          <h3>지출</h3>
          {bundle.expenses.length > 0 ? bundle.expenses.map((expense) => <p key={expense.id}>{expense.title} · {formatWon(expense.amount)}</p>) : <span>연결된 지출 없음</span>}
        </section>

        <section className="life-detail-section">
          <h3>하루기록</h3>
          {bundle.logs.length > 0 ? bundle.logs.map((log) => <blockquote key={log.id}>{log.content}</blockquote>) : <span>연결된 하루기록 없음</span>}
        </section>

        <section className="life-detail-section">
          <h3>사진/영상</h3>
          {bundle.photos.length > 0 ? (
            <div className="life-detail-media">
              {bundle.photos.slice(0, 8).map((photo) => (
                <figure key={photo.id}>
                  {photo.fileUrl && !photo.mimeType?.startsWith("video/") ? <Image alt={photo.caption || photo.fileName} height={120} src={photo.fileUrl} unoptimized width={120} /> : <div>{photo.fileName}</div>}
                  <figcaption>{photo.caption || photo.fileName}</figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <span>연결된 사진 없음</span>
          )}
        </section>
      </aside>
    </div>
  );
}

function LifeMonthlyReviewView({
  dailyLogs,
  events,
  expenses,
  photos,
  tasks,
  weights,
  workouts,
}: {
  dailyLogs: DailyLogRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  photos: LifePhotoRecord[];
  tasks: TaskItem[];
  weights: WeightRecord[];
  workouts: WorkoutSession[];
}) {
  const [month, setMonth] = useState(formatDateKey(new Date()).slice(0, 7));
  const monthEvents = events.filter((event) => event.date.startsWith(month) || event.endDate?.startsWith(month));
  const monthTasks = tasks.filter((task) => task.scheduledDate.startsWith(month) || task.dueDate?.startsWith(month));
  const monthExpenses = expenses.filter((expense) => expense.date.startsWith(month));
  const monthLogs = dailyLogs.filter((log) => log.date.startsWith(month));
  const monthPhotos = photos.filter((photo) => photo.date.startsWith(month));
  const monthWorkouts = workouts.filter((workout) => workout.date.startsWith(month));
  const monthWeights = weights.filter((weight) => weight.date.startsWith(month));
  const monthPlaces = uniquePlanPlaces([...monthEvents.flatMap((event) => (event.place ? [event.place] : [])), ...monthTasks.flatMap((task) => (task.place ? [task.place] : []))]);
  const totalExpense = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const runningDistance = monthWorkouts.reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0);
  const completedTasks = monthTasks.filter((task) => task.status === "done").length;
  const topExpense = [...monthExpenses].sort((a, b) => b.amount - a.amount)[0];
  const latestWeight = [...monthWeights].sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="월간 회고" description="한 달 동안의 행동, 소비, 장소, 기록 밀도를 요약해서 다음 달 선택에 쓰는 화면입니다." />
      <SectionCard className="life-report-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">회고 월</p>
            <h2>{month.replace("-", "년 ")}월</h2>
          </div>
          <label className="life-health-date-control">
            <span>월 선택</span>
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        </div>

        <div className="life-report-metrics">
          <ReportMetric label="기록 밀도" value={`${monthEvents.length + monthTasks.length + monthLogs.length + monthPhotos.length}건`} hint={`기록 ${monthLogs.length} · 사진 ${monthPhotos.length}`} />
          <ReportMetric label="총 지출" value={totalExpense > 0 ? formatWon(totalExpense) : "-"} hint={topExpense ? `최대 ${topExpense.title}` : "지출 없음"} />
          <ReportMetric label="방문 장소" value={`${monthPlaces.length}곳`} hint={monthPlaces[0]?.name ?? "장소 연결 없음"} />
          <ReportMetric label="러닝" value={runningDistance > 0 ? `${runningDistance.toFixed(1)}km` : "-"} hint={`${monthWorkouts.length}회 기록`} />
        </div>

        <div className="life-review-grid">
          <article>
            <span>할 일 완료</span>
            <strong>{monthTasks.length > 0 ? `${completedTasks}/${monthTasks.length}` : "-"}</strong>
            <p>{monthTasks.length > 0 ? `${Math.round((completedTasks / monthTasks.length) * 100)}% 완료` : "이번 달 할 일 없음"}</p>
          </article>
          <article>
            <span>최근 몸무게</span>
            <strong>{latestWeight ? `${latestWeight.weightKg}kg` : "-"}</strong>
            <p>{latestWeight ? `${latestWeight.date} 기준` : "몸무게 기록 없음"}</p>
          </article>
          <article>
            <span>가장 큰 지출</span>
            <strong>{topExpense ? formatWon(topExpense.amount) : "-"}</strong>
            <p>{topExpense?.title ?? "지출 기록 없음"}</p>
          </article>
        </div>

        <section className="life-report-sections">
          <h3>이번 달 주요 기록</h3>
          <div className="life-date-only-grid">
            <ReportList title="일정/이벤트" empty="일정 없음" items={monthEvents.slice(0, 5).map((event) => `${event.date} · ${event.title}`)} />
            <ReportList title="하루기록" empty="기록 없음" items={monthLogs.slice(0, 5).map((log) => `${log.date} · ${log.content}`)} />
            <ReportList title="장소" empty="장소 없음" items={monthPlaces.slice(0, 5).map((place) => place.name)} />
            <ReportList title="사진/영상" empty="사진 없음" items={monthPhotos.slice(0, 5).map((photo) => `${photo.date} · ${photo.caption || photo.fileName}`)} />
          </div>
        </section>
      </SectionCard>
    </div>
  );
}

function LifeSearchView({
  dailyLogs,
  events,
  expenses,
  photos,
  tasks,
  weights,
  workouts,
}: {
  dailyLogs: DailyLogRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  photos: LifePhotoRecord[];
  tasks: TaskItem[];
  weights: WeightRecord[];
  workouts: WorkoutSession[];
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | LifeSearchItem["type"]>("all");
  const items = useMemo(() => buildLifeSearchItems(events, tasks, expenses, dailyLogs, photos, weights, workouts), [dailyLogs, events, expenses, photos, tasks, weights, workouts]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesQuery = !normalizedQuery || [item.title, item.description, item.date, item.tags.join(" ")].join(" ").toLowerCase().includes(normalizedQuery);
    return matchesType && matchesQuery;
  });

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="전체 검색" description="사람, 장소, 금액, 메모, 사진명, 날짜를 한 번에 찾아 전체 인생 DB를 탐색합니다." />
      <SectionCard className="life-report-panel">
        <div className="life-search-controls">
          <label>
            <Search aria-hidden size={18} />
            <input placeholder="예: 강남, 민수, 러닝, 50000, 면접" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as "all" | LifeSearchItem["type"])}>
            <option value="all">전체</option>
            <option value="schedule">일정</option>
            <option value="todo">할일</option>
            <option value="event">이벤트</option>
            <option value="expense">지출</option>
            <option value="daily_log">하루기록</option>
            <option value="photo">사진</option>
            <option value="workout">운동</option>
            <option value="weight">몸무게</option>
          </select>
        </div>

        <div className="life-search-result-head">
          <strong>{filteredItems.length}개 결과</strong>
          <span>전체 {items.length}개 기록 중 검색</span>
        </div>

        <div className="life-search-results">
          {filteredItems.slice(0, 80).map((item) => (
            <article key={item.id}>
              <span>{item.date} · {item.label}</span>
              <strong>{item.title}</strong>
              {item.description ? <p>{item.description}</p> : null}
              {item.tags.length > 0 ? <em>{item.tags.join(" · ")}</em> : null}
            </article>
          ))}
          {filteredItems.length === 0 ? (
            <div className="life-map-empty life-map-empty--compact">
              <Search aria-hidden size={28} />
              <strong>검색 결과가 없습니다.</strong>
              <p>장소, 사람, 메모, 금액, 사진 이름 같은 단어로 다시 검색해보세요.</p>
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}

function ReportMetric({ hint, label, value }: { hint: string; label: string; value: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function ReportList({ empty, items, title }: { empty: string; items: string[]; title: string }) {
  return (
    <article className="life-report-list-card">
      <span>{title}</span>
      {items.length > 0 ? (
        <ul>
          {items.slice(0, 5).map((item, index) => (
            <li key={`${title}-${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>{empty}</p>
      )}
    </article>
  );
}

function buildLifeContextBundles(
  date: string,
  events: CalendarEvent[],
  tasks: TaskItem[],
  expenses: ExpenseRecord[],
  logs: DailyLogRecord[],
  photos: LifePhotoRecord[],
): LifeContextBundle[] {
  const eventBundles = events
    .filter((event) => event.type === "schedule" || event.type === "event")
    .map((event) => {
      const targetType = event.type === "event" ? "event" : "schedule";
      return {
        expenses: expenses.filter((expense) => expense.targetType === targetType && expense.targetId === event.id),
        key: `${targetType}:${event.id}`,
        label: getPhotoTargetTypeLabel(targetType),
        logs: logs.filter((log) => log.linkedTargetType === targetType && log.linkedTargetId === event.id),
        meta: formatContextMeta(date, event.date, event.endDate, event.time, event.endTime, event.isAllDay, event.companions),
        photos: photos.filter((photo) => photo.linkedTargetType === targetType && photo.linkedTargetId === event.id),
        place: event.place,
        title: event.title,
      } satisfies LifeContextBundle;
    });

  const taskBundles = tasks.map((task) => ({
    expenses: expenses.filter((expense) => expense.targetType === "todo" && expense.targetId === task.id),
    key: `todo:${task.id}`,
    label: "할일",
    logs: logs.filter((log) => log.linkedTargetType === "todo" && log.linkedTargetId === task.id),
    meta: formatContextMeta(date, task.scheduledDate, task.dueDate, task.startTime, task.endTime, task.isAllDay, task.companions),
    photos: photos.filter((photo) => photo.linkedTargetType === "todo" && photo.linkedTargetId === task.id),
    place: task.place,
    title: task.title,
  }));

  return [...eventBundles, ...taskBundles].sort((a, b) => getContextScore(b) - getContextScore(a));
}

function getContextScore(bundle: LifeContextBundle) {
  return bundle.expenses.length + bundle.logs.length + bundle.photos.length + (bundle.place ? 1 : 0);
}

function formatContextMeta(date: string, startDate: string, endDate?: string, startTime?: string, endTime?: string, isAllDay = true, companions?: string) {
  const range = endDate && endDate !== startDate ? `${startDate}~${endDate}` : date;
  const time = isAllDay ? "하루종일" : endTime ? `${startTime ?? "시간 미정"}-${endTime}` : startTime ?? "시간 미정";
  return [range, time, companions ? `함께한 사람 · ${companions}` : null].filter(Boolean).join(" · ");
}

function buildLifeSearchItems(
  events: CalendarEvent[],
  tasks: TaskItem[],
  expenses: ExpenseRecord[],
  logs: DailyLogRecord[],
  photos: LifePhotoRecord[],
  weights: WeightRecord[],
  workouts: WorkoutSession[],
): LifeSearchItem[] {
  return [
    ...events
      .filter((event) => event.type === "schedule" || event.type === "event")
      .map((event) => ({
        date: event.date,
        description: formatContextMeta(event.date, event.date, event.endDate, event.time, event.endTime, event.isAllDay, event.companions),
        id: `${event.type}-${event.id}`,
        label: event.type === "event" ? "이벤트" : "일정",
        tags: [event.meta, event.place?.name, event.place?.address, event.companions, event.expenseAmount ? formatWon(event.expenseAmount) : ""].filter(Boolean) as string[],
        title: event.title,
        type: event.type === "event" ? ("event" as const) : ("schedule" as const),
      })),
    ...tasks.map((task) => ({
      date: task.scheduledDate,
      description: formatContextMeta(task.scheduledDate, task.scheduledDate, task.dueDate, task.startTime, task.endTime, task.isAllDay, task.companions),
      id: `todo-${task.id}`,
      label: "할일",
      tags: [task.status, task.priority, task.memo, task.place?.name, task.place?.address, task.companions, task.expenseAmount ? formatWon(task.expenseAmount) : ""].filter(Boolean) as string[],
      title: task.title,
      type: "todo" as const,
    })),
    ...expenses.map((expense) => ({
      date: expense.date,
      description: [expense.category, formatWon(expense.amount), expense.memo].filter(Boolean).join(" · "),
      id: `expense-${expense.id}`,
      label: "지출",
      tags: [expense.category, expense.memo, expense.targetType, expense.targetId].filter(Boolean) as string[],
      title: expense.title,
      type: "expense" as const,
    })),
    ...logs.map((log) => ({
      date: log.date,
      description: log.content,
      id: `daily-log-${log.id}`,
      label: "하루기록",
      tags: [log.linkedTargetTitle, log.linkedTargetType].filter(Boolean) as string[],
      title: log.linkedTargetTitle ? `하루기록 · ${log.linkedTargetTitle}` : "하루기록",
      type: "daily_log" as const,
    })),
    ...photos.map((photo) => ({
      date: photo.date,
      description: [photo.caption, photo.fileName, photo.mimeType].filter(Boolean).join(" · "),
      id: `photo-${photo.id}`,
      label: "사진",
      tags: [photo.linkedTargetTitle, photo.linkedTargetType, photo.fileName, photo.mimeType].filter(Boolean) as string[],
      title: photo.caption || photo.fileName,
      type: "photo" as const,
    })),
    ...workouts.map((workout) => ({
      date: workout.date,
      description: [workout.distanceKm ? `${workout.distanceKm}km` : null, formatRunDuration(workout.durationSeconds ?? workout.durationMinutes * 60), workout.memo].filter(Boolean).join(" · "),
      id: `workout-${workout.id}`,
      label: workout.type === "running" ? "러닝" : "운동",
      tags: [workout.type, workout.condition, workout.memo].filter(Boolean) as string[],
      title: workout.type === "running" ? "러닝 기록" : "운동 기록",
      type: "workout" as const,
    })),
    ...weights.map((weight) => ({
      date: weight.date,
      description: [weight.measuredFasted ? "공복" : null, weight.memo].filter(Boolean).join(" · "),
      id: `weight-${weight.id}`,
      label: "몸무게",
      tags: [String(weight.weightKg), weight.memo].filter(Boolean) as string[],
      title: `${weight.weightKg}kg`,
      type: "weight" as const,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}

function LifeLogsView({
  logs,
  onCreateLog,
  onDeleteLog,
  onUpdateLog,
}: {
  logs: DailyLogRecord[];
  onCreateLog: (date: string, content: string, linkedTarget?: { id: string; title: string; type: "schedule" | "todo" | "event" }) => Promise<void> | void;
  onDeleteLog: (id: string) => Promise<void> | void;
  onUpdateLog: (log: DailyLogRecord) => Promise<void> | void;
}) {
  const [date, setDate] = useState(formatDateKey(new Date()));
  const [content, setContent] = useState("");
  const [linkedTargetKey, setLinkedTargetKey] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const selectedLogs = logs.filter((log) => log.date === date);
  const linkedTargetOptions = useMemo(() => getPhotoLinkedTargetOptions(date, events, tasks), [date, events, tasks]);
  const linkedTarget = linkedTargetOptions.find((option) => option.key === linkedTargetKey);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchCalendarEventsFromDb(), fetchTasksFromDb()])
      .then(([nextEvents, nextTasks]) => {
        if (!isMounted) return;
        setEvents(nextEvents ?? []);
        setTasks(nextTasks ?? []);
      })
      .catch((error) => console.error("Failed to load daily log link targets from Supabase", error));

    return () => {
      isMounted = false;
    };
  }, []);

  const saveLog = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    setIsSaving(true);
    try {
      const linkedTargetPayload = linkedTarget ? { id: linkedTarget.id, title: linkedTarget.title, type: linkedTarget.type } : undefined;
      if (editingLogId) {
        await onUpdateLog({
          id: editingLogId,
          date,
          content: trimmedContent,
          linkedTargetId: linkedTargetPayload?.id,
          linkedTargetTitle: linkedTargetPayload?.title,
          linkedTargetType: linkedTargetPayload?.type,
        });
      } else {
        await onCreateLog(date, trimmedContent, linkedTargetPayload);
      }
      setContent("");
      setLinkedTargetKey("");
      setEditingLogId(null);
    } finally {
      setIsSaving(false);
    }
  };

  const editLog = (log: DailyLogRecord) => {
    setDate(log.date);
    setContent(log.content);
    setEditingLogId(log.id);
    setLinkedTargetKey(log.linkedTargetType && log.linkedTargetId ? `${log.linkedTargetType}:${log.linkedTargetId}` : "");
  };

  const deleteLog = async (id: string) => {
    setDeletingLogId(id);
    try {
      await onDeleteLog(id);
      if (editingLogId === id) {
        setEditingLogId(null);
        setContent("");
        setLinkedTargetKey("");
      }
    } finally {
      setDeletingLogId(null);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="하루기록" description="날짜나 사건에 연결해두면 이 탭과 사건 탭의 해당 날짜 타임라인에서 함께 조회됩니다." />
      <div className="life-capture-page">
        <SectionCard className="life-capture-editor">
          <div className="life-capture-card__title">
            <NotebookPen aria-hidden size={17} />
            <span>짧은 하루 기록</span>
          </div>
          <label className="life-capture-date">
            <span>기록 날짜</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="life-photo-link-field">
            <span>연결할 사건</span>
            <select value={linkedTargetKey} onChange={(event) => setLinkedTargetKey(event.target.value)}>
              <option value="">날짜에만 연결</option>
              {linkedTargetOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <textarea placeholder="오늘 기억하고 싶은 것 한두 문장을 남겨보세요." value={content} onChange={(event) => setContent(event.target.value)} />
          {editingLogId ? (
            <button
              className="life-capture-secondary"
              onClick={() => {
                setEditingLogId(null);
                setContent("");
                setLinkedTargetKey("");
              }}
              type="button"
            >
              수정 취소
            </button>
          ) : null}
          <button className="life-capture-primary" disabled={!content.trim() || isSaving} onClick={saveLog} type="button">
            {isSaving ? "저장 중" : editingLogId ? "기록 수정" : "기록 저장"}
          </button>
        </SectionCard>

        <SectionCard className="life-capture-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">선택한 날짜</p>
              <h2>{formatFullDate(date)}</h2>
            </div>
            <strong className="life-places-count">{selectedLogs.length}개</strong>
          </div>
          {selectedLogs.length > 0 ? (
            <div className="life-log-list">
              {selectedLogs.map((log) => (
                <article className="life-log-preview" key={log.id}>
                  {log.linkedTargetTitle ? <b className="life-photo-link-badge">{getPhotoTargetTypeLabel(log.linkedTargetType)} · {log.linkedTargetTitle}</b> : null}
                  <span>하루 기록</span>
                  <p>{log.content}</p>
                  <div className="life-record-actions">
                    <button onClick={() => editLog(log)} type="button">
                      수정
                    </button>
                    <button disabled={deletingLogId === log.id} onClick={() => void deleteLog(log.id)} type="button">
                      {deletingLogId === log.id ? "삭제 중" : "삭제"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <NotebookPen aria-hidden size={28} />
              <strong>이날 남긴 기록이 없습니다.</strong>
              <p>왼쪽에서 짧은 하루 기록을 추가하면 이곳에 모입니다.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function LifePhotosView({
  onDeletePhoto,
  onUploadPhotos,
  photos,
}: {
  onDeletePhoto: (photo: LifePhotoRecord) => Promise<void> | void;
  onUploadPhotos: (date: string, uploads: LifeMediaUploadInput[], caption?: string, linkedTarget?: { id: string; title: string; type: "schedule" | "todo" | "event" }) => Promise<void> | void;
  photos: LifePhotoRecord[];
}) {
  const [date, setDate] = useState(formatDateKey(new Date()));
  const [caption, setCaption] = useState("");
  const [linkedTargetKey, setLinkedTargetKey] = useState("");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [previews, setPreviews] = useState<LifeMediaPreview[]>([]);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const selectedPhotos = photos.filter((photo) => photo.date === date);
  const linkedTargetOptions = useMemo(() => getPhotoLinkedTargetOptions(date, events, tasks), [date, events, tasks]);
  const linkedTarget = linkedTargetOptions.find((option) => option.key === linkedTargetKey);

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.objectUrl)), [previews]);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchCalendarEventsFromDb(), fetchTasksFromDb()])
      .then(([nextEvents, nextTasks]) => {
        if (!isMounted) return;
        setEvents(nextEvents ?? []);
        setTasks(nextTasks ?? []);
      })
      .catch((error) => console.error("Failed to load photo link targets from Supabase", error));

    return () => {
      isMounted = false;
    };
  }, []);

  const selectFiles = async (files: File[]) => {
    setUploadError(null);
    previews.forEach((preview) => URL.revokeObjectURL(preview.objectUrl));
    try {
      setPreviews(await Promise.all(files.map(createLifeMediaPreview)));
    } catch (error) {
      console.error("Failed to prepare life media previews", getLifePhotoErrorDebugInfo(error));
      setPreviews([]);
      setUploadError(getLifePhotoUploadErrorMessage(error));
    }
  };

  const uploadPhotos = async () => {
    if (previews.length === 0) return;

    setIsUploading(true);
    try {
      await onUploadPhotos(date, previews, caption.trim() || undefined, linkedTarget ? { id: linkedTarget.id, title: linkedTarget.title, type: linkedTarget.type } : undefined);
      previews.forEach((preview) => URL.revokeObjectURL(preview.objectUrl));
      setPreviews([]);
      setCaption("");
      setLinkedTargetKey("");
      setUploadError(null);
    } catch (error) {
      console.error("Failed to upload life photos", getLifePhotoErrorDebugInfo(error));
      setUploadError(getLifePhotoUploadErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const deletePhoto = async (photo: LifePhotoRecord) => {
    setDeletingPhotoId(photo.id);
    try {
      await onDeletePhoto(photo);
    } finally {
      setDeletingPhotoId(null);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="사진" description="사진과 영상을 날짜나 사건에 연결하고, 사진 탭과 사건 탭 타임라인에서 함께 조회합니다." />
      <div className="life-capture-page">
        <SectionCard className="life-capture-editor">
          <div className="life-capture-card__title">
            <ImagePlus aria-hidden size={17} />
            <span>사진/영상 업로드</span>
          </div>
          <label className="life-capture-date">
            <span>기록 날짜</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="life-photo-link-field">
            <span>연결할 사건</span>
            <select value={linkedTargetKey} onChange={(event) => setLinkedTargetKey(event.target.value)}>
              <option value="">날짜에만 연결</option>
              {linkedTargetOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="life-photo-dropzone">
            <input accept="image/*,video/*" multiple type="file" onChange={(event) => void selectFiles(Array.from(event.target.files ?? []))} />
            <ImagePlus aria-hidden size={24} />
            <strong>{previews.length > 0 ? `${previews.length}개 선택됨` : "사진/영상을 선택하세요"}</strong>
            <span>선택한 날짜의 사진 기록으로 저장됩니다.</span>
          </label>
          {previews.length > 0 ? (
            <div className="life-media-preview-grid">
              {previews.map((preview) => (
                <figure key={preview.id}>
                  {preview.mimeType.startsWith("video/") ? (
                    <video muted playsInline src={preview.objectUrl} />
                  ) : (
                    <Image alt={preview.name} height={preview.height ?? 180} src={preview.objectUrl} unoptimized width={preview.width ?? 180} />
                  )}
                  <figcaption>
                    <strong>{preview.name}</strong>
                    <span>{formatMediaMeta(preview)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}
          <input className="life-photo-caption-input" placeholder="사진 메모" value={caption} onChange={(event) => setCaption(event.target.value)} />
          {uploadError ? <p className="life-photo-upload-error">{uploadError}</p> : null}
          <button className="life-capture-primary" disabled={previews.length === 0 || isUploading} onClick={uploadPhotos} type="button">
            {isUploading ? "업로드 중" : "업로드"}
          </button>
        </SectionCard>

        <SectionCard className="life-capture-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">선택한 날짜</p>
              <h2>{formatFullDate(date)}</h2>
            </div>
            <strong className="life-places-count">{selectedPhotos.length}개</strong>
          </div>
          {selectedPhotos.length > 0 ? (
            <div className="life-photo-gallery">
              {selectedPhotos.map((photo) => (
                <figure key={photo.id} style={getMediaFigureStyle(photo)}>
                  {photo.fileUrl ? (
                    photo.mimeType?.startsWith("video/") ? (
                      <video controls src={photo.fileUrl} />
                    ) : (
                      <Image alt={photo.caption || photo.fileName} height={photo.height ?? 220} src={photo.fileUrl} unoptimized width={photo.width ?? 220} />
                    )
                  ) : (
                    <div>{photo.fileName}</div>
                  )}
                  <figcaption>
                    {photo.linkedTargetTitle ? <b className="life-photo-link-badge">{getPhotoTargetTypeLabel(photo.linkedTargetType)} · {photo.linkedTargetTitle}</b> : null}
                    {photo.caption ? <strong>{photo.caption}</strong> : null}
                    <span>{formatStoredMediaMeta(photo)}</span>
                    <button disabled={deletingPhotoId === photo.id} onClick={() => void deletePhoto(photo)} type="button">
                      {deletingPhotoId === photo.id ? "삭제 중" : "삭제"}
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <ImagePlus aria-hidden size={28} />
              <strong>이날 업로드한 사진이 없습니다.</strong>
              <p>왼쪽에서 사진이나 영상을 선택하면 이곳에서 조회할 수 있습니다.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function getLifePhotoUploadErrorMessage(error: unknown) {
  const detail = getLifePhotoErrorDebugInfo(error);
  if (detail && detail !== "{}") return detail;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (message.includes("Bucket not found") || message.includes("life-media")) return "사진 저장소(life-media)가 아직 없습니다. Supabase SQL 스키마를 먼저 적용해주세요.";
  if (message.includes("life_photos") || message.includes("column") || message.includes("relation")) return "사진 메타데이터 DB(life_photos)가 아직 준비되지 않았습니다. Supabase SQL 스키마를 적용해주세요.";
  if (message.includes("row-level security") || message.includes("policy")) return "스토리지/DB 권한 정책에 막혔습니다. 로그인 상태와 Supabase RLS 정책을 확인해주세요.";
  if (message.includes("auth") || message.includes("User not found")) return "로그인 정보를 확인할 수 없어 업로드하지 못했습니다. 다시 로그인해주세요.";
  return message || "사진 업로드 중 알 수 없는 오류가 발생했습니다.";
}

function getPhotoLinkedTargetOptions(date: string, events: CalendarEvent[], tasks: TaskItem[]): Array<{ id: string; key: string; label: string; title: string; type: "schedule" | "todo" | "event" }> {
  return [
    ...events
      .filter((event) => isDateInRange(date, event.date, event.endDate) && (event.type === "schedule" || event.type === "event"))
      .map((event) => {
        const targetType = event.type === "schedule" ? ("schedule" as const) : ("event" as const);
        return {
          id: event.id,
          key: `${targetType}:${event.id}`,
          label: `${getPhotoTargetTypeLabel(targetType)} · ${event.title}`,
          title: event.title,
          type: targetType,
        };
      }),
    ...tasks
      .filter((task) => isDateInRange(date, task.scheduledDate, task.dueDate))
      .map((task) => ({
        id: task.id,
        key: `todo:${task.id}`,
        label: `${getPhotoTargetTypeLabel("todo")} · ${task.title}`,
        title: task.title,
        type: "todo" as const,
      })),
  ];
}

function getPhotoTargetTypeLabel(type?: LifePhotoRecord["linkedTargetType"]) {
  if (type === "schedule") return "일정";
  if (type === "todo") return "할일";
  if (type === "event") return "이벤트";
  return "사건";
}

function getLifePhotoErrorDebugInfo(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return String(error);

  const entries = Object.getOwnPropertyNames(error)
    .map((key) => [key, (error as Record<string, unknown>)[key]])
    .filter(([, value]) => value !== undefined && value !== null && value !== "");

  if (entries.length > 0) return entries.map(([key, value]) => `${key}: ${String(value)}`).join(", ");

  try {
    return JSON.stringify(error);
  } catch {
    return Object.prototype.toString.call(error);
  }
}

function LifeHealthView({
  setWeights,
  setWorkouts,
  weights,
  workouts,
}: {
  setWeights: Dispatch<SetStateAction<WeightRecord[]>>;
  setWorkouts: Dispatch<SetStateAction<WorkoutSession[]>>;
  weights: WeightRecord[];
  workouts: WorkoutSession[];
}) {
  const [date, setDate] = useState(formatDateKey(new Date()));
  const [distanceKm, setDistanceKm] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [durationSeconds, setDurationSeconds] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [isRunningEditorOpen, setIsRunningEditorOpen] = useState(false);
  const [isWeightEditorOpen, setIsWeightEditorOpen] = useState(false);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [deletingWeightId, setDeletingWeightId] = useState<string | null>(null);
  const [isSavingRunning, setIsSavingRunning] = useState(false);
  const [isSavingWeight, setIsSavingWeight] = useState(false);
  const [message, setMessage] = useState("");

  const selectedRuns = workouts.filter((workout) => workout.date === date && workout.type === "running");
  const selectedWeight = weights.find((weight) => weight.date === date);
  const totalDistanceKm = selectedRuns.reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0);
  const totalSeconds = selectedRuns.reduce((sum, workout) => sum + (workout.durationSeconds ?? workout.durationMinutes * 60), 0);

  const changeDate = (nextDate: string) => {
    setDate(nextDate);
    setDistanceKm("");
    setDurationMinutes("");
    setDurationSeconds("");
    setWeightKg("");
    setEditingRunId(null);
    setIsRunningEditorOpen(false);
    setIsWeightEditorOpen(false);
  };

  const saveRunning = async () => {
    const parsedDistance = Number(distanceKm);
    const parsedMinutes = Number(durationMinutes) || 0;
    const parsedSeconds = Number(durationSeconds) || 0;
    const parsedTotalSeconds = parsedMinutes * 60 + parsedSeconds;
    if (!parsedDistance || parsedTotalSeconds <= 0) return;

    setIsSavingRunning(true);
    try {
      const nextRun = {
        id: editingRunId ?? `run-${Date.now()}`,
        date,
        type: "running",
        condition: "normal",
        durationMinutes: Math.max(1, Math.ceil(parsedTotalSeconds / 60)),
        durationSeconds: parsedTotalSeconds,
        distanceKm: parsedDistance,
      } satisfies WorkoutSession;
      const savedRun = editingRunId ? await updateWorkoutSessionInDb(nextRun) : await createWorkoutSessionInDb(nextRun);
      if (savedRun) setWorkouts((current) => [savedRun, ...current.filter((workout) => workout.id !== savedRun.id)]);
      setDistanceKm("");
      setDurationMinutes("");
      setDurationSeconds("");
      setEditingRunId(null);
      setIsRunningEditorOpen(false);
      setMessage(editingRunId ? "러닝 기록을 수정했어요." : "러닝 기록을 저장했어요.");
    } finally {
      setIsSavingRunning(false);
    }
  };

  const editRunning = (run: WorkoutSession) => {
    const totalDurationSeconds = run.durationSeconds ?? run.durationMinutes * 60;
    setDate(run.date);
    setDistanceKm(run.distanceKm ? String(run.distanceKm) : "");
    setDurationMinutes(String(Math.floor(totalDurationSeconds / 60)));
    setDurationSeconds(String(totalDurationSeconds % 60));
    setEditingRunId(run.id);
    setIsRunningEditorOpen(true);
  };

  const deleteRunning = async (id: string) => {
    setDeletingRunId(id);
    try {
      await deleteWorkoutSessionFromDb(id);
      setWorkouts((current) => current.filter((workout) => workout.id !== id));
      if (editingRunId === id) {
        setEditingRunId(null);
        setDistanceKm("");
        setDurationMinutes("");
        setDurationSeconds("");
        setIsRunningEditorOpen(false);
      }
      setMessage("러닝 기록을 삭제했어요.");
    } finally {
      setDeletingRunId(null);
    }
  };

  const saveMorningWeight = async () => {
    const parsedWeight = Number(weightKg);
    if (!parsedWeight) return;

    setIsSavingWeight(true);
    try {
      const nextWeight = {
        id: selectedWeight?.id ?? `weight-${Date.now()}`,
        date,
        weightKg: parsedWeight,
        measuredFasted: true,
        memo: "아침 몸무게",
      };
      const savedWeight = selectedWeight ? await updateWeightRecordInDb(nextWeight) : await createWeightRecordInDb(nextWeight);
      if (savedWeight) setWeights((current) => [savedWeight, ...current.filter((weight) => weight.id !== savedWeight.id && weight.date !== savedWeight.date)]);
      setWeightKg("");
      setIsWeightEditorOpen(false);
      setMessage("아침 몸무게를 저장했어요.");
    } finally {
      setIsSavingWeight(false);
    }
  };

  const editMorningWeight = () => {
    setWeightKg(selectedWeight ? String(selectedWeight.weightKg) : "");
    setIsWeightEditorOpen(true);
  };

  const deleteMorningWeight = async () => {
    if (!selectedWeight) return;

    setDeletingWeightId(selectedWeight.id);
    try {
      await deleteWeightRecordFromDb(selectedWeight.id);
      setWeights((current) => current.filter((weight) => weight.id !== selectedWeight.id));
      setWeightKg("");
      setIsWeightEditorOpen(false);
      setMessage("아침 몸무게 기록을 삭제했어요.");
    } finally {
      setDeletingWeightId(null);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="건강" description="러닝과 아침 몸무게를 저장하면 건강 탭과 사건 탭의 해당 날짜 타임라인에 함께 표시됩니다." />
      <div className="life-health-view">
        <SectionCard className="life-capture-list life-health-summary">
          <div className="section-heading">
            <div>
              <p className="eyebrow">선택한 날짜</p>
              <h2>{formatFullDate(date)}</h2>
            </div>
            <label className="life-health-date-control">
              <span>기록 날짜</span>
              <input type="date" value={date} onChange={(event) => changeDate(event.target.value)} />
            </label>
          </div>
          <div className="life-health-sections">
            <section className="life-health-section">
              <div className="life-health-section__head">
                <div>
                  <Activity aria-hidden size={17} />
                  <span>러닝 기록</span>
                </div>
                <button className={isRunningEditorOpen ? "life-section-save" : "life-section-edit"} disabled={isRunningEditorOpen && (!distanceKm || (!durationMinutes && !durationSeconds) || isSavingRunning)} onClick={() => (isRunningEditorOpen ? void saveRunning() : setIsRunningEditorOpen(true))} type="button">
                  {isSavingRunning ? "저장 중" : isRunningEditorOpen ? "저장" : selectedRuns.length > 0 ? "추가/수정" : "추가"}
                </button>
              </div>
              {isRunningEditorOpen ? (
                <div className="life-health-editor">
                  <div className="life-health-fields">
                    <label>
                      <span>거리</span>
                      <input inputMode="decimal" min="0" placeholder="km" type="number" value={distanceKm} onChange={(event) => setDistanceKm(event.target.value)} />
                    </label>
                    <label>
                      <span>시간</span>
                      <input inputMode="numeric" min="0" placeholder="분" type="number" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} />
                    </label>
                    <label>
                      <span>초</span>
                      <input inputMode="numeric" max="59" min="0" placeholder="초" type="number" value={durationSeconds} onChange={(event) => setDurationSeconds(event.target.value)} />
                    </label>
                  </div>
                  <button
                    className="life-capture-secondary"
                    onClick={() => {
                      setEditingRunId(null);
                      setIsRunningEditorOpen(false);
                      setDistanceKm("");
                      setDurationMinutes("");
                      setDurationSeconds("");
                    }}
                    type="button"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div className="life-health-summary-grid life-health-summary-grid--single">
                  <article>
                    <span>러닝</span>
                    <strong>{selectedRuns.length > 0 ? `${totalDistanceKm.toFixed(1)}km` : "-"}</strong>
                    <p>{selectedRuns.length > 0 ? `${selectedRuns.length}회 · ${formatRunDuration(totalSeconds)}` : "러닝 기록이 없습니다."}</p>
                  </article>
                </div>
              )}
              {selectedRuns.length > 0 ? (
                <div className="life-health-run-list">
                  {selectedRuns.map((run) => (
                    <article key={run.id}>
                      <div>
                        <strong>{run.distanceKm ? `${run.distanceKm}km` : "거리 미기록"}</strong>
                        <span>{formatRunDuration(run.durationSeconds ?? run.durationMinutes * 60)}</span>
                      </div>
                      <div className="life-record-actions">
                        <button onClick={() => editRunning(run)} type="button">
                          수정
                        </button>
                        <button disabled={deletingRunId === run.id} onClick={() => void deleteRunning(run.id)} type="button">
                          {deletingRunId === run.id ? "삭제 중" : "삭제"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="life-health-section">
              <div className="life-health-section__head">
                <div>
                  <Scale aria-hidden size={17} />
                  <span>아침 몸무게</span>
                </div>
                <button className={isWeightEditorOpen ? "life-section-save" : "life-section-edit"} disabled={isWeightEditorOpen && (!weightKg || isSavingWeight)} onClick={() => (isWeightEditorOpen ? void saveMorningWeight() : editMorningWeight())} type="button">
                  {isSavingWeight ? "저장 중" : isWeightEditorOpen ? "저장" : selectedWeight ? "수정" : "추가"}
                </button>
              </div>
              {isWeightEditorOpen ? (
                <div className="life-health-editor">
                  <label className="life-health-weight-field">
                    <span>몸무게</span>
                    <input inputMode="decimal" min="0" placeholder="kg" type="number" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} />
                  </label>
                  <button
                    className="life-capture-secondary"
                    onClick={() => {
                      setIsWeightEditorOpen(false);
                      setWeightKg("");
                    }}
                    type="button"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <div className="life-health-summary-grid life-health-summary-grid--single">
                  <article>
                    <span>아침 몸무게</span>
                    <strong>{selectedWeight ? `${selectedWeight.weightKg}kg` : "-"}</strong>
                    <p>{selectedWeight ? "공복 기준으로 저장된 기록입니다." : "아침 몸무게 기록이 없습니다."}</p>
                  </article>
                </div>
              )}
              {selectedWeight ? (
                <div className="life-record-actions life-record-actions--inline">
                  <button disabled={deletingWeightId === selectedWeight.id} onClick={() => void deleteMorningWeight()} type="button">
                    {deletingWeightId === selectedWeight.id ? "삭제 중" : "삭제"}
                  </button>
                </div>
              ) : null}
            </section>
          </div>
          {message ? <p className="life-health-message">{message}</p> : null}
        </SectionCard>
      </div>
    </div>
  );
}

async function createLifeMediaPreview(file: File): Promise<LifeMediaPreview> {
  const objectUrl = URL.createObjectURL(file);
  const basePreview = {
    file,
    id: `${file.name}-${file.lastModified}-${file.size}`,
    name: file.name,
    objectUrl,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    lastModified: file.lastModified,
  };

  if (file.type.startsWith("image/")) {
    const dimensions = await readImageDimensions(objectUrl);
    return { ...basePreview, ...dimensions };
  }

  if (file.type.startsWith("video/")) {
    const metadata = await readVideoMetadata(objectUrl);
    return { ...basePreview, ...metadata };
  }

  return basePreview;
}

function readImageDimensions(objectUrl: string) {
  return new Promise<{ width?: number; height?: number }>((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({});
    image.src = objectUrl;
  });
}

function readVideoMetadata(objectUrl: string) {
  return new Promise<{ width?: number; height?: number; durationSeconds?: number }>((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      resolve({
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        durationSeconds: Number.isFinite(video.duration) ? video.duration : undefined,
      });
    video.onerror = () => resolve({});
    video.src = objectUrl;
  });
}

function getMediaFigureStyle(media: Pick<LifePhotoRecord, "height" | "width">) {
  return media.width && media.height ? { aspectRatio: `${media.width} / ${media.height}` } : undefined;
}

function formatMediaMeta(media: Pick<LifeMediaPreview, "durationSeconds" | "height" | "lastModified" | "mimeType" | "sizeBytes" | "width">) {
  return [
    media.width && media.height ? `${media.width}×${media.height}` : null,
    media.durationSeconds ? formatDuration(media.durationSeconds) : null,
    media.mimeType,
    formatFileSize(media.sizeBytes),
    new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(media.lastModified)),
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatStoredMediaMeta(media: LifePhotoRecord) {
  return [
    media.width && media.height ? `${media.width}×${media.height}` : null,
    media.durationSeconds ? formatDuration(media.durationSeconds) : null,
    media.mimeType,
    media.sizeBytes ? formatFileSize(media.sizeBytes) : null,
    media.takenAt ? new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(media.takenAt)) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) return `${(sizeBytes / (1024 * 1024)).toFixed(1)}MB`;
  if (sizeBytes >= 1024) return `${Math.round(sizeBytes / 1024)}KB`;
  return `${sizeBytes}B`;
}

function formatDuration(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatRunDuration(durationSeconds: number) {
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = Math.round(durationSeconds % 60);
  return seconds > 0 ? `${minutes}분 ${seconds}초` : `${minutes}분`;
}

function LifePlacesView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchCalendarEventsFromDb(), fetchTasksFromDb()])
      .then(([dbEvents, dbTasks]) => {
        if (!isMounted) return;
        setEvents(dbEvents ?? []);
        setTasks(dbTasks ?? []);
      })
      .catch((error) => console.error("Failed to load life place data from Supabase", error))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const monthDays = getMonthDays(currentMonth.getFullYear(), currentMonth.getMonth());
  const placesByDate = useMemo(() => {
    const grouped = new Map<string, PlanPlace[]>();
    for (const event of events) {
      if (!event.place) continue;
      for (const date of expandDateRange(event.date, event.endDate)) {
        grouped.set(date, uniquePlanPlaces([...(grouped.get(date) ?? []), event.place]));
      }
    }
    for (const task of tasks) {
      if (!task.place) continue;
      for (const date of expandDateRange(task.scheduledDate, task.dueDate)) {
        grouped.set(date, uniquePlanPlaces([...(grouped.get(date) ?? []), task.place]));
      }
    }
    return grouped;
  }, [events, tasks]);
  const selectedPlaces = placesByDate.get(selectedDate) ?? [];

  const moveMonth = (direction: -1 | 1) => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
    setCurrentMonth(nextMonth);
    setSelectedDate(formatDateKey(nextMonth));
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="장소" description="일정과 할 일에 연결된 장소를 날짜별 동선으로 확인하세요." />

      <div className="life-places-view">
        <SectionCard className="calendar-board life-places-calendar">
          <div className="calendar-toolbar">
            <button aria-label="이전 달" onClick={() => moveMonth(-1)} type="button">
              <ChevronLeft aria-hidden size={20} />
            </button>
            <button className="calendar-month-trigger" onClick={() => setIsMonthPickerOpen(true)} type="button">
              <span>{currentMonth.getFullYear()}</span>
              <strong>{currentMonth.getMonth() + 1}월</strong>
            </button>
            <button aria-label="다음 달" onClick={() => moveMonth(1)} type="button">
              <ChevronRight aria-hidden size={20} />
            </button>
          </div>

          <div className="calendar-weekdays">
            {["일", "월", "화", "수", "목", "금", "토"].map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {monthDays.map((cell) => {
              const places = cell.date ? placesByDate.get(cell.date) ?? [] : [];
              const isSelected = cell.date === selectedDate;
              const isToday = cell.date === formatDateKey(new Date());

              return (
                <button
                  className={`calendar-day ${isToday ? "calendar-day--today" : ""} ${isSelected ? "calendar-day--selected" : ""}`}
                  disabled={!cell.date}
                  key={cell.key}
                  onClick={() => (cell.date ? setSelectedDate(cell.date) : undefined)}
                  type="button"
                >
                  {cell.day ? <span className="calendar-day__number">{cell.day}</span> : null}
                  <div className="calendar-day__events">
                    {places.length > 0 ? (
                      <span className="calendar-day__event-chip" title={`장소 ${places.length}곳`}>
                        <span className="calendar-dot calendar-dot--event" />
                        <span className="calendar-day__event-count">{places.length}</span>
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard className="date-detail-card life-places-detail">
          <div className="section-heading">
            <div>
              <p className="eyebrow">이날 간 장소</p>
              <h2>{formatFullDate(selectedDate)}</h2>
            </div>
            <strong className="life-places-count">{selectedPlaces.length}곳</strong>
          </div>

          <SelectedDatePlacesMap places={selectedPlaces} />

          {selectedPlaces.length > 0 ? (
            <div className="life-place-card__items">
              {selectedPlaces.map((place) => (
                <article className="life-place-event" key={`${place.providerPlaceId ?? place.name}-${place.latitude}-${place.longitude}`}>
                  <span>장소</span>
                  <div>
                    <strong>{place.name}</strong>
                    <p>{place.address || place.category || "주소 정보 없음"}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <MapPin aria-hidden size={28} />
              <strong>{isLoading ? "장소를 불러오는 중입니다." : "이날 연결된 장소가 없습니다."}</strong>
              <p>사건 탭에서 일정이나 할 일에 장소를 추가하면 이곳에 날짜별 장소가 모입니다.</p>
            </div>
          )}
        </SectionCard>
      </div>
      {isMonthPickerOpen ? (
        <MonthPickerSheet
          currentMonth={currentMonth}
          onClose={() => setIsMonthPickerOpen(false)}
          onSelect={(nextMonth) => {
            setCurrentMonth(nextMonth);
            setSelectedDate(formatDateKey(nextMonth));
            setIsMonthPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function LifeTabHeading({ description, title }: { description: string; title: string }) {
  return (
    <header className="life-tab-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
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

function formatWon(amount: number) {
  return `${new Intl.NumberFormat("ko-KR").format(amount)}원`;
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

function getMonthDays(year: number, monthIndex: number) {
  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);
  const cells: Array<{ date: string | null; day: number | null; key: string }> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    cells.push({ date: null, day: null, key: `empty-start-${index}` });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ date, day, key: date });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null, key: `empty-end-${cells.length}` });
  }

  return cells;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { day: "numeric", month: "long", weekday: "long" }).format(new Date(`${value}T00:00:00`));
}

function isDateInRange(date: string, startDate: string, endDate?: string) {
  const normalizedEndDate = endDate || startDate;
  return startDate <= date && date <= normalizedEndDate;
}

function expandDateRange(startDate: string, endDate?: string) {
  const dates: string[] = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate || startDate}T00:00:00`);

  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) return [startDate];

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(formatDateKey(cursor));
  }

  return dates;
}

function uniquePlanPlaces(places: PlanPlace[]) {
  const uniquePlaces = new Map<string, PlanPlace>();
  places.forEach((place) => {
    const key = `${place.providerPlaceId ?? ""}|${place.name}|${place.latitude}|${place.longitude}`;
    if (!uniquePlaces.has(key)) uniquePlaces.set(key, place);
  });
  return [...uniquePlaces.values()];
}
