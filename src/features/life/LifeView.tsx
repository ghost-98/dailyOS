"use client";

import Image from "next/image";
import { Activity, ChevronLeft, ChevronRight, ImagePlus, MapPin, NotebookPen, Scale, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
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
import {
  createDailyLogInDb,
  createLifeActivityInDb,
  deleteDailyLogFromDb,
  deleteLifeActivityFromDb,
  deleteLifePhotoFromDb,
  fetchDailyLogsFromDb,
  fetchLifeActivitiesFromDb,
  fetchLifePhotoMetadataFromDb,
  fetchLifePhotosFromDb,
  updateDailyLogInDb,
  updateLifeActivityInDb,
  uploadLifePhotosToDb,
} from "@/features/life/api";
import { fetchTasksFromDb } from "@/features/tasks/api";
import { expandDateRange, formatDateKey, formatFullDate, getMonthDays, isDateInRange } from "@/features/life/dateTime";
import { formatWon } from "@/features/life/formatters";
import {
  buildLifeContextBundles,
  buildLifeSearchItems,
  buildPeopleSummaries,
  getTopCounts,
  getTopExpenseCategories,
  parseCompanions,
  selectRelevantLifeAskRecords,
} from "@/features/life/insights";
import type { LifeContextBundle, LifeSearchItem } from "@/features/life/insights";
import { getPhotoLinkedTargetOptions, getPhotoTargetTypeLabel } from "@/features/life/linkTargets";
import type { LifeLinkedTarget } from "@/features/life/linkTargets";
import { LifeHomeView } from "@/features/life/LifeHomeView";
import { createLifeMediaPreview, formatMediaMeta, formatStoredMediaMeta, getMediaFigureStyle } from "@/features/life/media";
import type { LifeMediaPreview } from "@/features/life/media";
import type { LifeDataMode, LifeViewMode } from "@/features/life/modes";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import {
  buildPlaceTimeline,
  getActivityPlaceRef,
  groupTimelineByPlace,
  hasPlanPlaceCoordinates,
  kindLabels,
  uniqueLifePlaceRefs,
  uniquePlanPlaces,
} from "@/features/life/places";
import type { LifePlaceRef } from "@/features/life/places";
import { buildDayGapItems, buildDayReconstructionItems, formatActivityTime, formatRunDuration, getActivityDurationMinutes, sortReconstructionItems } from "@/features/life/reconstruction";
import type { DailyLogRecord, ExpenseRecord, LifeActivityRecord, LifeMediaUploadInput, LifePhotoRecord, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

type LifeViewProps = {
  initialDate?: string;
  mode: LifeViewMode;
};

const ACTIVITY_CATEGORIES = ["식사", "이동", "작업", "공부", "만남", "운동", "휴식", "집안일", "기타"];

export function LifeView({ initialDate, mode }: LifeViewProps) {
  return <div className="life-page">{mode === "home" ? <LifeHomeView /> : mode === "map" ? <LifeMapView /> : <LifeCalendarView activeTab={mode} initialDate={initialDate} />}</div>;
}

type LifeDataSnapshot = {
  activities?: LifeActivityRecord[];
  dailyLogs?: DailyLogRecord[];
  events?: CalendarEvent[];
  expenses?: ExpenseRecord[];
  lifePhotos?: LifePhotoRecord[];
  tasks?: TaskItem[];
  weights?: WeightRecord[];
  workouts?: WorkoutSession[];
};

async function loadLifeDataForMode(mode: LifeDataMode): Promise<LifeDataSnapshot> {
  if (mode === "places") return {};

  if (mode === "activities") {
    const [activities, expenses] = await Promise.all([fetchLifeActivitiesFromDb(), fetchExpenseRecordsFromDb()]);
    return { activities: activities ?? [], expenses: expenses ?? [] };
  }

  if (mode === "logs") {
    const [activities, dailyLogs] = await Promise.all([fetchLifeActivitiesFromDb(), fetchDailyLogsFromDb()]);
    return { activities: activities ?? [], dailyLogs: dailyLogs ?? [] };
  }

  if (mode === "photos") {
    const [activities, lifePhotos] = await Promise.all([fetchLifeActivitiesFromDb(), fetchLifePhotosFromDb()]);
    return { activities: activities ?? [], lifePhotos: lifePhotos ?? [] };
  }

  if (mode === "health") {
    const [weights, workouts] = await Promise.all([fetchWeightRecordsFromDb(), fetchWorkoutSessionsFromDb()]);
    return { weights: weights ?? [], workouts: workouts ?? [] };
  }

  if (mode === "calendar") {
    const [expenses, activities, dailyLogs, lifePhotos, weights, workouts] = await Promise.all([
      fetchExpenseRecordsFromDb(),
      fetchLifeActivitiesFromDb(),
      fetchDailyLogsFromDb(),
      fetchLifePhotoMetadataFromDb(),
      fetchWeightRecordsFromDb(),
      fetchWorkoutSessionsFromDb(),
    ]);
    return { activities: activities ?? [], dailyLogs: dailyLogs ?? [], expenses: expenses ?? [], lifePhotos: lifePhotos ?? [], weights: weights ?? [], workouts: workouts ?? [] };
  }

  const photoLoader = mode === "report" ? fetchLifePhotosFromDb : fetchLifePhotoMetadataFromDb;
  const [events, tasks, expenses, activities, dailyLogs, lifePhotos, weights, workouts] = await Promise.all([
    fetchCalendarEventsFromDb(),
    fetchTasksFromDb(),
    fetchExpenseRecordsFromDb(),
    fetchLifeActivitiesFromDb(),
    fetchDailyLogsFromDb(),
    photoLoader(),
    fetchWeightRecordsFromDb(),
    fetchWorkoutSessionsFromDb(),
  ]);

  return {
    activities: activities ?? [],
    dailyLogs: dailyLogs ?? [],
    events: events ?? [],
    expenses: expenses ?? [],
    lifePhotos: lifePhotos ?? [],
    tasks: tasks ?? [],
    weights: weights ?? [],
    workouts: workouts ?? [],
  };
}

function LifeCalendarView({ activeTab, initialDate }: { activeTab: LifeDataMode; initialDate?: string }) {
  const router = useRouter();
  const [reportDate, setReportDate] = useState(initialDate ?? formatDateKey(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [activities, setActivities] = useState<LifeActivityRecord[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLogRecord[]>([]);
  const [lifePhotos, setLifePhotos] = useState<LifePhotoRecord[]>([]);
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [isLifeDataLoading, setIsLifeDataLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    setIsLifeDataLoading(true);
    loadLifeDataForMode(activeTab)
      .then((data) => {
        if (!isMounted) return;
        if (data.events) setEvents(data.events);
        if (data.tasks) setTasks(data.tasks);
        if (data.expenses) setExpenses(data.expenses);
        if (data.activities) setActivities(data.activities);
        if (data.dailyLogs) setDailyLogs(data.dailyLogs);
        if (data.lifePhotos) setLifePhotos(data.lifePhotos);
        if (data.weights) setWeights(data.weights);
        if (data.workouts) setWorkouts(data.workouts);
      })
      .catch((error) => console.error("Failed to load life data from Supabase", error))
      .finally(() => {
        if (isMounted) setIsLifeDataLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  useEffect(() => {
    if (initialDate) setReportDate(initialDate);
  }, [initialDate]);

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
      ...activities.map((activity) => ({
        date: activity.date,
        endTime: activity.endTime,
        id: activity.id,
        isAllDay: activity.isAllDay,
        meta: [activity.placeName, activity.food, activity.expenseAmount ? formatWon(activity.expenseAmount) : null].filter(Boolean).join(" · "),
        startTime: activity.startTime,
        title: activity.title,
        type: "activity" as const,
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
    [activities, dailyLogs, expenses, lifePhotos, weights, workouts],
  );

  const createDailyLog = async (date: string, content: string, linkedTarget?: LifeLinkedTarget) => {
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

  const uploadLifePhotos = async (date: string, uploads: LifeMediaUploadInput[], caption?: string, linkedTarget?: LifeLinkedTarget) => {
    const savedPhotos = await uploadLifePhotosToDb(date, uploads, caption, linkedTarget);
    if (savedPhotos?.length) setLifePhotos((current) => [...savedPhotos, ...current]);
  };

  const deleteLifePhoto = async (photo: LifePhotoRecord) => {
    await deleteLifePhotoFromDb(photo);
    setLifePhotos((current) => current.filter((item) => item.id !== photo.id));
  };

  const saveActivity = async (activity: LifeActivityRecord) => {
    const exists = activities.some((item) => item.id === activity.id);
    const savedActivity = exists ? await updateLifeActivityInDb(activity) : await createLifeActivityInDb(activity);
    const nextActivity = savedActivity ?? activity;
    setActivities((current) => (exists ? current.map((item) => (item.id === nextActivity.id ? nextActivity : item)) : [nextActivity, ...current]));
    const nextExpenses = await fetchExpenseRecordsFromDb();
    setExpenses(nextExpenses ?? []);
  };

  const deleteActivity = async (id: string) => {
    await deleteLifeActivityFromDb(id);
    setActivities((current) => current.filter((item) => item.id !== id));
    const nextExpenses = await fetchExpenseRecordsFromDb();
    setExpenses(nextExpenses ?? []);
  };

  return (
    <div className="life-axis-view">
      {activeTab === "calendar" ? (
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
        <LifeReportView
          activities={activities}
          dailyLogs={dailyLogs}
          date={reportDate}
          events={events}
          expenses={expenses}
          isLoading={isLifeDataLoading}
          onCreateLog={createDailyLog}
          onDateChange={setReportDate}
          onUploadPhotos={uploadLifePhotos}
          photos={lifePhotos}
          tasks={tasks}
          weights={weights}
          workouts={workouts}
        />
      ) : activeTab === "monthly" ? (
        <LifeMonthlyReviewView activities={activities} dailyLogs={dailyLogs} events={events} expenses={expenses} photos={lifePhotos} tasks={tasks} weights={weights} workouts={workouts} />
      ) : activeTab === "search" ? (
        <LifeSearchView
          dailyLogs={dailyLogs}
          activities={activities}
          events={events}
          expenses={expenses}
          onOpenDate={(date) => {
            router.push(`/life/report?date=${date}`);
          }}
          photos={lifePhotos}
          tasks={tasks}
          weights={weights}
          workouts={workouts}
        />
      ) : activeTab === "places" ? (
        <LifePlacesView />
      ) : activeTab === "people" ? (
        <LifePeopleView activities={activities} dailyLogs={dailyLogs} events={events} expenses={expenses} photos={lifePhotos} tasks={tasks} />
      ) : activeTab === "ask" ? (
        <LifeAskView activities={activities} dailyLogs={dailyLogs} events={events} expenses={expenses} photos={lifePhotos} tasks={tasks} weights={weights} workouts={workouts} />
      ) : activeTab === "activities" ? (
        <LifeActivitiesView activities={activities} onDeleteActivity={deleteActivity} onSaveActivity={saveActivity} />
      ) : activeTab === "logs" ? (
        <LifeLogsView activities={activities} logs={dailyLogs} onCreateLog={createDailyLog} onDeleteLog={deleteDailyLog} onUpdateLog={updateDailyLog} />
      ) : activeTab === "photos" ? (
        <LifePhotosView activities={activities} onDeletePhoto={deleteLifePhoto} onUploadPhotos={uploadLifePhotos} photos={lifePhotos} />
      ) : (
        <LifeHealthView setWeights={setWeights} setWorkouts={setWorkouts} weights={weights} workouts={workouts} />
      )}
    </div>
  );
}

function LifeReportView({
  activities,
  dailyLogs,
  date,
  events,
  expenses,
  isLoading,
  onCreateLog,
  onDateChange,
  onUploadPhotos,
  photos,
  tasks,
  weights,
  workouts,
}: {
  activities: LifeActivityRecord[];
  dailyLogs: DailyLogRecord[];
  date: string;
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  isLoading: boolean;
  onCreateLog: (date: string, content: string, linkedTarget?: LifeLinkedTarget) => Promise<void> | void;
  onDateChange: (date: string) => void;
  onUploadPhotos: (date: string, uploads: LifeMediaUploadInput[], caption?: string, linkedTarget?: LifeLinkedTarget) => Promise<void> | void;
  photos: LifePhotoRecord[];
  tasks: TaskItem[];
  weights: WeightRecord[];
  workouts: WorkoutSession[];
}) {
  const [selectedBundleKey, setSelectedBundleKey] = useState<string | null>(null);
  const monthKey = date.slice(0, 7);
  const dayEvents = events.filter((event) => isDateInRange(date, event.date, event.endDate));
  const dayTasks = tasks.filter((task) => isDateInRange(date, task.scheduledDate, task.dueDate));
  const dayActivities = activities.filter((activity) => activity.date === date);
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
  const places = uniqueLifePlaceRefs([
    ...dayEvents.flatMap((event) => (event.place ? [event.place] : [])),
    ...dayTasks.flatMap((task) => (task.place ? [task.place] : [])),
    ...dayActivities.flatMap((activity) => {
      const place = getActivityPlaceRef(activity);
      return place ? [place] : [];
    }),
  ]);
  const contextBundles = buildLifeContextBundles(date, dayEvents, dayTasks, dayActivities, dayExpenses, dayLogs, dayPhotos);
  const selectedBundle = contextBundles.find((bundle) => bundle.key === selectedBundleKey) ?? null;
  const dateOnlyLogs = dayLogs.filter((log) => !log.linkedTargetId);
  const dateOnlyPhotos = dayPhotos.filter((photo) => !photo.linkedTargetId);
  const dateOnlyExpenses = dayExpenses.filter((expense) => !contextBundles.some((bundle) => bundle.expenses.some((item) => item.id === expense.id)));
  const reconstructionItems = buildDayReconstructionItems(date, dayEvents, dayTasks, dayActivities, dayLogs, dayPhotos, dayWorkouts, dayWeights);
  const gapItems = buildDayGapItems(reconstructionItems);
  const missingSignals = [
    dayActivities.length === 0 ? "실제 활동 기록이 비어 있어 하루의 공백을 복원하기 어렵습니다." : null,
    dayLogs.length === 0 ? "짧은 하루기록이 없어 그날의 감정·맥락이 약합니다." : null,
    dayPhotos.some((photo) => !photo.linkedTargetId) ? "연결되지 않은 사진이 있어 사건/활동에 붙이면 검색 가치가 올라갑니다." : null,
    gapItems.length > 0 ? `${gapItems.length}개의 긴 빈 시간이 보입니다. 활동 기록을 추가하면 하루가 더 촘촘해집니다.` : null,
  ].filter(Boolean) as string[];

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
            <input type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
          </label>
        </div>

        <div className="life-report-metrics">
          <ReportMetric label="하루 밀도" value={`${dayEvents.length + dayTasks.length + dayActivities.length + dayLogs.length + dayPhotos.length + dayWorkouts.length + dayWeights.length}건`} hint="계획·활동·기록·건강" />
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

        <section className="life-day-reconstruction">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Day Reconstruction</p>
              <h2>하루 복원 타임라인</h2>
            </div>
            <span>{reconstructionItems.length}개 기록 · 빈 시간 {gapItems.length}개</span>
          </div>
          {reconstructionItems.length > 0 ? (
            <div className="life-day-timeline">
              {[...reconstructionItems, ...gapItems].sort(sortReconstructionItems).map((item) => (
                <article className={`life-day-timeline__item life-day-timeline__item--${item.tone}`} key={item.id}>
                  <span>{item.timeLabel}</span>
                  <div>
                    <b>{item.label}</b>
                    <strong>{item.title}</strong>
                    {item.description ? <p>{item.description}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <NotebookPen aria-hidden size={28} />
              <strong>이 날짜를 복원할 기록이 없습니다.</strong>
              <p>일정·할일·활동·하루기록·사진·건강 중 하나라도 남기면 하루 리포트가 살아납니다.</p>
            </div>
          )}
        </section>

        <div className="life-day-insights">
          {(missingSignals.length > 0 ? missingSignals : ["이 날짜는 기본 기록이 잘 연결되어 있습니다. 사진/메모를 활동에 더 붙이면 AI 질문 답변력이 더 좋아집니다."]).map((signal) => (
            <article key={signal}>
              <span>보강 신호</span>
              <p>{signal}</p>
            </article>
          ))}
        </div>

        <div className="life-report-sections">
          <section>
            <h3>맥락별 연결 묶음</h3>
            {contextBundles.length > 0 ? (
              <div className="life-context-list">
                {contextBundles.map((bundle) => (
                  <button className="life-context-card life-context-card--button" key={bundle.key} onClick={() => setSelectedBundleKey(bundle.key)} type="button">
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
                <strong>{isLoading ? "리포트를 불러오는 중입니다." : "이날 연결된 맥락이 없습니다."}</strong>
                <p>일정, 할 일, 활동에 장소·지출을 넣고 사진과 하루기록을 연결하면 이곳이 채워집니다.</p>
              </div>
            )}
          </section>

          <section>
            <h3>날짜 단독 기록</h3>
            <div className="life-date-only-grid">
              <ReportList title="활동" empty="활동 기록 없음" items={dayActivities.map((activity) => `${formatActivityTime(activity)} · ${activity.title}`)} />
              <ReportList title="하루기록" empty="날짜에만 붙은 하루기록 없음" items={dateOnlyLogs.map((log) => log.content)} />
              <ReportList title="사진/영상" empty="날짜에만 붙은 사진 없음" items={dateOnlyPhotos.map((photo) => photo.caption || photo.fileName)} />
              <ReportList title="지출" empty="맥락 밖 지출 없음" items={dateOnlyExpenses.map((expense) => `${expense.title} · ${formatWon(expense.amount)}`)} />
              <ReportList title="건강" empty="건강 기록 없음" items={[...dayWorkouts.map((workout) => `${workout.type === "running" ? "러닝" : "운동"} · ${formatRunDuration(workout.durationSeconds ?? workout.durationMinutes * 60)}`), ...dayWeights.map((weight) => `아침 몸무게 · ${weight.weightKg}kg`)]} />
            </div>
          </section>
        </div>
      </SectionCard>
      {selectedBundle ? <LifeContextDetailDrawer bundle={selectedBundle} onClose={() => setSelectedBundleKey(null)} onCreateLog={onCreateLog} onUploadPhotos={onUploadPhotos} /> : null}
    </div>
  );
}

function LifeContextDetailDrawer({
  bundle,
  onClose,
  onCreateLog,
  onUploadPhotos,
}: {
  bundle: LifeContextBundle;
  onClose: () => void;
  onCreateLog: (date: string, content: string, linkedTarget?: LifeLinkedTarget) => Promise<void> | void;
  onUploadPhotos: (date: string, uploads: LifeMediaUploadInput[], caption?: string, linkedTarget?: LifeLinkedTarget) => Promise<void> | void;
}) {
  const totalExpense = bundle.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const [quickLog, setQuickLog] = useState("");
  const [caption, setCaption] = useState("");
  const [previews, setPreviews] = useState<LifeMediaPreview[]>([]);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const linkedTarget = { id: bundle.targetId, title: bundle.title, type: bundle.targetType };

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.objectUrl)), [previews]);

  const saveQuickLog = async () => {
    const content = quickLog.trim();
    if (!content) return;
    setIsSavingLog(true);
    try {
      await onCreateLog(bundle.date, content, linkedTarget);
      setQuickLog("");
    } finally {
      setIsSavingLog(false);
    }
  };

  const selectFiles = async (files: File[]) => {
    setUploadError(null);
    previews.forEach((preview) => URL.revokeObjectURL(preview.objectUrl));
    try {
      setPreviews(await Promise.all(files.map(createLifeMediaPreview)));
    } catch (error) {
      console.error("Failed to prepare context media previews", getLifePhotoErrorDebugInfo(error));
      setPreviews([]);
      setUploadError(getLifePhotoUploadErrorMessage(error));
    }
  };

  const uploadPhotos = async () => {
    if (previews.length === 0) return;
    setIsUploading(true);
    try {
      await onUploadPhotos(bundle.date, previews, caption.trim() || undefined, linkedTarget);
      previews.forEach((preview) => URL.revokeObjectURL(preview.objectUrl));
      setPreviews([]);
      setCaption("");
      setUploadError(null);
    } catch (error) {
      console.error("Failed to upload context photos", getLifePhotoErrorDebugInfo(error));
      setUploadError(getLifePhotoUploadErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="life-detail-overlay" role="presentation" onMouseDown={onClose}>
      <aside className="life-detail-drawer" aria-label="맥락 상세" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
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
          <div className="life-detail-capture">
            <textarea placeholder="이 맥락에 하루기록 추가" value={quickLog} onChange={(event) => setQuickLog(event.target.value)} />
            <button disabled={!quickLog.trim() || isSavingLog} onClick={() => void saveQuickLog()} type="button">
              {isSavingLog ? "저장 중" : "기록 추가"}
            </button>
          </div>
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
          <div className="life-detail-capture">
            <label className="life-detail-file-picker">
              <input accept="image/*,video/*" multiple type="file" onChange={(event) => void selectFiles(Array.from(event.target.files ?? []))} />
              <ImagePlus aria-hidden size={18} />
              <span>{previews.length > 0 ? `${previews.length}개 선택됨` : "사진/영상 선택"}</span>
            </label>
            {previews.length > 0 ? (
              <div className="life-detail-media">
                {previews.map((preview) => (
                  <figure key={preview.id}>
                    {preview.mimeType.startsWith("video/") ? <div>{preview.name}</div> : <Image alt={preview.name} height={120} src={preview.objectUrl} unoptimized width={120} />}
                    <figcaption>{formatMediaMeta(preview)}</figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
            <input placeholder="사진 메모" value={caption} onChange={(event) => setCaption(event.target.value)} />
            {uploadError ? <p className="life-photo-upload-error">{uploadError}</p> : null}
            <button disabled={previews.length === 0 || isUploading} onClick={() => void uploadPhotos()} type="button">
              {isUploading ? "업로드 중" : "사진 연결"}
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}

function LifeMonthlyReviewView({
  activities,
  dailyLogs,
  events,
  expenses,
  photos,
  tasks,
  weights,
  workouts,
}: {
  activities: LifeActivityRecord[];
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
  const monthActivities = activities.filter((activity) => activity.date.startsWith(month));
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
  const peopleStats = getTopCounts([...monthEvents.map((event) => event.companions), ...monthTasks.map((task) => task.companions)].flatMap(parseCompanions));
  const placeStats = getTopCounts(monthPlaces.map((place) => place.name));
  const expenseCategoryStats = getTopExpenseCategories(monthExpenses);

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
          <ReportMetric label="기록 밀도" value={`${monthEvents.length + monthTasks.length + monthActivities.length + monthLogs.length + monthPhotos.length}건`} hint={`활동 ${monthActivities.length} · 기록 ${monthLogs.length} · 사진 ${monthPhotos.length}`} />
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

        <div className="life-insight-grid">
          <InsightCard title="자주 함께한 사람" empty="함께한 사람 기록 없음" items={peopleStats.map((item) => `${item.name} · ${item.count}회`)} />
          <InsightCard title="자주 간 장소" empty="장소 기록 없음" items={placeStats.map((item) => `${item.name} · ${item.count}회`)} />
          <InsightCard title="소비 카테고리" empty="지출 기록 없음" items={expenseCategoryStats.map((item) => `${item.name} · ${formatWon(item.amount)}`)} />
        </div>

        <section className="life-report-sections">
          <h3>이번 달 주요 기록</h3>
          <div className="life-date-only-grid">
            <ReportList title="일정/이벤트" empty="일정 없음" items={monthEvents.slice(0, 5).map((event) => `${event.date} · ${event.title}`)} />
            <ReportList title="활동" empty="활동 없음" items={monthActivities.slice(0, 5).map((activity) => `${activity.date} · ${activity.title}`)} />
            <ReportList title="하루기록" empty="기록 없음" items={monthLogs.slice(0, 5).map((log) => `${log.date} · ${log.content}`)} />
            <ReportList title="장소" empty="장소 없음" items={monthPlaces.slice(0, 5).map((place) => place.name)} />
            <ReportList title="사진/영상" empty="사진 없음" items={monthPhotos.slice(0, 5).map((photo) => `${photo.date} · ${photo.caption || photo.fileName}`)} />
          </div>
        </section>
      </SectionCard>
    </div>
  );
}

function InsightCard({ empty, items, title }: { empty: string; items: string[]; title: string }) {
  return (
    <article className="life-insight-card">
      <span>{title}</span>
      {items.length > 0 ? (
        <ol>
          {items.slice(0, 5).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      ) : (
        <p>{empty}</p>
      )}
    </article>
  );
}

function LifeSearchView({
  activities,
  dailyLogs,
  events,
  expenses,
  onOpenDate,
  photos,
  tasks,
  weights,
  workouts,
}: {
  activities: LifeActivityRecord[];
  dailyLogs: DailyLogRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  onOpenDate: (date: string) => void;
  photos: LifePhotoRecord[];
  tasks: TaskItem[];
  weights: WeightRecord[];
  workouts: WorkoutSession[];
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | LifeSearchItem["type"]>("all");
  const items = useMemo(() => buildLifeSearchItems(events, tasks, activities, expenses, dailyLogs, photos, weights, workouts), [activities, dailyLogs, events, expenses, photos, tasks, weights, workouts]);
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
            <option value="activity">활동</option>
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
            <button key={item.id} onClick={() => onOpenDate(item.date)} type="button">
              <span>{item.date} · {item.label}</span>
              <strong>{item.title}</strong>
              {item.description ? <p>{item.description}</p> : null}
              {item.tags.length > 0 ? <em>{item.tags.join(" · ")}</em> : null}
            </button>
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

function LifePeopleView({
  activities,
  dailyLogs,
  events,
  expenses,
  photos,
  tasks,
}: {
  activities: LifeActivityRecord[];
  dailyLogs: DailyLogRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  photos: LifePhotoRecord[];
  tasks: TaskItem[];
}) {
  const people = useMemo(() => buildPeopleSummaries(events, tasks, activities, expenses, dailyLogs, photos), [activities, dailyLogs, events, expenses, photos, tasks]);
  const [selectedName, setSelectedName] = useState("");
  const selectedPerson = people.find((person) => person.name === selectedName) ?? people[0];

  useEffect(() => {
    if (!selectedName && people[0]) setSelectedName(people[0].name);
    if (selectedName && !people.some((person) => person.name === selectedName)) setSelectedName(people[0]?.name ?? "");
  }, [people, selectedName]);

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="사람" description="일정과 할 일의 함께한 사람을 기준으로, 누구와 어디서 무엇을 했는지 다시 보는 관계 축입니다." />
      <div className="life-people-view">
        <SectionCard className="life-people-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">관계 인덱스</p>
              <h2>{people.length}명</h2>
            </div>
          </div>
          {people.length > 0 ? (
            <div className="life-person-buttons">
              {people.map((person) => (
                <button className={selectedPerson?.name === person.name ? "life-person-button life-person-button--active" : "life-person-button"} key={person.name} onClick={() => setSelectedName(person.name)} type="button">
                  <strong>{person.name}</strong>
                  <span>{person.items.length}회 · {person.places.length}곳 · {formatWon(person.expenseTotal)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <NotebookPen aria-hidden size={28} />
              <strong>아직 함께한 사람 기록이 없습니다.</strong>
              <p>캘린더에서 일정이나 할 일에 함께한 사람을 입력하면 이곳에 자동으로 모입니다.</p>
            </div>
          )}
        </SectionCard>

        <SectionCard className="life-people-detail">
          {selectedPerson ? (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">사람 상세</p>
                  <h2>{selectedPerson.name}</h2>
                </div>
                <strong className="life-places-count">{selectedPerson.items.length}회</strong>
              </div>
              <div className="life-report-metrics">
                <ReportMetric label="함께한 횟수" value={`${selectedPerson.items.length}회`} hint="일정·할일 기준" />
                <ReportMetric label="함께 간 장소" value={`${selectedPerson.places.length}곳`} hint={selectedPerson.places[0] ?? "장소 없음"} />
                <ReportMetric label="연결 지출" value={selectedPerson.expenseTotal > 0 ? formatWon(selectedPerson.expenseTotal) : "-"} hint={`${selectedPerson.expenses.length}건`} />
                <ReportMetric label="사진/기록" value={`${selectedPerson.photos.length + selectedPerson.logs.length}개`} hint={`사진 ${selectedPerson.photos.length} · 기록 ${selectedPerson.logs.length}`} />
              </div>
              <div className="life-search-results">
                {selectedPerson.items.map((item) => (
                  <button key={item.id} type="button">
                    <span>{item.date} · {item.label}</span>
                    <strong>{item.title}</strong>
                    {item.description ? <p>{item.description}</p> : null}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <NotebookPen aria-hidden size={28} />
              <strong>사람을 선택해 주세요.</strong>
              <p>함께한 사람 기록이 쌓이면 관계별 타임라인을 볼 수 있습니다.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function LifeActivitiesView({
  activities,
  onDeleteActivity,
  onSaveActivity,
}: {
  activities: LifeActivityRecord[];
  onDeleteActivity: (id: string) => Promise<void> | void;
  onSaveActivity: (activity: LifeActivityRecord) => Promise<void> | void;
}) {
  const [editing, setEditing] = useState<LifeActivityRecord | null>(null);
  const [date, setDate] = useState(formatDateKey(new Date()));
  const [category, setCategory] = useState("기타");
  const [hasTime, setHasTime] = useState(true);
  const [hasEndTime, setHasEndTime] = useState(false);
  const [startTime, setStartTime] = useState(getDefaultActivityTime());
  const [endTime, setEndTime] = useState("");
  const [title, setTitle] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [placeAddress, setPlaceAddress] = useState("");
  const [companions, setCompanions] = useState("");
  const [food, setFood] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selectedActivities = activities.filter((activity) => activity.date === date).sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"));
  const selectedExpenseTotal = selectedActivities.reduce((sum, activity) => sum + (activity.expenseAmount ?? 0), 0);
  const selectedCoveredMinutes = selectedActivities.reduce((sum, activity) => sum + getActivityDurationMinutes(activity), 0);

  const resetForm = () => {
    setEditing(null);
    setCategory("기타");
    setHasTime(true);
    setHasEndTime(false);
    setStartTime(getDefaultActivityTime());
    setEndTime("");
    setTitle("");
    setPlaceName("");
    setPlaceAddress("");
    setCompanions("");
    setFood("");
    setExpenseAmount("");
    setMemo("");
    setFormError("");
  };

  const editActivity = (activity: LifeActivityRecord) => {
    setEditing(activity);
    setDate(activity.date);
    setCategory(activity.category ?? "기타");
    setHasTime(Boolean(activity.startTime));
    setHasEndTime(Boolean(activity.endTime));
    setStartTime(activity.startTime ?? getDefaultActivityTime());
    setEndTime(activity.endTime ?? "");
    setTitle(activity.title);
    setPlaceName(activity.placeName ?? "");
    setPlaceAddress(activity.placeAddress ?? "");
    setCompanions(activity.companions ?? "");
    setFood(activity.food ?? "");
    setExpenseAmount(activity.expenseAmount ? String(activity.expenseAmount) : "");
    setMemo(activity.memo ?? "");
  };

  const saveActivity = async () => {
    if (!title.trim()) return;
    if (hasTime && hasEndTime && startTime && endTime && endTime < startTime) {
      setFormError("종료 시간은 시작 시간보다 늦어야 합니다.");
      return;
    }

    setIsSaving(true);
    setFormError("");
    setMessage("");
    try {
      await onSaveActivity({
        id: editing?.id ?? `activity-${Date.now()}`,
        date,
        startTime: hasTime ? startTime || undefined : undefined,
        endTime: hasTime && hasEndTime ? endTime || undefined : undefined,
        isAllDay: !hasTime,
        title: title.trim(),
        category,
        placeName: placeName.trim() || undefined,
        placeAddress: placeAddress.trim() || undefined,
        companions: companions.trim() || undefined,
        food: food.trim() || undefined,
        expenseAmount: expenseAmount ? Number(expenseAmount) : undefined,
        memo: memo.trim() || undefined,
      });
      setMessage(editing ? "활동 기록을 수정했어요." : "활동 기록을 저장했어요.");
      resetForm();
    } catch (error) {
      console.error("Failed to save life activity", error);
      setFormError(getLifeActionErrorMessage(error, "활동 기록을 저장하지 못했습니다."));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteActivity = async (activity: LifeActivityRecord) => {
    setDeletingActivityId(activity.id);
    setFormError("");
    setMessage("");
    try {
      await onDeleteActivity(activity.id);
      if (editing?.id === activity.id) resetForm();
      setMessage("활동 기록을 삭제했어요.");
    } catch (error) {
      console.error("Failed to delete life activity", error);
      setFormError(getLifeActionErrorMessage(error, "활동 기록을 삭제하지 못했습니다."));
    } finally {
      setDeletingActivityId(null);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="활동 기록" description="공백 없는 하루를 만들기 위한 실제 행동 단위입니다. 몇 시부터 어디서 무엇을 했고, 누구와 있었고, 뭘 먹고 얼마를 썼는지 남깁니다." />
      <div className="life-activity-layout">
        <SectionCard className="life-activity-form">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Actual Day Block</p>
              <h2>{editing ? "활동 수정" : "활동 추가"}</h2>
            </div>
            {editing ? <button onClick={resetForm} type="button">새 기록</button> : null}
          </div>

          <div className="event-form-card event-form-card--title">
            <label>
              <span>무엇을 했나</span>
              <input placeholder="예: 점심 먹고 성수동 산책" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
          </div>

          <div className="schedule-form-section-title">
            <strong>활동 유형</strong>
            <span>나중에 AI가 하루 패턴을 읽는 태그입니다.</span>
          </div>
          <div className="life-activity-template-grid">
            {ACTIVITY_CATEGORIES.map((item) => (
              <button className={category === item ? "life-activity-template life-activity-template--active" : "life-activity-template"} key={item} onClick={() => setCategory(item)} type="button">
                {item}
              </button>
            ))}
          </div>

          <div className="schedule-form-section-title">
            <strong>날짜와 시간</strong>
            <span>공백 없는 하루 복원의 핵심입니다.</span>
          </div>
          <div className="event-form-card schedule-form-card schedule-form-card--grid schedule-time-grid">
            <label className="event-form-row event-form-row--field schedule-field">
              <span>기록 날짜</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label className="event-form-row event-form-row--field schedule-field">
              <span>시작 시간</span>
              <input disabled={!hasTime} type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </label>
            {hasEndTime ? (
              <label className="event-form-row event-form-row--field schedule-field">
                <span>종료 시간</span>
                <input disabled={!hasTime} type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
              </label>
            ) : null}
            <div className="event-form-row event-form-row--field schedule-field schedule-toggle-row">
              <span>시간 옵션</span>
              <div className="schedule-option-toggle-group">
                <label className="schedule-option-toggle">
                  <input checked={!hasTime} onChange={(event) => {
                    setHasTime(!event.target.checked);
                    if (event.target.checked) {
                      setHasEndTime(false);
                      setEndTime("");
                    }
                  }} type="checkbox" />
                  시간 미정
                </label>
                <label className="schedule-option-toggle">
                  <input checked={hasEndTime} disabled={!hasTime} onChange={(event) => {
                    setHasEndTime(event.target.checked);
                    if (!event.target.checked) setEndTime("");
                  }} type="checkbox" />
                  종료시간 설정
                </label>
              </div>
            </div>
          </div>

          <div className="schedule-form-section-title">
            <strong>장소와 사람</strong>
            <span>어디서 누구와 있었는지 남깁니다.</span>
          </div>
          <div className="event-form-card schedule-form-card schedule-form-card--grid">
            <label className="event-form-row event-form-row--field schedule-field">
              <span>장소명</span>
              <input placeholder="예: 성수동 카페" value={placeName} onChange={(event) => setPlaceName(event.target.value)} />
            </label>
            <label className="event-form-row event-form-row--field schedule-field">
              <span>주소/동선 메모</span>
              <input placeholder="예: 서울숲 근처" value={placeAddress} onChange={(event) => setPlaceAddress(event.target.value)} />
            </label>
            <label className="event-form-row event-form-row--field schedule-field">
              <span>함께한 사람</span>
              <input placeholder="쉼표로 구분" value={companions} onChange={(event) => setCompanions(event.target.value)} />
            </label>
          </div>

          <div className="schedule-form-section-title">
            <strong>먹은 것과 지출</strong>
            <span>활동에서 발생한 소비도 가계부로 이어집니다.</span>
          </div>
          <div className="event-form-card schedule-form-card schedule-form-card--grid">
            <label className="event-form-row event-form-row--field schedule-field">
              <span>먹은 것</span>
              <input placeholder="예: 라멘, 커피" value={food} onChange={(event) => setFood(event.target.value)} />
            </label>
            <label className="event-form-row event-form-row--field schedule-field">
              <span>지출</span>
              <input inputMode="numeric" placeholder="0" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value.replace(/[^\d]/g, ""))} />
            </label>
            <label className="event-form-row event-form-row--field schedule-field">
              <span>메모</span>
              <textarea placeholder="짧은 맥락이나 감정" value={memo} onChange={(event) => setMemo(event.target.value)} />
            </label>
          </div>

          {formError ? <p className="life-photo-upload-error">{formError}</p> : null}
          {message ? <p className="life-health-message">{message}</p> : null}
          <button className="life-ask-submit" disabled={!title.trim() || isSaving} onClick={() => void saveActivity()} type="button">
            {isSaving ? "저장 중" : editing ? "활동 저장" : "활동 추가"}
          </button>
        </SectionCard>

        <SectionCard className="life-activity-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Selected Day</p>
              <h2>{date} 활동 {selectedActivities.length}개</h2>
            </div>
          </div>
          <div className="life-activity-day-summary">
            <article>
              <span>기록 시간</span>
              <strong>{selectedCoveredMinutes > 0 ? `${Math.round(selectedCoveredMinutes / 60 * 10) / 10}시간` : "-"}</strong>
            </article>
            <article>
              <span>활동 지출</span>
              <strong>{selectedExpenseTotal > 0 ? formatWon(selectedExpenseTotal) : "-"}</strong>
            </article>
            <article>
              <span>연결 밀도</span>
              <strong>{selectedActivities.filter((activity) => activity.placeName || activity.companions || activity.food || activity.memo).length}/{selectedActivities.length}</strong>
            </article>
          </div>
          {selectedActivities.length > 0 ? selectedActivities.map((activity) => (
            <article className="life-activity-item" key={activity.id}>
              <div>
                <span>{formatActivityTime(activity)} · {activity.category ?? "활동"}</span>
                <strong>{activity.title}</strong>
                <p>{[activity.placeName, activity.companions ? `함께 · ${activity.companions}` : null, activity.food ? `음식 · ${activity.food}` : null, activity.expenseAmount ? formatWon(activity.expenseAmount) : null].filter(Boolean).join(" · ")}</p>
              </div>
              <div className="life-record-actions">
                <button onClick={() => editActivity(activity)} type="button">수정</button>
                <button disabled={deletingActivityId === activity.id} onClick={() => void deleteActivity(activity)} type="button">
                  {deletingActivityId === activity.id ? "삭제 중" : "삭제"}
                </button>
              </div>
            </article>
          )) : (
            <div className="life-map-empty life-map-empty--compact">
              <NotebookPen aria-hidden size={28} />
              <strong>이 날짜의 활동 기록이 없습니다.</strong>
              <p>공백 없는 하루를 만들려면 작은 행동도 활동으로 남겨보세요.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function LifeAskView({
  activities,
  dailyLogs,
  events,
  expenses,
  photos,
  tasks,
  weights,
  workouts,
}: {
  activities: LifeActivityRecord[];
  dailyLogs: DailyLogRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  photos: LifePhotoRecord[];
  tasks: TaskItem[];
  weights: WeightRecord[];
  workouts: WorkoutSession[];
}) {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [question, setQuestion] = useState("나 3월달에 자주 했던 일과 그때의 소비, 사람, 건강 흐름이 어땠어?");
  const records = useMemo(() => buildLifeSearchItems(events, tasks, activities, expenses, dailyLogs, photos, weights, workouts), [activities, dailyLogs, events, expenses, photos, tasks, weights, workouts]);
  const scopedRecords = useMemo(() => selectRelevantLifeAskRecords(question, records), [question, records]);

  const askLifeDb = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) return;

    try {
      setIsAsking(true);
      setError("");
      setAnswer("");
      const response = await fetch("/api/life/ask", {
        body: JSON.stringify({
          question: trimmedQuestion,
          records: scopedRecords.map((record) => ({
            date: record.date,
            description: record.description,
            label: record.label,
            tags: record.tags,
            title: record.title,
            type: record.type,
          })),
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "AI 질문 처리에 실패했습니다.");
      setAnswer(data.answer ?? "");
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : "AI 질문 처리 중 오류가 발생했습니다.");
    } finally {
      setIsAsking(false);
    }
  };

  const examples = ["지난달에 누구를 가장 자주 만났고 돈은 어디에 많이 썼어?", "3월에 운동한 날과 소비가 어떤 관계가 있었어?", "최근에 자주 간 장소와 그때 했던 일을 요약해줘"];

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="AI 질문" description="쌓인 일정, 할 일, 하루기록, 사진, 장소, 지출, 건강 기록을 근거로 자연어 질문에 답합니다." />
      <div className="life-ask-layout">
        <SectionCard className="life-ask-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Life DB Copilot</p>
              <h2>내 기록에 질문하기</h2>
            </div>
            <strong className="life-places-count">{scopedRecords.length}/{records.length}건</strong>
          </div>
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="예: 나 3월달에 부산 갔던 것 같은데 그때 어땠어?" />
          <div className="life-ask-examples">
            {examples.map((example) => (
              <button key={example} onClick={() => setQuestion(example)} type="button">
                {example}
              </button>
            ))}
          </div>
          <button className="life-ask-submit" disabled={isAsking || !question.trim()} onClick={() => void askLifeDb()} type="button">
            {isAsking ? "기록 읽는 중..." : "AI에게 물어보기"}
          </button>
          {error ? <p className="life-ask-error">{error}</p> : null}
        </SectionCard>

        <SectionCard className="life-ask-answer">
          <p className="eyebrow">Answer</p>
          {answer ? (
            <div className="life-ask-answer__body">{answer}</div>
          ) : (
            <div className="life-map-empty life-map-empty--compact">
              <Search aria-hidden size={28} />
              <strong>아직 질문하지 않았습니다.</strong>
              <p>AI 답변은 현재 불러온 라이프 DB 기록만 근거로 생성됩니다. 더 정교하게 하려면 다음 단계에서 월별 인덱스와 임베딩 검색을 붙이면 됩니다.</p>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

function LifeLogsView({
  activities,
  logs,
  onCreateLog,
  onDeleteLog,
  onUpdateLog,
}: {
  activities: LifeActivityRecord[];
  logs: DailyLogRecord[];
  onCreateLog: (date: string, content: string, linkedTarget?: LifeLinkedTarget) => Promise<void> | void;
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
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selectedLogs = logs.filter((log) => log.date === date);
  const linkedTargetOptions = useMemo(() => getPhotoLinkedTargetOptions(date, events, tasks, activities), [activities, date, events, tasks]);
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
    setFormError("");
    setMessage("");
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
      setMessage(editingLogId ? "하루기록을 수정했어요." : "하루기록을 저장했어요.");
    } catch (error) {
      console.error("Failed to save daily log", error);
      setFormError(getLifeActionErrorMessage(error, "하루기록을 저장하지 못했습니다."));
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
    setFormError("");
    setMessage("");
    try {
      await onDeleteLog(id);
      if (editingLogId === id) {
        setEditingLogId(null);
        setContent("");
        setLinkedTargetKey("");
      }
      setMessage("하루기록을 삭제했어요.");
    } catch (error) {
      console.error("Failed to delete daily log", error);
      setFormError(getLifeActionErrorMessage(error, "하루기록을 삭제하지 못했습니다."));
    } finally {
      setDeletingLogId(null);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="하루기록" description="날짜나 일정·할일·활동에 연결해두면 하루 리포트와 해당 날짜 타임라인에서 함께 조회됩니다." />
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
          {formError ? <p className="life-photo-upload-error">{formError}</p> : null}
          {message ? <p className="life-health-message">{message}</p> : null}
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
  activities,
  onDeletePhoto,
  onUploadPhotos,
  photos,
}: {
  activities: LifeActivityRecord[];
  onDeletePhoto: (photo: LifePhotoRecord) => Promise<void> | void;
  onUploadPhotos: (date: string, uploads: LifeMediaUploadInput[], caption?: string, linkedTarget?: LifeLinkedTarget) => Promise<void> | void;
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
  const [message, setMessage] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const selectedPhotos = photos.filter((photo) => photo.date === date);
  const linkedTargetOptions = useMemo(() => getPhotoLinkedTargetOptions(date, events, tasks, activities), [activities, date, events, tasks]);
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
    setMessage("");
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
    setMessage("");
    try {
      await onUploadPhotos(date, previews, caption.trim() || undefined, linkedTarget ? { id: linkedTarget.id, title: linkedTarget.title, type: linkedTarget.type } : undefined);
      previews.forEach((preview) => URL.revokeObjectURL(preview.objectUrl));
      setPreviews([]);
      setCaption("");
      setLinkedTargetKey("");
      setUploadError(null);
      setMessage("사진/영상을 업로드했어요.");
    } catch (error) {
      console.error("Failed to upload life photos", getLifePhotoErrorDebugInfo(error));
      setUploadError(getLifePhotoUploadErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const deletePhoto = async (photo: LifePhotoRecord) => {
    setDeletingPhotoId(photo.id);
    setMessage("");
    setUploadError(null);
    try {
      await onDeletePhoto(photo);
      setMessage("사진/영상을 삭제했어요.");
    } catch (error) {
      console.error("Failed to delete life photo", getLifePhotoErrorDebugInfo(error));
      setUploadError(getLifePhotoUploadErrorMessage(error));
    } finally {
      setDeletingPhotoId(null);
    }
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="사진" description="사진과 영상을 날짜나 일정·할일·활동에 연결하고, 사진 탭과 하루 리포트에서 함께 조회합니다." />
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
          {message ? <p className="life-health-message">{message}</p> : null}
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

function getLifeActionErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (message) return message;

  const detail = getLifePhotoErrorDebugInfo(error);
  return detail && detail !== "{}" ? `${fallback} ${detail}` : fallback;
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
      <LifeTabHeading title="건강" description="러닝과 아침 몸무게를 저장하면 건강 탭과 하루 리포트의 해당 날짜 타임라인에 함께 표시됩니다." />
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

function getDefaultActivityTime() {
  const now = new Date();
  now.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

function LifePlacesView() {
  const [activities, setActivities] = useState<LifeActivityRecord[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(formatDateKey(new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchCalendarEventsFromDb(), fetchTasksFromDb(), fetchLifeActivitiesFromDb()])
      .then(([dbEvents, dbTasks, dbActivities]) => {
        if (!isMounted) return;
        setEvents(dbEvents ?? []);
        setTasks(dbTasks ?? []);
        setActivities(dbActivities ?? []);
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
    const grouped = new Map<string, LifePlaceRef[]>();
    for (const event of events) {
      if (!event.place) continue;
      for (const date of expandDateRange(event.date, event.endDate)) {
        grouped.set(date, uniqueLifePlaceRefs([...(grouped.get(date) ?? []), event.place]));
      }
    }
    for (const task of tasks) {
      if (!task.place) continue;
      for (const date of expandDateRange(task.scheduledDate, task.dueDate)) {
        grouped.set(date, uniqueLifePlaceRefs([...(grouped.get(date) ?? []), task.place]));
      }
    }
    for (const activity of activities) {
      const place = getActivityPlaceRef(activity);
      if (!place) continue;
      grouped.set(activity.date, uniqueLifePlaceRefs([...(grouped.get(activity.date) ?? []), place]));
    }
    return grouped;
  }, [activities, events, tasks]);
  const selectedPlaces = placesByDate.get(selectedDate) ?? [];
  const selectedMappablePlaces = selectedPlaces.filter(hasPlanPlaceCoordinates);

  const moveMonth = (direction: -1 | 1) => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
    setCurrentMonth(nextMonth);
    setSelectedDate(formatDateKey(nextMonth));
  };

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="장소" description="일정, 할 일, 활동에 연결된 장소를 날짜별 동선으로 확인하세요." />

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

          {selectedMappablePlaces.length > 0 ? (
            <SelectedDatePlacesMap places={selectedMappablePlaces} />
          ) : selectedPlaces.length > 0 ? (
            <div className="schedule-date-map schedule-date-map--empty">
              <button className="schedule-date-map__toggle" type="button">
                <span>
                  <MapPin aria-hidden size={18} />
                  지도 연결 전 장소
                </span>
                <strong>{selectedPlaces.length}곳</strong>
              </button>
              <p>활동기록의 장소는 아직 좌표가 없어 목록으로만 보여줍니다. 나중에 장소 보관함과 연결하면 지도에도 올릴 수 있습니다.</p>
            </div>
          ) : (
            <SelectedDatePlacesMap places={[]} />
          )}

          {selectedPlaces.length > 0 ? (
            <div className="life-place-card__items">
              {selectedPlaces.map((place) => (
                <article className="life-place-event" key={`${place.providerPlaceId ?? ""}-${place.name}-${place.latitude ?? "text"}-${place.longitude ?? "only"}`}>
                  <span>{hasPlanPlaceCoordinates(place) ? "지도 장소" : "텍스트 장소"}</span>
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
              <p>일정, 할 일, 활동기록에 장소를 추가하면 이곳에 날짜별 장소가 모입니다.</p>
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

function LifeMapView() {
  const [activities, setActivities] = useState<LifeActivityRecord[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchCalendarEventsFromDb(), fetchTasksFromDb(), fetchLifeActivitiesFromDb(), fetchExpenseRecordsFromDb(), fetchWeightRecordsFromDb(), fetchWorkoutSessionsFromDb()])
      .then(([dbEvents, dbTasks, dbActivities, dbExpenses, dbWeights, dbWorkouts]) => {
        if (!isMounted) return;
        setEvents(dbEvents ?? []);
        setTasks(dbTasks ?? []);
        setActivities(dbActivities ?? []);
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

  const timelineItems = useMemo(() => buildPlaceTimeline(events, tasks, activities), [activities, events, tasks]);
  const groups = useMemo(() => groupTimelineByPlace(timelineItems), [timelineItems]);
  const unlinkedCount = expenses.length + weights.length + workouts.length + activities.filter((activity) => !activity.placeName).length;

  return (
    <div className="life-map-view">
      <section className="life-map-hero">
        <div>
          <MapPin aria-hidden size={22} />
          <h2>장소축 라이프</h2>
          <p>장소가 연결된 일정, 할 일, 활동을 모아서 어디에서 무엇이 있었는지 확인합니다.</p>
        </div>
      </section>

      <section className="life-map-coverage" aria-label="장소축 연결 상태">
        <article>
          <span>장소 연결됨</span>
          <strong>{timelineItems.length}건</strong>
          <p>일정, 이벤트, 할 일, 활동</p>
        </article>
        <article>
          <span>장소 연결 필요</span>
          <strong>{unlinkedCount}건</strong>
          <p>장소 없는 활동, 가계부, 운동, 몸무게</p>
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
          <p>일정, 할 일, 활동에 장소를 추가하면 이 화면에서 장소별 타임라인으로 묶어 볼 수 있습니다.</p>
        </SectionCard>
      )}
    </div>
  );
}
