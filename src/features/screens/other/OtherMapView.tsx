"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, RotateCcw, Search, X } from "lucide-react";
import { PeriodFilterSheet } from "@/components/shared/date/PeriodFilterSheet";
import { PeriodSummaryBar } from "@/components/shared/date/PeriodSummaryBar";
import { PlaceSearchField } from "@/components/shared/places/PlaceSearchField";
import { SlideUpSheet } from "@/components/shared/sheets/SlideUpSheet";
import { IconButton } from "@/components/ui/IconButton";
import { MapPlaceCard } from "@/components/shared/maps/MapPlaceCard";
import { OtherMapCanvas } from "@/features/screens/other/components/OtherMapCanvas";
import type { OtherMapPlace } from "@/features/screens/other/components/OtherMapCanvas";
import type { OtherMapCanvasHandle } from "@/features/screens/other/components/OtherMapCanvas";
import { OtherTabShell } from "@/features/screens/other/components/OtherTabShell";
import { useRecordsDataState } from "@/features/records/state/useRecordsDataState";
import { DayPhotoDetail } from "@/features/screens/day/details/photos/DayPhotoDetail";
import { toDayPhotoItem } from "@/features/screens/other/utils/photoViewItems";
import type { LifePhotoRecord, PlanPlace } from "@/types/domain";

export function OtherMapView() {
  const [isPlaceFormOpen, setIsPlaceFormOpen] = useState(false);
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlanPlace>();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [query, setQuery] = useState("");
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [expandedPlaceIds, setExpandedPlaceIds] = useState<Set<string>>(() => new Set());
  const [photoViewerItems, setPhotoViewerItems] = useState<LifePhotoRecord[]>([]);
  const mapRef = useRef<OtherMapCanvasHandle | null>(null);
  const placeCardRefs = useRef(new Map<string, HTMLElement>());
  const { data } = useRecordsDataState();
  const periodPlaces = useMemo(() => buildPeriodPlaces(data, startDate, endDate), [data, endDate, startDate]);
  const places = useMemo(() => filterMapPlaces(periodPlaces, query), [periodPlaces, query]);

  return (
    <OtherTabShell
      actions={(
        <>
          <IconButton
            label={isPlaceFormOpen ? "내 장소 추가 닫기" : "내 장소 추가"}
            onClick={() => setIsPlaceFormOpen((current) => !current)}
            size="sm"
            tone="soft"
          >
            {isPlaceFormOpen ? <X aria-hidden size={16} /> : <Plus aria-hidden size={16} />}
          </IconButton>
        </>
      )}
      title="지도"
    >
      {isPlaceFormOpen ? (
        <div className="other-map-place-form">
          <PlaceSearchField onSelect={setSelectedPlace} selectedPlace={selectedPlace} />
        </div>
      ) : null}
      <PeriodSummaryBar
        actions={(
          <IconButton
            label="지도와 검색 초기화"
            onClick={() => {
              setQuery("");
              setActivePlaceId(null);
              setExpandedPlaceIds(new Set());
              mapRef.current?.resetViewport();
            }}
            size="sm"
            tone="soft"
          ><RotateCcw aria-hidden size={15} /></IconButton>
        )}
        count={places.length}
        countUnit="곳"
        endDate={endDate}
        onOpenPeriod={() => setIsPeriodOpen(true)}
        startDate={startDate}
      />
      <label className="other-map-search ui-input-shell">
        <Search aria-hidden size={16} />
        <input aria-label="지도 기록 검색" placeholder="장소, 주소, 활동 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <OtherMapCanvas
        onPlaceSelect={(placeId) => {
          setActivePlaceId(placeId);
          setExpandedPlaceIds((current) => new Set(current).add(placeId));
          placeCardRefs.current.get(placeId)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        places={places}
        ref={mapRef}
      />
      <div className="other-map-place-list">
        {places.map((place, index) => {
          const linkedPhotos = getPlacePhotos(place, data.lifePhotos);
          return <MapPlaceCard
            address={place.address}
            detailLines={place.records.map((record) => `${record.date} · ${record.label} · ${record.title}`)}
            index={index}
            isActive={activePlaceId === place.id}
            isExpanded={expandedPlaceIds.has(place.id)}
            key={place.id}
            name={place.name}
            onSelect={() => {
              setActivePlaceId(place.id);
              mapRef.current?.focusPlace(place.id);
              setExpandedPlaceIds((current) => toggleSetValue(current, place.id));
            }}
            onShowPhotos={() => setPhotoViewerItems(linkedPhotos)}
            photoCount={linkedPhotos.length}
            setRef={(element) => {
              if (element) placeCardRefs.current.set(place.id, element);
              else placeCardRefs.current.delete(place.id);
            }}
          />;
        })}
      </div>
      {photoViewerItems.length > 0 ? (
        <SlideUpSheet className="life-day-detail-sheet" eyebrow="장소 사진" eyebrowSuffix={`${photoViewerItems.length}장`} onClose={() => setPhotoViewerItems([])}>
          <DayPhotoDetail isLoading={false} items={photoViewerItems.map(toDayPhotoItem)} />
        </SlideUpSheet>
      ) : null}
      <PeriodFilterSheet
        endDate={endDate}
        isOpen={isPeriodOpen}
        onClose={() => setIsPeriodOpen(false)}
        onEndDateChange={setEndDate}
        onReset={() => { setStartDate(""); setEndDate(""); }}
        onStartDateChange={setStartDate}
        startDate={startDate}
      />
    </OtherTabShell>
  );
}

function filterMapPlaces(places: OtherMapPlace[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  if (!normalizedQuery) return places;
  return places.filter((place) => [
    place.name,
    place.address,
    ...place.records.flatMap((record) => [record.title, record.label, record.date]),
  ].some((value) => value?.toLocaleLowerCase("ko-KR").includes(normalizedQuery)));
}

function toggleSetValue(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function buildPeriodPlaces(data: ReturnType<typeof useRecordsDataState>["data"], startDate: string, endDate: string) {
  const inPeriod = (date: string) => (!startDate || date >= startDate) && (!endDate || date <= endDate);
  const places: OtherMapPlace[] = [];

  data.events.filter((event) => inPeriod(event.date) && event.place).forEach((event) => places.push({ ...event.place!, id: `event-${event.id}`, records: [{ date: event.date, label: "이벤트", targetId: event.id, targetType: "event", title: event.title }] }));
  data.tasks.filter((task) => inPeriod(task.scheduledDate) && task.place).forEach((task) => places.push({ ...task.place!, id: `task-${task.id}`, records: [{ date: task.scheduledDate, label: "할 일", targetId: task.id, targetType: "todo", title: task.title }] }));
  data.activities.filter((activity) => inPeriod(activity.date)).forEach((activity) => {
    const record = [{ date: activity.date, label: "활동", targetId: activity.id, targetType: "activity" as const, title: activity.title }];
    if (activity.placeName) places.push({ address: activity.placeAddress, id: `activity-${activity.id}`, name: activity.placeName, records: record });
    if (activity.startPlaceName) places.push({ address: activity.startPlaceAddress, id: `activity-start-${activity.id}`, name: activity.startPlaceName, records: record });
    if (activity.endPlaceName) places.push({ address: activity.endPlaceAddress, id: `activity-end-${activity.id}`, name: activity.endPlaceName, records: record });
  });

  const grouped = new Map<string, OtherMapPlace>();
  places.forEach((place) => {
    const key = place.address?.trim().toLowerCase() || `${place.latitude ?? ""},${place.longitude ?? ""}|${place.name.trim().toLowerCase()}`;
    const existing = grouped.get(key);
    if (existing) existing.records.push(...place.records);
    else grouped.set(key, place);
  });
  return [...grouped.values()];
}

function getPlacePhotos(place: OtherMapPlace, photos: LifePhotoRecord[]) {
  return photos.filter((photo) => {
    const matchesTarget = photo.linkedTargetId && place.records.some((record) => record.targetId === photo.linkedTargetId && record.targetType === photo.linkedTargetType);
    const matchesCoordinates = typeof photo.latitude === "number" && typeof photo.longitude === "number" && typeof place.latitude === "number" && typeof place.longitude === "number"
      && Math.abs(photo.latitude - place.latitude) < 0.00015 && Math.abs(photo.longitude - place.longitude) < 0.00015;
    return Boolean(matchesTarget || matchesCoordinates);
  });
}
