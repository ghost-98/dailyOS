"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { deleteCalendarEventFromDb, fetchCalendarEventsFromDb, updateCalendarEventInDb } from "@/features/calendar/api";
import { CalendarView } from "@/features/calendar/CalendarView";
import type { ExternalCalendarItem } from "@/features/calendar/types";
import type { CalendarEvent } from "@/features/calendar/data";
import {
  fetchWeightRecordsFromDb,
  fetchWorkoutSessionsFromDb,
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
import { deleteTaskFromDb, fetchTasksFromDb, updateTaskInDb } from "@/features/tasks/api";
import { formatDateKey } from "@/features/life/dateTime";
import { formatWon } from "@/features/life/formatters";
import {
  buildLifeSearchItems,
  selectRelevantLifeAskRecords,
} from "@/features/life/insights";
import type { LifeSearchItem } from "@/features/life/insights";
import type { LifeLinkedTarget } from "@/features/life/linkTargets";
import { LifeHomeView } from "@/features/life/LifeHomeView";
import { LifeActivitiesView } from "@/features/life/views/LifeActivitiesView";
import type { LifeActivityDraft } from "@/features/life/views/LifeActivitiesView";
import { LifeHealthView } from "@/features/life/views/LifeHealthView";
import { LifeLogsView } from "@/features/life/views/LifeLogsView";
import { LifePeopleView } from "@/features/life/views/LifePeopleView";
import { LifePhotosView } from "@/features/life/views/LifePhotosView";
import type { LifeDataMode, LifeViewMode } from "@/features/life/modes";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { formatRunDuration } from "@/features/life/reconstruction";
import type { DailyLogRecord, ExpenseRecord, LifeActivityRecord, LifeMediaUploadInput, LifePhotoRecord, PlanPlace, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";

type LifeViewProps = {
  activityDraft?: LifeActivityDraft;
  initialDate?: string;
  mode: LifeViewMode;
};

export function LifeView({ activityDraft, initialDate, mode }: LifeViewProps) {
  return <div className="life-page">{mode === "home" ? <LifeHomeView /> : <LifeCalendarView activeTab={mode} activityDraft={activityDraft} initialDate={initialDate} />}</div>;
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
  if (mode === "plans") return {};

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

  const [events, tasks, expenses, activities, dailyLogs, lifePhotos, weights, workouts] = await Promise.all([
    fetchCalendarEventsFromDb(),
    fetchTasksFromDb(),
    fetchExpenseRecordsFromDb(),
    fetchLifeActivitiesFromDb(),
    fetchDailyLogsFromDb(),
    fetchLifePhotoMetadataFromDb(),
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

function LifeCalendarView({ activeTab, activityDraft, initialDate }: { activeTab: LifeDataMode; activityDraft?: LifeActivityDraft; initialDate?: string }) {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [activities, setActivities] = useState<LifeActivityRecord[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLogRecord[]>([]);
  const [lifePhotos, setLifePhotos] = useState<LifePhotoRecord[]>([]);
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);

  useEffect(() => {
    let isMounted = true;

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
      .catch((error) => console.error("Failed to load life data from Supabase", error));

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

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
        placeAddress: activity.placeAddress,
        placeName: activity.placeName,
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
    await syncSourceFromActivity(nextActivity);
    setActivities((current) => (exists ? current.map((item) => (item.id === nextActivity.id ? nextActivity : item)) : [nextActivity, ...current]));
    const nextExpenses = await fetchExpenseRecordsFromDb();
    setExpenses(nextExpenses ?? []);
  };

  const deleteActivity = async (id: string) => {
    const targetActivity = activities.find((activity) => activity.id === id);
    await deleteLifeActivityFromDb(id);
    await deleteSourceFromActivity(targetActivity);
    setActivities((current) => current.filter((item) => item.id !== id));
    const nextExpenses = await fetchExpenseRecordsFromDb();
    setExpenses(nextExpenses ?? []);
  };

  const syncSourceFromActivity = async (activity: LifeActivityRecord) => {
    if (!activity.sourceId || !activity.sourceType) return;

    if (activity.sourceType === "todo") {
      const sourceTask = tasks.find((task) => task.id === activity.sourceId);
      if (!sourceTask) return;
      const nextTask = {
        ...sourceTask,
        companions: activity.companions,
        dueDate: activity.date,
        endTime: activity.endTime,
        isAllDay: activity.isAllDay,
        memo: activity.memo,
        place: createPlanPlaceFromActivity(activity, sourceTask.place),
        scheduledDate: activity.date,
        startTime: activity.startTime,
        title: activity.title,
      };
      const savedTask = await updateTaskInDb(nextTask);
      setTasks((current) => current.map((task) => (task.id === sourceTask.id ? savedTask ?? nextTask : task)));
      return;
    }

    const sourceEvent = events.find((event) => event.id === activity.sourceId);
    if (!sourceEvent) return;
    const nextEvent = {
      ...sourceEvent,
      companions: activity.companions,
      date: activity.date,
      endDate: activity.date,
      endTime: activity.endTime,
      isAllDay: activity.isAllDay,
      meta: activity.memo ?? sourceEvent.meta,
      place: createPlanPlaceFromActivity(activity, sourceEvent.place),
      time: activity.startTime,
      title: activity.title,
    };
    const savedEvent = await updateCalendarEventInDb(nextEvent);
    setEvents((current) => current.map((event) => (event.id === sourceEvent.id ? savedEvent ?? nextEvent : event)));
  };

  const deleteSourceFromActivity = async (activity?: LifeActivityRecord) => {
    if (!activity?.sourceId || !activity.sourceType) return;

    if (activity.sourceType === "todo") {
      await deleteTaskFromDb(activity.sourceId);
      setTasks((current) => current.filter((task) => task.id !== activity.sourceId));
      return;
    }

    await deleteCalendarEventFromDb(activity.sourceId);
    setEvents((current) => current.filter((event) => event.id !== activity.sourceId));
  };

  return (
    <div className="life-axis-view">
      {activeTab === "plans" ? (
        <CalendarView
          allowedTypes={["schedule", "event", "todo"]}
          defaultSelectedDate={formatDateKey(new Date())}
          description="미래 계획과 당일 해야 할 일, 중요한 이벤트를 기록하고 관리합니다. 실제로 끝난 것은 활동 기록으로 전환할 수 있습니다."
          headerVariant="tab"
          keepDateSelected
          showEventAddButton
          title="일정·할 일·이벤트"
          viewMode="manage"
        />
      ) : activeTab === "calendar" ? (
        <CalendarView
          allowedTypes={["schedule", "event", "todo"]}
          defaultSelectedDate={initialDate ?? formatDateKey(new Date())}
          description="일정과 할 일을 날짜별로 묶고, 필요한 항목을 바로 추가하세요."
          externalItems={externalItems}
          headerVariant="tab"
          keepDateSelected
          showEventAddButton={false}
          viewMode="database"
          title="라이프 캘린더"
        />
      ) : activeTab === "search" ? (
        <LifeSearchView
          dailyLogs={dailyLogs}
          activities={activities}
          events={events}
          expenses={expenses}
          onOpenDate={(date) => {
            router.push(`/life/calendar?date=${date}`);
          }}
          photos={lifePhotos}
          tasks={tasks}
          weights={weights}
          workouts={workouts}
        />
      ) : activeTab === "people" ? (
        <LifePeopleView activities={activities} dailyLogs={dailyLogs} events={events} expenses={expenses} photos={lifePhotos} tasks={tasks} />
      ) : activeTab === "ask" ? (
        <LifeAskView activities={activities} dailyLogs={dailyLogs} events={events} expenses={expenses} photos={lifePhotos} tasks={tasks} weights={weights} workouts={workouts} />
      ) : activeTab === "activities" ? (
        <LifeActivitiesView activities={activities} initialDraft={activityDraft} onDeleteActivity={deleteActivity} onSaveActivity={saveActivity} />
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

function createPlanPlaceFromActivity(activity: LifeActivityRecord, fallback?: PlanPlace) {
  if (!activity.placeName) return undefined;
  return {
    address: activity.placeAddress ?? fallback?.address ?? "",
    category: fallback?.category,
    latitude: fallback?.latitude ?? 0,
    longitude: fallback?.longitude ?? 0,
    name: activity.placeName,
    phone: fallback?.phone,
    providerPlaceId: fallback?.providerPlaceId,
    url: fallback?.url,
  };
}

