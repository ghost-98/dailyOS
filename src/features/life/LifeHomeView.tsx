"use client";

import Link from "next/link";
import { Activity, CalendarDays, Camera, HeartPulse, LoaderCircle, NotebookPen, Sparkles, Target, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { fetchCalendarEventsFromDb } from "@/features/calendar/api";
import type { CalendarEvent } from "@/features/calendar/data";
import { formatDateKey } from "@/features/life/dateTime";
import { formatWon } from "@/features/life/formatters";
import { buildPeopleSummaries, getTopCounts, getTopExpenseCategories } from "@/features/life/insights";
import { fetchExpenseRecordsFromDb } from "@/features/ledger/api";
import { fetchDailyLogsFromDb, fetchLifeActivitiesFromDb, fetchLifePhotoMetadataFromDb } from "@/features/life/api";
import { fetchTasksFromDb } from "@/features/tasks/api";
import type { DailyLogRecord, ExpenseRecord, LifeActivityRecord, LifePhotoRecord, TaskItem, WeightRecord, WorkoutSession } from "@/types/domain";
import { fetchWeightRecordsFromDb, fetchWorkoutSessionsFromDb } from "../health/api";

type LifeHomeSnapshot = {
  activities: LifeActivityRecord[];
  events: CalendarEvent[];
  expenses: ExpenseRecord[];
  logs: DailyLogRecord[];
  photos: LifePhotoRecord[];
  tasks: TaskItem[];
  weights: WeightRecord[];
  workouts: WorkoutSession[];
};

const dashboardCards = [
  {
    description: "날짜별로 계획, 활동, 사진, 지출, 건강을 한 화면에서 묶어 봅니다.",
    href: "/life/calendar",
    icon: CalendarDays,
    label: "전체 구조",
    title: "라이프 캘린더",
  },
  {
    description: "원하는 날짜와 기간을 잡고, 그동안의 흐름을 라이프 캘린더에서 바로 읽습니다.",
    href: "/life/calendar",
    icon: Target,
    label: "기간 보기",
    title: "기간 탐색",
  },
  {
    description: "함께한 사람을 관리하고, 관계 기록이 어떤 장소와 지출 맥락으로 쌓였는지 봅니다.",
    href: "/life/people",
    icon: Sparkles,
    label: "사람 관리",
    title: "관계 축",
  },
  {
    description: "누구와 시간을 썼는지, 어떤 장소와 지출 맥락이 붙는지 확인합니다.",
    href: "/life/people",
    icon: UserRound,
    label: "관계",
    title: "사람",
  },
];

const captureLinks = [
  { href: "/life/activities", icon: Activity, label: "활동 기록", title: "실제 삶을 남기는 기본 입력" },
  { href: "/life/plans", icon: CalendarDays, label: "계획 입력", title: "일정·할 일·이벤트 정리" },
  { href: "/life/logs", icon: NotebookPen, label: "하루기록", title: "의미와 감정, 메모 보강" },
  { href: "/life/photos", icon: Camera, label: "사진·영상", title: "증거와 장면 연결" },
  { href: "/life/health", icon: HeartPulse, label: "건강", title: "몸 상태와 운동 축 보강" },
];

async function loadLifeHomeSnapshot(): Promise<LifeHomeSnapshot> {
  const [events, tasks, expenses, activities, logs, photos, weights, workouts] = await Promise.all([
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
    events: events ?? [],
    expenses: expenses ?? [],
    logs: logs ?? [],
    photos: photos ?? [],
    tasks: tasks ?? [],
    weights: weights ?? [],
    workouts: workouts ?? [],
  };
}

export function LifeHomeView() {
  const [snapshot, setSnapshot] = useState<LifeHomeSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    loadLifeHomeSnapshot()
      .then((data) => {
        if (isMounted) setSnapshot(data);
      })
      .catch((error) => console.error("Failed to load life home snapshot", error))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const summary = useMemo(() => {
    const empty: LifeHomeSummary = {
      activityEvidenceRate: 0,
      activityPlaceRate: 0,
      categorySummaries: [],
      daysRecoveredLast30: 0,
      latestRecordDate: undefined,
      linkedLogRate: 0,
      linkedPhotoRate: 0,
      orphanLogs: 0,
      orphanPhotos: 0,
      overduePlanCount: 0,
      peopleSummaries: [],
      placeSummaries: [],
      recordsLast30: 0,
      totalActivities: 0,
      totalRecords: 0,
      uncoveredActivities: 0,
      weekActivityCount: 0,
      weekExpenseTotal: 0,
    };

    if (!snapshot) return empty;

    const { activities, events, expenses, logs, photos, tasks, weights, workouts } = snapshot;
    const today = new Date();
    const last30DateKey = shiftDateKey(today, -29);
    const last7DateKey = shiftDateKey(today, -6);

    const actualRecordDates = new Set<string>([
      ...activities.map((item) => item.date),
      ...logs.map((item) => item.date),
      ...photos.map((item) => item.date),
      ...expenses.map((item) => item.date),
      ...weights.map((item) => item.date),
      ...workouts.map((item) => item.date),
    ]);

    const allDates = [
      ...actualRecordDates,
      ...events.map((item) => item.date),
      ...tasks.map((item) => item.scheduledDate),
    ].filter(Boolean);

    const latestRecordDate = allDates.sort((a, b) => b.localeCompare(a))[0];
    const recordsLast30 = countDatesSince(actualRecordDates, last30DateKey);
    const weekActivityCount = activities.filter((item) => item.date >= last7DateKey).length;
    const weekExpenseTotal = expenses.filter((item) => item.date >= last7DateKey).reduce((sum, item) => sum + item.amount, 0);

    const peopleSummaries = buildPeopleSummaries(events, tasks, activities, expenses, logs, photos).slice(0, 4);
    const placeSummaries = getTopCounts(
      [
        ...activities.map((item) => item.placeName),
        ...events.map((item) => item.place?.name),
        ...tasks.map((item) => item.place?.name),
      ].filter((value): value is string => Boolean(value)),
    ).slice(0, 5);
    const categorySummaries = getTopExpenseCategories(expenses).slice(0, 4);

    const activitiesWithPlace = activities.filter((item) => Boolean(item.placeName)).length;
    const activitiesWithEvidence = activities.filter(
      (item) =>
        Boolean(item.memo?.trim()) ||
        Boolean(item.food?.trim()) ||
        Boolean(item.companions?.trim()) ||
        Boolean(item.expenseAmount && item.expenseAmount > 0) ||
        logs.some((log) => log.linkedTargetType === "activity" && log.linkedTargetId === item.id) ||
        photos.some((photo) => photo.linkedTargetType === "activity" && photo.linkedTargetId === item.id),
    ).length;

    const orphanLogs = logs.filter((item) => !item.linkedTargetId || !item.linkedTargetType).length;
    const orphanPhotos = photos.filter((item) => !item.linkedTargetId || !item.linkedTargetType).length;
    const uncoveredActivities = activities.filter(
      (item) =>
        !item.placeName &&
        !item.memo?.trim() &&
        !item.food?.trim() &&
        !item.companions?.trim() &&
        !item.expenseAmount &&
        !logs.some((log) => log.linkedTargetType === "activity" && log.linkedTargetId === item.id) &&
        !photos.some((photo) => photo.linkedTargetType === "activity" && photo.linkedTargetId === item.id),
    ).length;

    const overduePlanCount =
      tasks.filter((item) => item.scheduledDate < formatDateKey(today) && item.status !== "done").length +
      events.filter((item) => item.date < formatDateKey(today) && !activities.some((activity) => activity.sourceId === item.id)).length;

    return {
      activityEvidenceRate: getRate(activitiesWithEvidence, activities.length),
      activityPlaceRate: getRate(activitiesWithPlace, activities.length),
      categorySummaries,
      daysRecoveredLast30: recordsLast30,
      latestRecordDate,
      linkedLogRate: getRate(logs.length - orphanLogs, logs.length),
      linkedPhotoRate: getRate(photos.length - orphanPhotos, photos.length),
      orphanLogs,
      orphanPhotos,
      overduePlanCount,
      peopleSummaries,
      placeSummaries,
      recordsLast30,
      totalActivities: activities.length,
      totalRecords: activities.length + events.length + tasks.length + expenses.length + logs.length + photos.length + weights.length + workouts.length,
      uncoveredActivities,
      weekActivityCount,
      weekExpenseTotal,
    };
  }, [snapshot]);

  const actionCards = useMemo(
    () =>
      [
        {
          description: summary.uncoveredActivities > 0 ? `맥락이 얕은 활동 ${summary.uncoveredActivities}개를 먼저 보강하세요.` : "활동에 장소·메모·사진 같은 맥락을 더 붙여두면 복원 가치가 커집니다.",
          href: "/life/activities",
          title: "활동 밀도 높이기",
        },
        {
          description: summary.overduePlanCount > 0 ? `지난 계획 ${summary.overduePlanCount}개가 아직 활동으로 회수되지 않았습니다.` : "미래 계획과 실제 활동의 차이를 주기적으로 정리해두면 DB 해석력이 좋아집니다.",
          href: "/life/plans",
          title: "계획 회수하기",
        },
        {
          description: summary.orphanLogs > 0 ? `연결되지 않은 하루기록 ${summary.orphanLogs}개가 있습니다.` : "하루기록은 날짜만 남기지 말고 활동이나 이벤트에 붙일수록 의미가 살아납니다.",
          href: "/life/logs",
          title: "하루기록 연결하기",
        },
        {
          description: summary.orphanPhotos > 0 ? `연결되지 않은 사진 ${summary.orphanPhotos}개가 있습니다.` : "사진은 활동이나 일정에 붙여야 나중에 기억 복원이 쉬워집니다.",
          href: "/life/photos",
          title: "사진 맥락 보강",
        },
      ].slice(0, 4),
    [summary.orphanLogs, summary.orphanPhotos, summary.overduePlanCount, summary.uncoveredActivities],
  );

  return (
    <div className="life-axis-view">
      <header className="life-db-hero life-db-hero--dashboard">
        <p className="eyebrow">Life Database Command Center</p>
        <h1>검색과 AI 이전에, 내 삶의 구조가 먼저 읽히는 DB 홈</h1>
        <p>
          이 홈은 소개 페이지가 아니라 운영 허브여야 합니다. 어디까지 복원되고 있는지, 누구와 어디에 시간을 쓰는지, 어떤 기록이 아직 약한지 바로 보여주고
          다음 입력 액션까지 이어지게 바꿨습니다.
        </p>

        {isLoading ? (
          <div className="life-db-loading">
            <LoaderCircle aria-hidden className="spin" size={18} />
            <span>라이프 DB 요약을 불러오는 중…</span>
          </div>
        ) : (
          <div className="life-db-hero-metrics">
            <HeroMetric label="총 기록" value={String(summary.totalRecords)} hint={summary.latestRecordDate ? `최근 기록 ${summary.latestRecordDate}` : "아직 기록 없음"} />
            <HeroMetric label="최근 30일 복원일" value={`${summary.daysRecoveredLast30}일`} hint="활동·사진·기록·지출·건강 기준" />
            <HeroMetric label="최근 7일 활동" value={`${summary.weekActivityCount}개`} hint={summary.weekExpenseTotal > 0 ? `연결 지출 ${formatWon(summary.weekExpenseTotal)}` : "지출 연결 없음"} />
            <HeroMetric label="활동 장소 커버리지" value={`${summary.activityPlaceRate}%`} hint="실제 활동에 장소가 붙은 비율" />
          </div>
        )}
      </header>

      <section className="life-db-section">
        <LifeHomeSectionHeading
          title="핵심 대시보드"
          description="DB 탭은 많이 여는 화면이 아니라, 실제로 운영 가치가 큰 화면만 빠르게 들어가게 정리하는 편이 좋습니다."
        />
        <div className="life-db-card-grid">
          {dashboardCards.map((item) => {
            const Icon = item.icon;
            return (
              <Link className="life-db-card life-db-card--dashboard" href={item.href} key={item.title}>
                <span>
                  <Icon aria-hidden size={16} />
                  {item.label}
                </span>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="life-db-section">
        <LifeHomeSectionHeading
          title="지금 이 DB가 주는 가치"
          description="검색이나 AI 없이도 바로 읽혀야 하는 축들입니다. 복원, 관계, 장소, 소비가 먼저 보여야 DB 탭이 살아납니다."
        />
        <div className="life-db-dashboard-grid">
          <SectionCard className="life-db-panel">
            <div className="life-db-panel__header">
              <div>
                <p className="eyebrow">Recovery</p>
                <h2>복원 품질</h2>
              </div>
            </div>
            <div className="life-db-metric-grid">
              <MiniMetric label="활동 맥락 밀도" value={`${summary.activityEvidenceRate}%`} hint="메모·사람·음식·지출·연결 증거" />
              <MiniMetric label="하루기록 연결률" value={`${summary.linkedLogRate}%`} hint={`${summary.orphanLogs}개 미연결`} />
              <MiniMetric label="사진 연결률" value={`${summary.linkedPhotoRate}%`} hint={`${summary.orphanPhotos}개 미연결`} />
              <MiniMetric label="장소 커버리지" value={`${summary.activityPlaceRate}%`} hint={`${summary.totalActivities}개 활동 기준`} />
            </div>
            <Link className="empty-dashboard-link" href="/life/calendar">
              라이프 캘린더 열기
            </Link>
          </SectionCard>

          <SectionCard className="life-db-panel">
            <div className="life-db-panel__header">
              <div>
                <p className="eyebrow">People</p>
                <h2>가장 많이 쌓이는 관계 축</h2>
              </div>
            </div>
            <InsightList
              empty="아직 함께한 사람 데이터가 충분하지 않습니다."
              items={summary.peopleSummaries.map((person) => ({
                meta: `${person.items.length}회 · ${person.places.length}곳${person.expenseTotal > 0 ? ` · ${formatWon(person.expenseTotal)}` : ""}`,
                title: person.name,
              }))}
            />
            <Link className="empty-dashboard-link" href="/life/people">
              사람 관리로 이동
            </Link>
          </SectionCard>

          <SectionCard className="life-db-panel">
            <div className="life-db-panel__header">
              <div>
                <p className="eyebrow">Place</p>
                <h2>장소 축에서 강한 맥락</h2>
              </div>
            </div>
            <InsightList
              empty="아직 장소 데이터가 충분하지 않습니다."
              items={summary.placeSummaries.map((place) => ({
                meta: `${place.count}회 기록`,
                title: place.name,
              }))}
            />
            <Link className="empty-dashboard-link" href="/life/calendar">
              날짜별 장소축 보기
            </Link>
          </SectionCard>

          <SectionCard className="life-db-panel">
            <div className="life-db-panel__header">
              <div>
                <p className="eyebrow">Spend</p>
                <h2>소비 패턴 핵심 축</h2>
              </div>
            </div>
            <InsightList
              empty="아직 연결 지출이 없습니다."
              items={summary.categorySummaries.map((category) => ({
                meta: formatWon(category.amount),
                title: category.name,
              }))}
            />
            <Link className="empty-dashboard-link" href="/life/people">
              관계와 지출 함께 보기
            </Link>
          </SectionCard>
        </div>
      </section>

      <section className="life-db-section">
        <LifeHomeSectionHeading
          title="다음에 정리할 일"
          description="좋은 DB 홈은 상태만 보여주지 않고, 어디를 손대면 가치가 커지는지도 말해줘야 합니다."
        />
        <div className="life-db-action-grid">
          {actionCards.map((item) => (
            <Link className="life-db-action-card" href={item.href} key={item.title}>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="life-db-section">
        <LifeHomeSectionHeading
          title="입력 축 바로가기"
          description="DB의 해석력은 입력 품질에서 시작합니다. 검색과 AI보다 먼저, 실제 기록 축을 꾸준히 채우는 게 더 중요합니다."
        />
        <div className="life-db-card-grid life-db-card-grid--compact">
          {captureLinks.map((item) => {
            const Icon = item.icon;
            return (
              <Link className="life-db-card" href={item.href} key={item.label}>
                <span>
                  <Icon aria-hidden size={16} />
                  입력
                </span>
                <strong>{item.label}</strong>
                <p>{item.title}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function LifeHomeSectionHeading({ description, title }: { description: string; title: string }) {
  return (
    <div className="life-tab-heading">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function HeroMetric({ hint, label, value }: { hint: string; label: string; value: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function MiniMetric({ hint, label, value }: { hint: string; label: string; value: string }) {
  return (
    <article className="life-db-mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{hint}</p>
    </article>
  );
}

function InsightList({ empty, items }: { empty: string; items: Array<{ meta: string; title: string }> }) {
  if (items.length === 0) {
    return <p className="life-db-empty">{empty}</p>;
  }

  return (
    <div className="life-db-insight-list">
      {items.map((item) => (
        <article key={`${item.title}-${item.meta}`}>
          <strong>{item.title}</strong>
          <p>{item.meta}</p>
        </article>
      ))}
    </div>
  );
}

type LifeHomeSummary = {
  activityEvidenceRate: number;
  activityPlaceRate: number;
  categorySummaries: Array<{ amount: number; name: string }>;
  daysRecoveredLast30: number;
  latestRecordDate?: string;
  linkedLogRate: number;
  linkedPhotoRate: number;
  orphanLogs: number;
  orphanPhotos: number;
  overduePlanCount: number;
  peopleSummaries: ReturnType<typeof buildPeopleSummaries>;
  placeSummaries: Array<{ count: number; name: string }>;
  recordsLast30: number;
  totalActivities: number;
  totalRecords: number;
  uncoveredActivities: number;
  weekActivityCount: number;
  weekExpenseTotal: number;
};

function getRate(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function shiftDateKey(date: Date, offsetDays: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + offsetDays);
  return formatDateKey(next);
}

function countDatesSince(dates: Set<string>, startDateKey: string) {
  return [...dates].filter((date) => date >= startDateKey).length;
}
