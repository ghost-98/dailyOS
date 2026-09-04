"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Camera, ChevronDown, MapPin, NotebookPen, UsersRound, UtensilsCrossed, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { DayInsightBar } from "@/features/screens/day/components/DayInsightBar";
import { EventCreateSheet, TaskCreateSheet } from "@/features/screens/calendar/components/CalendarCreateSheets";
import { MobileCalendarFrame } from "@/features/screens/calendar/components/MobileCalendarFrame";
import { MonthCalendar } from "@/features/screens/calendar/components/MonthCalendar";
import { LifeCalendarDayPanel as DayCalendarPanel } from "@/features/screens/day/DayCalendarPanel";
import { confirmAction } from "@/lib/actionGuards";
import { getNaverMapClientId, isNaverMapReady, loadNaverMapScript } from "@/lib/naverMap";
import type { NaverLatLng, NaverLatLngBounds, NaverMap, NaverMarker, NaverPolyline } from "@/lib/naverMap";
import type { EventType, TaskItem } from "@/types/domain";
import { createPersonInDb } from "@/features/data/people/api";
import { createTaskInDb, updateTaskInDb } from "@/features/data/tasks/api";
import { useCalendarResources } from "@/features/screens/calendar/hooks/useCalendarResources";
import { deleteLinkedExpenseRecordInDb, syncLinkedExpenseRecordInDb } from "@/features/data/ledger/api";
import { updateLifeActivitiesBySourceInDb } from "@/features/data/records/api";
import { formatWon, getLinkedTargetTypeLabel } from "@/features/records/format/recordFormatters";
import { parseCompanions } from "@/features/records/search/recordsInsights";
import {
  createEventTimelineItem,
  createExternalTimelineItem,
  createTaskTimelineItem,
  getCategories,
  getTimelineTimeLabel,
  getTimelineTypeOrder,
  summarizeDay,
} from "@/features/calendar/calendarViewHelpers";
import { formatDateKey, formatSelectedDate, getMonthDays, isDateInRange } from "@/features/calendar/utils";
import { createCalendarEventInDb, updateCalendarEventInDb } from "@/features/data/calendar/api";
import { categoryLabels } from "@/features/calendar/presentation";
import type { CalendarCategory, DayTimelineItem, ExternalCalendarItem } from "@/features/calendar/types";
import type { CalendarEvent } from "@/features/calendar/data";
import type { DayItemActions } from "@/features/screens/day/dayDetailTypes";
type CalendarViewProps = {
  allowedTypes?: EventType[];
  defaultSelectedDate?: string | null;
  externalItems?: ExternalCalendarItem[];
  dayActions?: DayItemActions;
};

const initialMonth = new Date();
const naverMapClientId = getNaverMapClientId();
const dayRouteGeocodeCache = new Map<string, { latitude: number; longitude: number } | null>();

export function CalendarView(props: CalendarViewProps) {
  return <CalendarViewContent {...props} />;
}

void LifeCalendarDayPanel;

function CalendarViewContent({
  allowedTypes,
  defaultSelectedDate = null,
  externalItems = [],
  dayActions,
}: CalendarViewProps) {
  const categories = useMemo(() => getCategories(allowedTypes), [allowedTypes]);
  const { events, isLoading, people, setEvents, setPeople, setTasks, tasks } = useCalendarResources();
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [isEventSheetOpen, setIsEventSheetOpen] = useState(false);
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(defaultSelectedDate);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const todayKey = useMemo(() => formatDateKey(new Date()), []);
  const activeDate = selectedDate ?? defaultSelectedDate ?? todayKey;
  const visibleEvents = useMemo(() => events.filter((event) => categories.includes(event.type as CalendarCategory)), [categories, events]);
  const monthDays = getMonthDays(currentMonth.getFullYear(), currentMonth.getMonth());
  const selectedEvents = useMemo(() => visibleEvents.filter((event) => isDateInRange(activeDate, event.date, event.endDate) && event.type === "event"), [activeDate, visibleEvents]);
  const selectedTasks = useMemo(() => tasks.filter((task) => isDateInRange(activeDate, task.scheduledDate, task.dueDate)), [activeDate, tasks]);
  const selectedExternalItems = useMemo(() => externalItems.filter((item) => item.date === activeDate), [activeDate, externalItems]);
  const selectedTimelineItems = useMemo(
    () =>
      [
        ...selectedTasks.map((task) => createTaskTimelineItem(task)),
        ...selectedEvents.map((event) => createEventTimelineItem(event)),
        ...selectedExternalItems.map((external) => createExternalTimelineItem(external)),
      ].sort((first, second) => first.sortMinutes - second.sortMinutes || getTimelineTypeOrder(first.type) - getTimelineTypeOrder(second.type)),
    [selectedEvents, selectedExternalItems, selectedTasks],
  );
  const monthCalendarCounts = useMemo(() => {
    const counts = new Map<string, number>();
    monthDays.forEach((cell) => {
      if (!cell.date) return;
      const dayEvents = visibleEvents.filter((event) => isDateInRange(cell.date as string, event.date, event.endDate));
      const dayTasks = tasks.filter((task) => isDateInRange(cell.date as string, task.scheduledDate, task.dueDate));
      const dayExternalItems = externalItems.filter((item) => item.date === cell.date);
      counts.set(cell.date, summarizeDay(dayEvents, dayTasks, categories, dayExternalItems).totalCount);
    });
    return counts;
  }, [categories, externalItems, monthDays, tasks, visibleEvents]);

  const moveMonth = (direction: -1 | 1) => {
    setCurrentMonth((month) => {
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + direction, 1);
      setSelectedDate(formatDateKey(nextMonth));
      return nextMonth;
    });
  };

  const toggleMobileCalendar = () => {
    setIsCalendarOpen((current) => !current);
  };

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    setIsCalendarOpen(true);
  };

  const handleCreatePerson = async (name: string) => {
    const created = await createPersonInDb({ name });
    if (created) {
      setPeople((current) => {
        if (current.some((person) => person.id === created.id)) return current;
        return [...current, created].sort((left, right) => left.name.localeCompare(right.name));
      });
    }
    return created;
  };

  const saveEvent = async (event: CalendarEvent) => {
    if (isSavingEvent) return;
    if (!confirmAction(editingEvent ? "이벤트 수정을 저장할까요?" : "이벤트를 저장할까요?")) return;
    setIsSavingEvent(true);
    try {
      const exists = events.some((item) => item.id === event.id);
      const previousEvent = events.find((item) => item.id === event.id);
      const savedEvent = exists ? await updateCalendarEventInDb(event) : await createCalendarEventInDb(event);
      const nextEvent = savedEvent ?? event;
      const nextTargetType = "event";
      const previousTargetType = previousEvent ? "event" : nextTargetType;
      if (previousEvent && previousTargetType !== nextTargetType) await deleteLinkedExpenseRecordInDb(previousTargetType, nextEvent.id);
      await syncLinkedExpenseRecordInDb({
        amount: nextEvent.expenseAmount,
        date: nextEvent.date,
        memo: nextEvent.meta,
        targetId: nextEvent.id,
        targetType: nextTargetType,
        title: nextEvent.title,
      });
      await updateLifeActivitiesBySourceInDb({ ...createActivitySourceFromEvent(nextEvent), previousSourceType: previousTargetType });

      setEvents((current) => (exists ? current.map((item) => (item.id === event.id ? nextEvent : item)) : [nextEvent, ...current]));
      setIsEventSheetOpen(false);
      setEditingEvent(null);
    } finally {
      setIsSavingEvent(false);
    }
  };

  const saveTask = async (task: TaskItem) => {
    if (isSavingTask) return;
    if (!confirmAction(editingTask ? "할 일 수정을 저장할까요?" : "할 일을 저장할까요?")) return;
    setIsSavingTask(true);
    try {
      const exists = tasks.some((item) => item.id === task.id);
      const savedTask = exists ? await updateTaskInDb(task) : await createTaskInDb(task);
      const nextTask = savedTask ?? task;
      await syncLinkedExpenseRecordInDb({
        amount: nextTask.expenseAmount,
        date: nextTask.scheduledDate,
        memo: nextTask.memo,
        targetId: nextTask.id,
        targetType: "todo",
        title: nextTask.title,
      });
      await updateLifeActivitiesBySourceInDb(createActivitySourceFromTask(nextTask));

      setTasks((current) => (exists ? current.map((item) => (item.id === task.id ? nextTask : item)) : [nextTask, ...current]));
      setIsTaskSheetOpen(false);
      setEditingTask(null);
    } finally {
      setIsSavingTask(false);
    }
  };
  return (
    <div className="calendar-page">
      <div className="calendar-board--mobile-shell">
        <MobileCalendarFrame
          calendar={
            <MonthCalendar
              countsByDate={monthCalendarCounts}
              monthCursor={currentMonth}
              onNextMonth={() => moveMonth(1)}
              onPrevMonth={() => moveMonth(-1)}
              onSelectDate={handleDateClick}
              selectedDate={activeDate}
            />
          }
          dateLabel={formatSelectedDate(activeDate)}
          isCalendarOpen={isCalendarOpen}
          onNextDate={() => {
            const base = new Date(`${activeDate}T00:00:00`);
            base.setDate(base.getDate() + 1);
            setSelectedDate(formatDateKey(base));
          }}
          onPrevDate={() => {
            const base = new Date(`${activeDate}T00:00:00`);
            base.setDate(base.getDate() - 1);
            setSelectedDate(formatDateKey(base));
          }}
          onToggleCalendar={toggleMobileCalendar}
        >
          <div className="record-plans-mobile__detail">
            <DayCalendarPanel actions={dayActions} isLoading={isLoading} items={selectedTimelineItems} />
          </div>
        </MobileCalendarFrame>
      </div>

      {isEventSheetOpen ? (
      <EventCreateSheet
        allowedTypes={categories.filter((type) => type !== "todo")}
        defaultDate={selectedDate ?? formatDateKey(currentMonth)}
          defaultType="event"
        event={editingEvent}
        isSaving={isSavingEvent}
          onClose={() => {
            setIsEventSheetOpen(false);
            setEditingEvent(null);
          }}
          onCreatePerson={handleCreatePerson}
          onSave={saveEvent}
          people={people}
        />
      ) : null}

      {isTaskSheetOpen ? (
        <TaskCreateSheet
          defaultDate={selectedDate ?? formatDateKey(currentMonth)}
          isSaving={isSavingTask}
          onClose={() => {
            setIsTaskSheetOpen(false);
            setEditingTask(null);
          }}
          onCreatePerson={handleCreatePerson}
          onSave={saveTask}
          people={people}
          task={editingTask}
        />
      ) : null}

    </div>
  );
}
type DayDetailView = "activities" | "map" | "photos" | "companions" | "finance" | "logs" | null;
type DayActivityItem = Extract<DayTimelineItem, { external: ExternalCalendarItem }> & { type: "activity" };
type DayLogItem = Extract<DayTimelineItem, { external: ExternalCalendarItem }> & { type: "daily_log" };
type DayPhotoItem = Extract<DayTimelineItem, { external: ExternalCalendarItem }> & { type: "photo" };
type DayStandalonePhotoGroup = { id: string; items: DayPhotoItem[]; sortMinutes: number; timeLabel: string };
type DayRouteStop = {
  address?: string;
  id: string;
  label: string;
  latitude?: number;
  longitude?: number;
  name: string;
  sortMinutes?: number;
  timeLabel: string;
};
type DayResolvedRouteStop = DayRouteStop & { latitude: number; longitude: number };

function LifeCalendarDayPanel({ isLoading, items }: { isLoading: boolean; items: DayTimelineItem[] }) {
  const [detailView, setDetailView] = useState<DayDetailView>(null);
  const [photoViewer, setPhotoViewer] = useState<{ items: DayPhotoItem[]; title: string } | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(true);
  const activityItems = useMemo(
    () => items.filter((item): item is DayActivityItem => "external" in item && item.external.type === "activity"),
    [items],
  );
  const photoItems = useMemo(
    () => items.filter((item): item is DayPhotoItem => "external" in item && item.external.type === "photo"),
    [items],
  );
  const logItems = useMemo(
    () => items.filter((item): item is DayLogItem => "external" in item && item.external.type === "daily_log"),
    [items],
  );
  const routeStops = useMemo(() => buildDayRouteStops(items), [items]);
  const finance = useMemo(() => getFinanceTotals(items), [items]);
  const linkedPhotosByActivityId = useMemo(() => buildLinkedPhotoMap(photoItems), [photoItems]);
  const standalonePhotoGroups = useMemo(() => buildStandalonePhotoGroups(photoItems), [photoItems]);
  const companionEntryCount = useMemo(
    () => activityItems.reduce((sum, item) => sum + getTopValues(parseCompanions(item.external.companions)).reduce((innerSum, value) => innerSum + value.count, 0), 0),
    [activityItems],
  );
  const financeEntryCount = useMemo(
    () => items.filter((item) => "external" in item && item.external.amount !== undefined).length,
    [items],
  );
  const timelineRows = useMemo(
    () =>
      [
        ...activityItems.map((item) => ({ id: item.id, item, kind: "activity" as const, sortMinutes: item.sortMinutes })),
        ...standalonePhotoGroups.map((group) => ({ group, id: group.id, kind: "photo" as const, sortMinutes: group.sortMinutes })),
      ].sort((left, right) => left.sortMinutes - right.sortMinutes || left.id.localeCompare(right.id)),
    [activityItems, standalonePhotoGroups],
  );
  const companionCounts = useMemo(
    () => getTopValues(activityItems.flatMap((item) => parseCompanions(item.external.companions))).slice(0, 8),
    [activityItems],
  );
  const visiblePhotoItems = photoViewer?.items ?? photoItems;
  const detailMeta =
    detailView === "map"
      ? {
          description: "좌표가 있는 장소는 바로 그리고, 없는 장소는 검색 API로 보강해 동선을 구성합니다.",
          title: "이 날 방문한 장소 흐름",
          tag: "동선 지도",
        }
      : detailView === "photos"
        ? {
            description: "시간, 연결된 기록, 장소 문맥을 함께 보면서 사진 흐름을 확인할 수 있어요.",
            title: "사진으로 남은 장면",
            tag: photoViewer?.title || "사진 갤러리",
          }
        : detailView === "activities"
          ? {
              description: "활동 기록만 시간대 순으로 보여줘서 이 날의 실제 움직임이 눈에 잘 들어오게 했어요.",
              title: "시간 순 활동 기록",
              tag: "활동 기록",
            }
          : detailView === "companions"
            ? {
                description: "이 날 함께한 사람을 모아봤어요.",
                title: "함께한 사람",
                tag: "함께한 사람",
              }
            : detailView === "finance"
              ? {
                  description: "수입과 지출을 한 번에 확인할 수 있어요.",
                  title: "총 수입·지출",
                  tag: "총 수입·지출",
                }
              : detailView === "logs"
                ? {
                    description: "이 날 남긴 하루 기록을 시간순으로 확인할 수 있어요.",
                    title: "하루 기록",
                    tag: "하루 기록",
                  }
                : null;

  const dayInsightButtons = [
    { icon: Camera, key: "photos" as const, label: "사진 기억", count: photoItems.length, onClick: () => openPhotoViewer(photoItems, "사진 기억") },
    { icon: MapPin, key: "map" as const, label: "동선 지도", count: routeStops.length, onClick: () => setDetailView("map") },
    { icon: UsersRound, key: "companions" as const, label: "함께한 사람", count: companionEntryCount, onClick: () => setDetailView("companions") },
    { icon: Banknote, key: "finance" as const, label: "총 수입·지출", count: financeEntryCount, onClick: () => setDetailView("finance") },
    { icon: NotebookPen, key: "logs" as const, label: "하루 기록", count: logItems.length, onClick: () => setDetailView("logs") },
  ];

  const openPhotoViewer = (nextItems: DayPhotoItem[], title: string) => {
    setPhotoViewer({ items: nextItems, title });
    setDetailView("photos");
  };

  const closeDetail = () => {
    setDetailView(null);
    setPhotoViewer(null);
  };
  return (
    <div className="life-calendar-day-panel life-calendar-day-panel--mobile">
      <div className="life-calendar-day-panel__layout life-calendar-day-panel__layout--mobile">
        <DayInsightBar buttons={dayInsightButtons.map((button) => ({ ...button, active: detailView === button.key }))} />
        <section className={isTimelineOpen ? "life-calendar-day-card life-calendar-day-card--timeline life-calendar-day-card--expanded" : "life-calendar-day-card life-calendar-day-card--timeline life-calendar-day-card--collapsed"}>
          <button aria-expanded={isTimelineOpen} className="life-calendar-day-card__head life-calendar-day-card__head--toggle" onClick={() => setIsTimelineOpen((current) => !current)} type="button">
            <span>활동 타임라인</span>
            <div className="life-calendar-day-card__meta">
              <b>{activityItems.length}건</b>
              <ChevronDown aria-hidden className={`life-calendar-day-card__chevron ${isTimelineOpen ? "life-calendar-day-card__chevron--open" : ""}`} size={16} />
            </div>
          </button>
          {isTimelineOpen ? (
            <div className="life-calendar-day-timeline">
              {timelineRows.length > 0 ? timelineRows.map((row) => {
                if (row.kind === "activity") {
                  const item = row.item;
                  const linkedPhotos = linkedPhotosByActivityId.get(item.external.id) ?? [];
                  return (
                    <article className="life-calendar-day-timeline__item" key={item.id}>
                      <div className="life-calendar-day-timeline__time">
                        <span>{formatTimelineRange(item.timeLabel, item.external.endTime)}</span>
                        <div className="life-calendar-day-timeline__tags">
                          {linkedPhotos.length > 0 ? (
                            <button className="life-calendar-day-photo-badge" onClick={() => openPhotoViewer(linkedPhotos, item.external.title)} type="button">
                              <Camera aria-hidden size={12} />
                              {linkedPhotos.length}
                            </button>
                          ) : null}
                          {[item.external.category].filter(Boolean).slice(0, 3).map((tag, index) => <b className={`life-calendar-day-tag life-calendar-day-tag--${index % 3}`} key={`${item.id}-${tag}`}>{tag}</b>)}
                        </div>
                      </div>
                      <div className="life-calendar-day-timeline__body">
                        <strong>{item.external.title}</strong>
                        {item.external.placeName ? <p><MapPin aria-hidden size={14} /> {item.external.placeName}</p> : null}
                        {item.external.companions ? <p><UsersRound aria-hidden size={14} /> {item.external.companions}</p> : null}
                        {item.external.food ? <p><UtensilsCrossed aria-hidden size={14} /> {item.external.food}</p> : null}
                        {item.external.amount ? <p><Banknote aria-hidden size={14} /> -{formatWon(Math.abs(item.external.amount))}</p> : null}
                      </div>
                    </article>
                  );
                }

                const group = row.group;
                return (
                  <article className="life-calendar-day-timeline__item life-calendar-day-timeline__item--photo" key={group.id}>
                    <div className="life-calendar-day-timeline__time">
                      <span>{group.timeLabel}</span>
                      <div className="life-calendar-day-timeline__tags">
                        <button className="life-calendar-day-photo-badge" onClick={() => openPhotoViewer(group.items, `${group.timeLabel} 사진`)} type="button">
                          <Camera aria-hidden size={12} />
                          {group.items.length}
                        </button>
                      </div>
                    </div>
                    <div className="life-calendar-day-timeline__body">
                      <strong>날짜에 연결된 사진</strong>
                      <p>{getStandalonePhotoGroupSummary(group)}</p>
                    </div>
                  </article>
                );
              }) : <div className="life-calendar-db-empty life-calendar-day-timeline__empty">{isLoading ? "기록 불러오는 중..." : "이 날 저장된 활동 기록이 아직 없어요."}</div>}
            </div>
          ) : null}
        </section>
      </div>
      {detailView ? (
        <div className="life-detail-overlay" onClick={closeDetail}>
          <section className="life-detail-drawer life-calendar-day-drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
            <div className="life-detail-drawer__head">
              <div>
                <span>{detailMeta?.tag ?? "상세 보기"}</span>
                <h2>{detailMeta?.title ?? "세부 정보"}</h2>
                <p>{detailMeta?.description ?? "선택한 항목을 자세히 보여줍니다."}</p>
              </div>
              <IconButton label="닫기" onClick={closeDetail} tone="outline">
                <X aria-hidden size={18} />
              </IconButton>
            </div>

            {detailView === "map" ? (
              <>
                <div className="life-calendar-day-drawer__map">
                  <DayRouteMap stops={routeStops} />
                </div>
                <div className="life-calendar-day-stop-list">
                  {routeStops.length > 0 ? routeStops.map((stop) => (
                    <article className="life-calendar-day-stop-list__item" key={stop.id}>
                      <span>{stop.timeLabel}</span>
                      <strong>{stop.name}</strong>
                      <p>{[stop.label, stop.address].filter(Boolean).join(" · ")}</p>
                    </article>
                  )) : <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "지도에 그릴 장소 기록이 아직 부족해요."}</div>}
                </div>
              </>
            ) : null}

            {detailView === "activities" ? (
              <div className="life-calendar-day-activity-list">
                {activityItems.length > 0 ? activityItems.map((item) => (
                  <article className="life-calendar-day-activity-list__item" key={item.id}>
                    <span>{item.timeLabel}</span>
                    <div>
                      <strong>{item.external.title}</strong>
                      <p>{[item.external.placeName, item.external.meta].filter(Boolean).join(" · ") || "활동 기록"}</p>
                    </div>
                  </article>
                )) : <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "이 날 저장된 활동 기록이 아직 없어요."}</div>}
              </div>
            ) : null}

            {detailView === "photos" ? (
              <div className="life-calendar-day-photo-gallery">
                {visiblePhotoItems.length > 0 ? visiblePhotoItems.map((item) => (
                  <figure className="life-calendar-day-photo-gallery__item" key={item.id}>
                    {item.external.fileUrl ? (
                      item.external.mimeType?.startsWith("video/") ? (
                        <video controls src={item.external.fileUrl} />
                      ) : (
                        <Image
                          alt={item.external.caption || item.external.title}
                          height={item.external.height ?? 220}
                          src={item.external.fileUrl}
                          unoptimized
                          width={item.external.width ?? 220}
                        />
                      )
                    ) : (
                      <div>{item.external.caption || item.external.title}</div>
                    )}
                    <figcaption>
                      <strong>{getPhotoCardTitle(item)}</strong>
                      <span>{getPhotoCardMeta(item)}</span>
                      {getPhotoContextLines(item).map((line) => <em key={`${item.id}-${line}`}>{line}</em>)}
                    </figcaption>
                  </figure>
                )) : <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "이 날 남은 사진이 아직 없어요."}</div>}
              </div>
            ) : null}

            {detailView === "companions" ? (
              companionCounts.length > 0 ? (
                <div className="life-calendar-day-companions">
                  {companionCounts.map((item) => (
                    <article className="life-calendar-day-companions__item" key={item.value}>
                      <strong>{item.value}</strong>
                      <span>{item.count}회 등장</span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "이 날 함께한 사람 기록이 아직 없어요."}</div>
              )
            ) : null}

            {detailView === "finance" ? (
              <div className="life-calendar-day-finance life-calendar-day-finance--detail">
                <article>
                  <span>수입</span>
                  <strong>{formatNumberWithUnit(finance.income, "원")}</strong>
                </article>
                <article>
                  <span>지출</span>
                  <strong>{formatExpenseValueWithUnit(finance.expense, "원")}</strong>
                </article>
                <article>
                  <span>순합계</span>
                  <strong>{formatNumberWithUnit(finance.net, "원")}</strong>
                </article>
              </div>
            ) : null}

            {detailView === "logs" ? (
              <div className="life-calendar-day-logs">
                {logItems.length > 0 ? logItems.map((item) => (
                  <article key={item.id}>
                    <span>{item.timeLabel}</span>
                    <p>{item.external.meta || item.external.title}</p>
                  </article>
                )) : <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "이 날 하루 기록이 아직 없어요."}</div>}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function DayRouteMap({ compact = false, stops }: { compact?: boolean; stops: DayRouteStop[] }) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const markersRef = useRef<NaverMarker[]>([]);
  const polylineRef = useRef<NaverPolyline | null>(null);
  const [mapStatus, setMapStatus] = useState<"idle" | "ready" | "missing-key" | "error">("idle");
  const [resolvedCoordinates, setResolvedCoordinates] = useState<Record<string, { latitude: number; longitude: number }>>({});
  const [isResolvingStops, setIsResolvingStops] = useState(false);

  useEffect(() => {
    if (!naverMapClientId) {
      setMapStatus("missing-key");
      return;
    }

    if (isNaverMapReady()) {
      setMapStatus("ready");
      return;
    }

    loadNaverMapScript().then(
      () => setMapStatus("ready"),
      () => setMapStatus("error"),
    );
  }, []);

  useEffect(() => {
    const unresolvedStops = stops.filter((stop) => !hasCoordinates(stop) && (stop.address || stop.name));
    if (unresolvedStops.length === 0) {
      setIsResolvingStops(false);
      return;
    }

    let isMounted = true;
    setIsResolvingStops(true);
    Promise.all(
      unresolvedStops.map((stop) => resolveDayRouteStopCoordinates(stop)),
    ).then((results) => {
      if (!isMounted) return;
      setResolvedCoordinates((current) => {
        const next = { ...current };
        results.forEach((item) => {
          if (!item) return;
          next[item.id] = { latitude: item.latitude, longitude: item.longitude };
        });
        return next;
      });
      setIsResolvingStops(false);
    });

    return () => {
      isMounted = false;
    };
  }, [stops]);

  const visibleStops = useMemo(
    () =>
      stops
        .map((stop) => ({
          ...stop,
          latitude: stop.latitude ?? resolvedCoordinates[stop.id]?.latitude,
          longitude: stop.longitude ?? resolvedCoordinates[stop.id]?.longitude,
        }))
        .filter((stop): stop is DayResolvedRouteStop => hasCoordinates(stop)),
    [resolvedCoordinates, stops],
  );

  useEffect(() => {
    if (mapStatus !== "ready" || !mapElementRef.current || !window.naver?.maps || visibleStops.length === 0) return;

    if (!mapRef.current) {
      const firstStop = visibleStops[0];
      mapRef.current = new window.naver.maps.Map(mapElementRef.current, {
        center: new window.naver.maps.LatLng(firstStop.latitude!, firstStop.longitude!),
        zoom: visibleStops.length > 1 ? 12 : 15,
      });
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = visibleStops.map((stop, index) =>
      new window.naver!.maps.Marker({
        icon: {
          anchor: new window.naver!.maps.Point(18, 18),
          content: `<div class="life-calendar-route-marker"><span>${index + 1}</span></div>`,
        },
        map: mapRef.current,
        position: new window.naver!.maps.LatLng(stop.latitude!, stop.longitude!),
        title: stop.name,
      }),
    );

    polylineRef.current?.setMap(null);
    if (visibleStops.length > 1) {
      polylineRef.current = new window.naver.maps.Polyline({
        map: mapRef.current,
        path: visibleStops.map((stop) => new window.naver!.maps.LatLng(stop.latitude!, stop.longitude!)),
        strokeColor: "#c9b8ff",
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeOpacity: 0.85,
        strokeWeight: 4,
      });
    }

    if (visibleStops.length === 1) {
      mapRef.current.setCenter(new window.naver.maps.LatLng(visibleStops[0].latitude!, visibleStops[0].longitude!));
      mapRef.current.setZoom(compact ? 16 : 15);
      return;
    }

    const bounds = new window.naver.maps.LatLngBounds();
    visibleStops.forEach((stop) => bounds.extend(new window.naver!.maps.LatLng(stop.latitude!, stop.longitude!)));
    syncDayRouteMapViewport(mapRef.current, bounds, compact);
  }, [compact, mapStatus, visibleStops]);

  useEffect(() => {
    if (!mapElementRef.current || !mapRef.current || !window.naver?.maps || visibleStops.length === 0) return;

    const handleResize = () => {
      const bounds = new window.naver!.maps.LatLngBounds();
      visibleStops.forEach((stop) => bounds.extend(new window.naver!.maps.LatLng(stop.latitude!, stop.longitude!)));
      syncDayRouteMapViewport(mapRef.current, bounds, compact);
    };

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      window.requestAnimationFrame(handleResize);
    });
    observer?.observe(mapElementRef.current);
    window.requestAnimationFrame(handleResize);

    return () => observer?.disconnect();
  }, [compact, visibleStops]);

  useEffect(() => {
    if (visibleStops.length > 0) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    polylineRef.current?.setMap(null);
    polylineRef.current = null;
  }, [visibleStops.length]);

  const overlayMessage =
    mapStatus === "missing-key"
      ? "네이버 지도 키가 없어서 지도를 표시할 수 없어요."
      : visibleStops.length === 0 && isResolvingStops
        ? "장소 좌표를 확인하면서 지도를 준비하고 있어요."
        : visibleStops.length === 0
          ? "지도에 그릴 장소 기록을 더 쌓아보면 여기서 하루 동선이 보입니다."
          : null;

  return (
    <div className={`life-calendar-day-map-shell ${compact ? "life-calendar-day-map-shell--compact" : ""}`}>
      <div className={`life-calendar-day-map ${compact ? "life-calendar-day-map--compact" : ""} ${overlayMessage ? "life-calendar-day-map--hidden" : ""}`} ref={mapElementRef} />
      {overlayMessage ? <div className={`life-calendar-day-map-overlay life-calendar-day-map--empty ${compact ? "life-calendar-day-map--compact" : ""}`}>{overlayMessage}</div> : null}
    </div>
  );
}

async function resolveDayRouteStopCoordinates(stop: DayRouteStop) {
  const candidates = [
    stop.address?.trim(),
    stop.name?.trim(),
    [stop.name, stop.address].filter(Boolean).join(" ").trim(),
  ].filter((value, index, array): value is string => Boolean(value) && array.indexOf(value) === index);

  for (const query of candidates) {
    const cached = dayRouteGeocodeCache.get(query);
    if (cached !== undefined) {
      if (cached) return { id: stop.id, latitude: cached.latitude, longitude: cached.longitude };
      continue;
    }

    try {
      const endpoint = query === stop.address?.trim() ? "/api/maps/geocode" : "/api/maps/search-place";
      const response = await fetch(`${endpoint}?query=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as { places?: Array<{ latitude: number; longitude: number }> };
      const firstPlace = payload.places?.[0];
      if (!firstPlace) {
        dayRouteGeocodeCache.set(query, null);
        continue;
      }

      const resolved = { latitude: firstPlace.latitude, longitude: firstPlace.longitude };
      dayRouteGeocodeCache.set(query, resolved);
      return { id: stop.id, latitude: resolved.latitude, longitude: resolved.longitude };
    } catch (error) {
      console.error("Failed to resolve day route stop", error);
      dayRouteGeocodeCache.set(query, null);
    }
  }

  return null;
}

function syncDayRouteMapViewport(map: NaverMap | null, bounds: NaverLatLngBounds, compact: boolean) {
  if (!map || !window.naver?.maps) return;
  const padding = compact ? { bottom: 24, left: 24, right: 24, top: 24 } : { bottom: 56, left: 40, right: 40, top: 40 };
  (window.naver.maps.Event as { trigger?: (target: unknown, eventName: string) => void }).trigger?.(map, "resize");
  map.fitBounds(bounds, padding);
  const boundsCenter = (bounds as NaverLatLngBounds & { getCenter?: () => NaverLatLng }).getCenter?.();
  if (boundsCenter) {
    map.setCenter(boundsCenter);
  }
}

function getFinanceTotals(items: DayTimelineItem[]) {
  return items.reduce(
    (totals, item) => {
      if (!("external" in item) || item.external.amount === undefined) return totals;
      if (item.external.type === "expense") totals.expense += item.external.amount;
      if (item.external.type === "income") totals.income += item.external.amount;
      totals.net = totals.income - totals.expense;
      return totals;
    },
    { expense: 0, income: 0, net: 0 },
  );
}

function getTopValues(values: string[]) {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].map(([value, count]) => ({ count, value })).sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

function buildDayRouteStops(items: DayTimelineItem[]) {
  const stops: DayRouteStop[] = [];
  const targetPlaces = buildLinkedTargetPlaceMap(items);
  const photoItems = items.filter((item): item is DayPhotoItem => "external" in item && item.external.type === "photo");
  const linkedPhotosByActivityId = buildLinkedPhotoMap(photoItems);

  items.forEach((item) => {
    if ("event" in item && item.event.place) {
      stops.push({
        address: item.event.place.address,
        id: item.id,
        label: categoryLabels[item.event.type as CalendarCategory],
        latitude: item.event.place.latitude,
        longitude: item.event.place.longitude,
        name: item.event.place.name,
        sortMinutes: item.sortMinutes,
        timeLabel: item.timeLabel,
      });
      return;
    }

    if ("task" in item && item.task.place) {
      stops.push({
        address: item.task.place.address,
        id: item.id,
        label: "할 일",
        latitude: item.task.place.latitude,
        longitude: item.task.place.longitude,
        name: item.task.place.name,
        sortMinutes: item.sortMinutes,
        timeLabel: item.timeLabel,
      });
      return;
    }

    if ("external" in item && item.external.type === "activity") {
      if (item.external.placeName) {
        stops.push({
          address: item.external.placeAddress,
          id: item.id,
          label: "활동",
          latitude: item.external.placeLatitude,
          longitude: item.external.placeLongitude,
          name: item.external.placeName,
          sortMinutes: item.sortMinutes,
          timeLabel: item.timeLabel,
        });
        return;
      }

      const linkedPhotos = linkedPhotosByActivityId.get(item.external.id) ?? [];
      const photoSource = linkedPhotos.find((photo) => typeof photo.external.placeLatitude === "number" && typeof photo.external.placeLongitude === "number");
      if (photoSource) {
        stops.push({
          id: item.id,
          label: "활동",
          latitude: photoSource.external.placeLatitude,
          longitude: photoSource.external.placeLongitude,
          name: item.external.title,
          sortMinutes: item.sortMinutes,
          timeLabel: item.timeLabel,
        });
        return;
      }
    }

    if ("external" in item && item.external.type === "photo") {
      if (item.external.linkedTargetType === "activity" && item.external.linkedTargetId) return;

      if (!item.external.linkedTargetId) {
        if (typeof item.external.placeLatitude !== "number" || typeof item.external.placeLongitude !== "number") return;
        stops.push({
          address: item.external.placeAddress,
          id: item.id,
          label: "사진",
          latitude: item.external.placeLatitude,
          longitude: item.external.placeLongitude,
          name: getPhotoStopName(item.external),
          sortMinutes: item.sortMinutes,
          timeLabel: formatPhotoTimeLabel(item.external),
        });
        return;
      }

      const linkedPlace = item.external.linkedTargetId && item.external.linkedTargetType
        ? targetPlaces.get(`${item.external.linkedTargetType}:${item.external.linkedTargetId}`)
        : undefined;
      if (!linkedPlace) return;
      stops.push({
        address: linkedPlace.address,
        id: item.id,
        label: "사진",
        latitude: linkedPlace.latitude,
        longitude: linkedPlace.longitude,
        name: `${formatPhotoTimeLabel(item.external)} 사진`,
        sortMinutes: item.sortMinutes,
        timeLabel: formatPhotoTimeLabel(item.external),
      });
    }
  });

  return stops
    .sort((left, right) => (left.sortMinutes ?? 0) - (right.sortMinutes ?? 0))
    .filter((stop, index, array) => {
      const previous = array[index - 1];
      if (!previous) return true;
      return `${previous.name}|${previous.address ?? ""}` !== `${stop.name}|${stop.address ?? ""}`;
    });
}

function hasCoordinates(stop: DayRouteStop): stop is DayResolvedRouteStop {
  return typeof stop.latitude === "number" && Number.isFinite(stop.latitude) && typeof stop.longitude === "number" && Number.isFinite(stop.longitude);
}

function formatNumberWithUnit(value: number, unit: string) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${prefix}${new Intl.NumberFormat("ko-KR").format(Math.abs(value))}${unit}`;
}

function buildLinkedTargetPlaceMap(items: DayTimelineItem[]) {
  const placeMap = new Map<string, { address?: string; latitude?: number; longitude?: number; name: string }>();

  items.forEach((item) => {
    if ("event" in item && item.event.place) {
      placeMap.set(`${item.event.type}:${item.event.id}`, {
        address: item.event.place.address,
        latitude: item.event.place.latitude,
        longitude: item.event.place.longitude,
        name: item.event.place.name,
      });
      return;
    }

    if ("task" in item && item.task.place) {
      placeMap.set(`todo:${item.task.id}`, {
        address: item.task.place.address,
        latitude: item.task.place.latitude,
        longitude: item.task.place.longitude,
        name: item.task.place.name,
      });
      return;
    }

    if ("external" in item && item.external.type === "activity" && item.external.placeName) {
      placeMap.set(`activity:${item.external.id}`, {
        address: item.external.placeAddress,
        latitude: item.external.placeLatitude,
        longitude: item.external.placeLongitude,
        name: item.external.placeName,
      });
    }
  });

  return placeMap;
}

function buildLinkedPhotoMap(photoItems: DayPhotoItem[]) {
  const map = new Map<string, DayPhotoItem[]>();

  photoItems.forEach((item) => {
    if (item.external.linkedTargetType !== "activity" || !item.external.linkedTargetId) return;
    const existing = map.get(item.external.linkedTargetId) ?? [];
    existing.push(item);
    map.set(item.external.linkedTargetId, existing);
  });

  return map;
}

function buildStandalonePhotoGroups(photoItems: DayPhotoItem[]) {
  const groups = new Map<string, DayStandalonePhotoGroup>();

  photoItems
    .filter((item) => !item.external.linkedTargetId)
    .forEach((item) => {
      const key = `${item.sortMinutes}-${formatPhotoTimeLabel(item.external)}`;
      const current = groups.get(key);
      if (current) {
        current.items.push(item);
        return;
      }
      groups.set(key, {
        id: `photo-group-${key}`,
        items: [item],
        sortMinutes: item.sortMinutes,
        timeLabel: formatPhotoTimeLabel(item.external),
      });
    });

  return [...groups.values()].sort((left, right) => left.sortMinutes - right.sortMinutes);
}

function formatPhotoTimeLabel(photo: ExternalCalendarItem) {
  if (photo.takenAt) {
    return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(photo.takenAt));
  }
  return photo.startTime ? getTimelineTimeLabel(photo.startTime, photo.isAllDay) : "기록";
}

function getPhotoCardTitle(item: DayPhotoItem) {
  return item.external.caption || item.external.linkedTargetTitle || "사진 기록";
}

function getPhotoCardMeta(item: DayPhotoItem) {
  const values = [
    formatPhotoTimeLabel(item.external),
    item.external.linkedTargetTitle ? `${getLinkedTargetTypeLabel(item.external.linkedTargetType)} · ${item.external.linkedTargetTitle}` : null,
  ].filter(Boolean);

  return values.join(" · ") || "사진 기록";
}

function getPhotoContextLines(item: DayPhotoItem) {
  return [
    item.external.linkedTargetTitle ? `${getLinkedTargetTypeLabel(item.external.linkedTargetType)}에 연결됨` : null,
    item.external.placeName ? item.external.placeName : null,
    item.external.meta && item.external.meta !== item.external.caption ? item.external.meta : null,
  ].filter(Boolean) as string[];
}

function getStandalonePhotoGroupSummary(group: DayStandalonePhotoGroup) {
  const firstPhoto = group.items[0];
  if (!firstPhoto) return "이 시간대에 남은 사진 기록";
  if (group.items.length === 1) return firstPhoto.external.caption || firstPhoto.external.meta || "이 시간대에 남은 사진 기록";
  return `${firstPhoto.external.caption || firstPhoto.external.meta || "사진 기록"} 외 ${group.items.length - 1}장`;
}

function getPhotoStopName(photo: ExternalCalendarItem) {
  const timeLabel = formatPhotoTimeLabel(photo);
  const subject = photo.placeName || photo.caption || "사진";
  return `${timeLabel} ${subject}`;
}

function formatExpenseValueWithUnit(value: number, unit: string) {
  if (value === 0) return `0${unit}`;
  return `-${new Intl.NumberFormat("ko-KR").format(Math.abs(value))}${unit}`;
}

function createActivitySourceFromEvent(event: CalendarEvent) {
  return {
    category: "이벤트",
    companions: event.companions,
    date: event.date,
    endTime: event.endTime,
    expenseAmount: event.expenseAmount,
    isAllDay: event.isAllDay,
    memo: event.meta,
    placeAddress: event.place?.address,
    placeName: event.place?.name,
    sourceId: event.id,
    sourceType: "event",
    startTime: event.time,
    title: event.title,
  } satisfies Parameters<typeof updateLifeActivitiesBySourceInDb>[0];
}

function createActivitySourceFromTask(task: TaskItem) {
  return {
    category: "할 일",
    companions: task.companions,
    date: task.scheduledDate,
    endTime: task.endTime,
    expenseAmount: task.expenseAmount,
    isAllDay: task.isAllDay,
    memo: task.memo,
    placeAddress: task.place?.address,
    placeName: task.place?.name,
    sourceId: task.id,
    sourceType: "todo",
    startTime: task.startTime,
    title: task.title,
  } satisfies Parameters<typeof updateLifeActivitiesBySourceInDb>[0];
}

function formatTimelineRange(startLabel: string, endTime?: string) {
  if (!endTime || startLabel === "하루종일" || startLabel === "기록" || startLabel === "시간 미정") return startLabel;
  return `${startLabel} ~ ${endTime}`;
}








