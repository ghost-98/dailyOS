"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Banknote, Bus, CalendarCheck2, Camera, ChevronDown, MapPin, Moon, NotebookPen, Pencil, Plus, Sunrise, Trash2, UsersRound, UtensilsCrossed } from "lucide-react";
import { DayInsightBar } from "@/features/screens/day/components/DayInsightBar";
import { DayDetailSheet } from "@/features/screens/day/details/DayDetailSheet";
import type {
  DayActivityItem,
  DayCounterItem,
  DayDetailView,
  DayFinanceItem,
  DayFinanceTotals,
  DayLogItem,
  DayItemActions,
  DayPhotoItem,
  DayRouteStop,
  DayStandalonePhotoGroup,
} from "@/features/screens/day/dayDetailTypes";
import { formatWon } from "@/features/records/format/recordFormatters";
import { parseCompanions } from "@/features/records/search/recordsInsights";
import {
  getTimelineTimeLabel,
} from "@/features/calendar/calendarViewHelpers";
import { categoryLabels } from "@/features/calendar/presentation";
import type { CalendarCategory, DayTimelineItem, ExternalCalendarItem } from "@/features/calendar/types";

type LifeCalendarDayPanelProps = {
  actions?: DayItemActions;
  isLoading: boolean;
  items: DayTimelineItem[];
  selectedDate: string;
};

export function LifeCalendarDayPanel({ actions, isLoading, items, selectedDate }: LifeCalendarDayPanelProps) {
  const router = useRouter();
  const [detailView, setDetailView] = useState<DayDetailView>(null);
  const [photoViewer, setPhotoViewer] = useState<{ items: DayPhotoItem[]; title: string } | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(true);
  const [isActivityEditMode, setIsActivityEditMode] = useState(false);
  const [expandedBoundaryModes, setExpandedBoundaryModes] = useState<Record<"bedtime" | "wake", boolean>>({ bedtime: false, wake: false });
  const [expandedActivityIds, setExpandedActivityIds] = useState<Set<string>>(() => new Set());

  const activityItems = useMemo(
    () => items.filter((item): item is DayActivityItem => "external" in item && item.external.type === "activity"),
    [items],
  );
  const planItems = useMemo(
    () => items.filter((item): item is Extract<DayTimelineItem, { event: unknown } | { task: unknown }> => item.type === "event" || item.type === "todo"),
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
  const financeItems = useMemo(
    () => items.filter((item): item is DayFinanceItem => "external" in item && (item.external.type === "income" || item.external.type === "expense")),
    [items],
  );
  const linkedPhotosByActivityId = useMemo(() => buildLinkedPhotoMap(photoItems), [photoItems]);
  const standalonePhotoGroups = useMemo(() => buildStandalonePhotoGroups(photoItems), [photoItems]);
  const boundaryEntries = useMemo(() => {
    const wakeItems = activityItems.filter((item) => item.external.title === "기상").sort((left, right) => left.sortMinutes - right.sortMinutes || left.id.localeCompare(right.id));
    const bedtimeItems = activityItems.filter((item) => item.external.title === "취침").sort((left, right) => left.sortMinutes - right.sortMinutes || left.id.localeCompare(right.id));
    return {
      bedtime: bedtimeItems[bedtimeItems.length - 1] ?? null,
      wake: wakeItems[0] ?? null,
    };
  }, [activityItems]);
  const companionEntryCount = useMemo(
    () => activityItems.reduce((sum, item) => sum + getTopValues(parseCompanions(item.external.companions)).reduce((innerSum, value) => innerSum + value.count, 0), 0),
    [activityItems],
  );
  const financeEntryCount = financeItems.length;
  const openBoundaryCreate = (mode: "bedtime" | "wake") => {
    router.push(`/m/record?create=${mode}&date=${encodeURIComponent(selectedDate)}`);
  };
  const timelineRows = useMemo(
    () =>
      [
        ...activityItems.map((item) => ({ id: item.id, item, kind: "activity" as const, sortMinutes: item.sortMinutes })),
        ...standalonePhotoGroups.map((group) => ({ group, id: group.id, kind: "photo" as const, sortMinutes: group.sortMinutes })),
      ]
        .filter((row) => row.kind !== "activity" || (row.item.external.title !== "기상" && row.item.external.title !== "취침"))
        .sort((left, right) => left.sortMinutes - right.sortMinutes || left.id.localeCompare(right.id)),
    [activityItems, standalonePhotoGroups],
  );
  const companionCounts = useMemo(() => getTopValues(activityItems.flatMap((item) => parseCompanions(item.external.companions))).slice(0, 8), [activityItems]);
  const visiblePhotoItems = photoViewer?.items ?? photoItems;

  const dayInsightButtons = [
    { icon: CalendarCheck2, key: "plans" as const, label: "할 일·이벤트", count: planItems.length, onClick: () => setDetailView("plans") },
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

  const toggleActivity = (activityId: string) => {
    setExpandedActivityIds((current) => {
      const next = new Set(current);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  };

  const toggleTimeline = () => {
    if (isTimelineOpen) setIsActivityEditMode(false);
    setIsTimelineOpen((current) => !current);
  };

  const toggleBoundaryPlace = (mode: "bedtime" | "wake") => {
    setExpandedBoundaryModes((current) => ({ ...current, [mode]: !current[mode] }));
  };

  return (
    <div className="life-calendar-day-panel life-calendar-day-panel--mobile">
      <div className="life-calendar-day-panel__layout life-calendar-day-panel__layout--mobile">
        <DayInsightBar buttons={dayInsightButtons.map((button) => ({ ...button, active: detailView === button.key }))} />
        <section className={isTimelineOpen ? "life-calendar-day-card life-calendar-day-card--timeline life-calendar-day-card--expanded" : "life-calendar-day-card life-calendar-day-card--timeline life-calendar-day-card--collapsed"}>
          <div className="life-calendar-day-card__head life-calendar-day-card__head--toggle">
            <button className="life-calendar-day-card__title" onClick={toggleTimeline} type="button">
              <span>활동 타임라인</span>
              <b>{activityItems.length}건</b>
            </button>
            <div className="life-calendar-day-card__controls">
              {isTimelineOpen && actions ? (
                <button
                  aria-label={isActivityEditMode ? "활동 편집 종료" : "활동 편집"}
                  aria-pressed={isActivityEditMode}
                  className={`life-calendar-day-card__control ${isActivityEditMode ? "life-calendar-day-card__control--active" : ""}`}
                  onClick={() => setIsActivityEditMode((current) => !current)}
                  type="button"
                >
                  <Pencil aria-hidden size={14} />
                </button>
              ) : null}
              <button
                aria-expanded={isTimelineOpen}
                aria-label={isTimelineOpen ? "활동 타임라인 접기" : "활동 타임라인 펼치기"}
                className="life-calendar-day-card__control"
                onClick={toggleTimeline}
                type="button"
              >
                <ChevronDown aria-hidden className={`life-calendar-day-card__chevron ${isTimelineOpen ? "life-calendar-day-card__chevron--open" : ""}`} size={16} />
              </button>
            </div>
          </div>
          {isTimelineOpen ? (
            <div className="life-calendar-day-timeline">
              {renderBoundaryRow({
                actions,
                boundaryEntries,
                isActivityEditMode,
                mode: "wake",
                isPlaceExpanded: expandedBoundaryModes.wake,
                onAdd: () => openBoundaryCreate("wake"),
                onDelete: () => {
                  if (boundaryEntries.wake) void actions?.deleteActivity(boundaryEntries.wake.external.id);
                },
                onEdit: () => {
                  if (boundaryEntries.wake) router.push(`/m/record?edit=activity&id=${encodeURIComponent(boundaryEntries.wake.external.id)}`);
                },
                onTogglePlace: () => toggleBoundaryPlace("wake"),
              })}
              {timelineRows.length > 0 ? (
                timelineRows.map((row) => {
                  if (row.kind === "activity") {
                    const item = row.item;
                    const linkedPhotos = linkedPhotosByActivityId.get(item.external.id) ?? [];
                    const isActivityOpen = expandedActivityIds.has(item.external.id);
                    return (
                      <article className={`life-calendar-day-timeline__item ${item.external.endTime ? "life-calendar-day-timeline__item--range" : ""}`.trim()} key={item.id}>
                        <div className="life-calendar-day-timeline__time">
                          <span>{formatTimelineRange(item.timeLabel, item.external.endTime)}</span>
                          <div className="life-calendar-day-timeline__tags">
                            {linkedPhotos.length > 0 ? (
                              <button className="life-calendar-day-photo-badge" onClick={() => openPhotoViewer(linkedPhotos, item.external.title)} type="button">
                                <Camera aria-hidden size={12} />
                                {linkedPhotos.length}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className={`life-calendar-day-timeline__body ${isActivityOpen ? "life-calendar-day-timeline__body--expanded" : "life-calendar-day-timeline__body--collapsed"}`}>
                          <div className="life-calendar-day-item-heading">
                            <button
                              aria-expanded={isActivityOpen}
                              className="life-calendar-day-item-heading__toggle"
                              onClick={() => toggleActivity(item.external.id)}
                              type="button"
                            >
                              <span className="life-calendar-day-item-heading__summary">
                                {item.external.category ? <b className="life-calendar-day-activity-type">{item.external.category}</b> : null}
                                <strong>{item.external.title}</strong>
                              </span>
                              <ChevronDown aria-hidden className={`life-calendar-day-item-heading__chevron ${isActivityOpen ? "life-calendar-day-item-heading__chevron--open" : ""}`} size={15} />
                            </button>
                            {actions && isActivityEditMode ? <div className="life-calendar-day-item-actions">
                              <button aria-label="활동 수정" onClick={() => void actions.editActivity(item.external.id)} type="button"><Pencil aria-hidden size={14} /></button>
                              <button aria-label="활동 삭제" onClick={() => void actions.deleteActivity(item.external.id)} type="button"><Trash2 aria-hidden size={14} /></button>
                            </div> : null}
                          </div>
                          {isActivityOpen ? (
                            <div className="life-calendar-day-timeline__details">
                              {item.external.category === "이동" && (item.external.startPlaceName || item.external.endPlaceName || item.external.transportMode) ? (
                                <div className="life-calendar-day-timeline__movement">
                                  <div className="life-calendar-day-timeline__route">
                                    <span>{item.external.startPlaceName || "출발지 미지정"}</span>
                                    <ArrowRight aria-hidden size={13} />
                                    <span>{item.external.endPlaceName || "도착지 미지정"}</span>
                                  </div>
                                  {item.external.transportMode ? <p><Bus aria-hidden size={14} /> {item.external.transportMode}</p> : null}
                                </div>
                              ) : null}
                              {item.external.category !== "이동" && item.external.placeName ? <p><MapPin aria-hidden size={14} /> {item.external.placeName}</p> : null}
                              {item.external.companions ? <p><UsersRound aria-hidden size={14} /> {item.external.companions}</p> : null}
                              {item.external.food ? <p><UtensilsCrossed aria-hidden size={14} /> {item.external.food}</p> : null}
                              {item.external.amount ? <p><Banknote aria-hidden size={14} /> -{formatWon(Math.abs(item.external.amount))}</p> : null}
                              {item.external.memo ? <p><NotebookPen aria-hidden size={14} /> {item.external.memo}</p> : null}
                            </div>
                          ) : null}
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
                })
              ) : (
                <div className="life-calendar-db-empty life-calendar-day-timeline__empty">{isLoading ? "기록 불러오는 중..." : "이 날 저장된 활동 기록이 아직 없어요."}</div>
              )}
              {renderBoundaryRow({
                actions,
                boundaryEntries,
                isActivityEditMode,
                mode: "bedtime",
                isPlaceExpanded: expandedBoundaryModes.bedtime,
                onAdd: () => openBoundaryCreate("bedtime"),
                onDelete: () => {
                  if (boundaryEntries.bedtime) void actions?.deleteActivity(boundaryEntries.bedtime.external.id);
                },
                onEdit: () => {
                  if (boundaryEntries.bedtime) router.push(`/m/record?edit=activity&id=${encodeURIComponent(boundaryEntries.bedtime.external.id)}`);
                },
                onTogglePlace: () => toggleBoundaryPlace("bedtime"),
              })}
            </div>
          ) : null}
        </section>
      </div>

      <DayDetailSheet
        actions={actions}
        companionCounts={companionCounts}
        finance={finance}
        financeItems={financeItems}
        financeEntryCount={financeEntryCount}
        isLoading={isLoading}
        logItems={logItems}
        planItems={planItems}
        photoTitle={photoViewer?.title ?? "사진 기억"}
        photoViewerItems={visiblePhotoItems}
        routeStops={routeStops}
        view={detailView}
        onClose={closeDetail}
        onOpenPhotos={openPhotoViewer}
      />
    </div>
  );
}

function getFinanceTotals(items: DayTimelineItem[]): DayFinanceTotals {
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

function getTopValues(values: string[]): DayCounterItem[] {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].map(([value, count]) => ({ count, value })).sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

function buildDayRouteStops(items: DayTimelineItem[]): DayRouteStop[] {
  const stops: DayRouteStop[] = [];
  const targetPlaces = buildLinkedTargetPlaceMap(items);
  const photoItems = items.filter((item): item is DayPhotoItem => "external" in item && item.external.type === "photo");
  const linkedPhotosByActivityId = buildLinkedPhotoMap(photoItems);

  items.forEach((item) => {
    if ("event" in item && item.event.place) {
      const linkedPhotos = photoItems.filter((photo) => photo.external.linkedTargetId === item.event.id && photo.external.linkedTargetType === "event");
      stops.push({
        address: item.event.place.address,
        id: item.id,
        label: categoryLabels[item.event.type as CalendarCategory],
        latitude: item.event.place.latitude,
        longitude: item.event.place.longitude,
        name: item.event.place.name,
        photos: linkedPhotos,
        sortMinutes: item.sortMinutes,
        timeLabel: item.timeLabel,
      });
      return;
    }

    if ("task" in item && item.task.place) {
      const linkedPhotos = photoItems.filter((photo) => photo.external.linkedTargetId === item.task.id && photo.external.linkedTargetType === "todo");
      stops.push({
        address: item.task.place.address,
        id: item.id,
        label: "할 일",
        latitude: item.task.place.latitude,
        longitude: item.task.place.longitude,
        name: item.task.place.name,
        photos: linkedPhotos,
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
          photos: linkedPhotosByActivityId.get(item.external.id) ?? [],
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
          photos: linkedPhotos,
          sortMinutes: item.sortMinutes,
          timeLabel: item.timeLabel,
        });
        return;
      }
    }

    if ("external" in item && item.external.type === "photo") {
      const photoItem = item as DayPhotoItem;
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
          photos: [photoItem],
          sortMinutes: item.sortMinutes,
          timeLabel: formatPhotoTimeLabel(item.external),
        });
        return;
      }

      const linkedPlace =
        item.external.linkedTargetId && item.external.linkedTargetType ? targetPlaces.get(`${item.external.linkedTargetType}:${item.external.linkedTargetId}`) : undefined;
      if (!linkedPlace) return;
      stops.push({
        address: linkedPlace.address,
        id: item.id,
        label: "사진",
        latitude: linkedPlace.latitude,
        longitude: linkedPlace.longitude,
        name: `${formatPhotoTimeLabel(item.external)} 사진`,
        photos: [photoItem],
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

function buildStandalonePhotoGroups(photoItems: DayPhotoItem[]): DayStandalonePhotoGroup[] {
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

function formatTimelineRange(startTime: string | undefined, endTime: string | undefined) {
  if (!startTime) return "시간 없음";
  return endTime ? `${startTime} ~ ${endTime}` : startTime;
}

function getPhotoStopName(photo: ExternalCalendarItem) {
  const timeLabel = formatPhotoTimeLabel(photo);
  const subject = photo.placeName || photo.caption || "사진";
  return `${timeLabel} ${subject}`;
}

function getStandalonePhotoGroupSummary(group: DayStandalonePhotoGroup) {
  const firstPhoto = group.items[0];
  if (!firstPhoto) return "이 시간대에 남은 사진 기록";
  if (group.items.length === 1) return firstPhoto.external.caption || firstPhoto.external.meta || "이 시간대에 남은 사진 기록";
  return `${firstPhoto.external.caption || firstPhoto.external.meta || "사진 기록"} 외 ${group.items.length - 1}장`;
}

function renderBoundaryRow({
  actions,
  boundaryEntries,
  isActivityEditMode,
  mode,
  isPlaceExpanded,
  onAdd,
  onDelete,
  onEdit,
  onTogglePlace,
}: {
  actions?: DayItemActions;
  boundaryEntries: { bedtime: DayActivityItem | null; wake: DayActivityItem | null };
  isActivityEditMode: boolean;
  mode: "bedtime" | "wake";
  isPlaceExpanded: boolean;
  onAdd: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onTogglePlace: () => void;
}) {
  const item = mode === "wake" ? boundaryEntries.wake : boundaryEntries.bedtime;
  const hasItem = Boolean(item);
  const BoundaryIcon = mode === "wake" ? Sunrise : Moon;
  const timeLabel = item ? formatBoundaryTime(item) : "-";
  const placeLabel = item?.external.placeName ?? item?.external.memo ?? "";
  const canTogglePlace = hasItem && Boolean(placeLabel);

  return (
    <article className={`life-calendar-day-boundary-row life-calendar-day-boundary-row--${mode}`} key={mode}>
      <span className="life-calendar-day-boundary-row__time">{timeLabel}</span>
      <span className="life-calendar-day-boundary-row__icon">
        <BoundaryIcon aria-hidden size={15} />
      </span>
      {canTogglePlace ? (
        <button
          aria-expanded={isPlaceExpanded}
          aria-label={isPlaceExpanded ? "장소 접기" : "장소 펼치기"}
          className={`life-calendar-day-boundary-row__place-button ${isPlaceExpanded ? "life-calendar-day-boundary-row__place-button--open" : ""}`}
          onClick={onTogglePlace}
          type="button"
        >
          <span className="life-calendar-day-boundary-row__place">{placeLabel}</span>
          <span className="life-calendar-day-boundary-row__place-toggle" aria-hidden>▾</span>
        </button>
      ) : (
        <span className="life-calendar-day-boundary-row__place life-calendar-day-boundary-row__place--empty">-</span>
      )}
      <div className="life-calendar-day-boundary-row__actions">
        {actions && isActivityEditMode && !hasItem ? (
          <button aria-label={`${mode === "wake" ? "기상" : "취침"} 추가`} className="life-calendar-day-boundary-row__add" onClick={onAdd} type="button">
            <Plus aria-hidden size={14} />
            <span>추가</span>
          </button>
        ) : null}
        {actions && isActivityEditMode && hasItem ? (
          <>
            <button aria-label={`${mode === "wake" ? "기상" : "취침"} 수정`} onClick={onEdit} type="button">
              <Pencil aria-hidden size={14} />
            </button>
            <button aria-label={`${mode === "wake" ? "기상" : "취침"} 삭제`} onClick={onDelete} type="button">
              <Trash2 aria-hidden size={14} />
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}

function formatBoundaryTime(item: DayActivityItem) {
  return item.external.startTime ? `${item.external.startTime}${item.external.endTime ? ` ~ ${item.external.endTime}` : ""}` : item.timeLabel;
}
