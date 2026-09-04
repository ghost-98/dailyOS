"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { MapPlaceCard } from "@/components/shared/maps/MapPlaceCard";
import { DayRouteMap } from "@/features/screens/day/details/map/DayRouteMap";
import type { DayRouteMapHandle } from "@/features/screens/day/details/map/DayRouteMap";
import type { DayPhotoItem, DayRouteStop } from "@/features/screens/day/dayDetailTypes";

export type DayMapDetailHandle = {
  resetViewport: () => void;
};

type DayMapDetailProps = {
  isLoading: boolean;
  onShowPhotos: (items: DayPhotoItem[], title: string) => void;
  routeStops: DayRouteStop[];
};

export const DayMapDetail = forwardRef<DayMapDetailHandle, DayMapDetailProps>(function DayMapDetail({ isLoading, onShowPhotos, routeStops }, ref) {
  const mapRef = useRef<DayRouteMapHandle | null>(null);
  const stopItemRefs = useRef(new Map<string, HTMLElement>());
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [expandedStopIds, setExpandedStopIds] = useState<Set<string>>(() => new Set());

  useImperativeHandle(ref, () => ({
    resetViewport: () => mapRef.current?.resetViewport(),
  }));

  const handleSelectStop = (stopId: string) => {
    setActiveStopId(stopId);
    setExpandedStopIds((current) => new Set(current).add(stopId));
    mapRef.current?.focusStop(stopId);
    stopItemRefs.current.get(stopId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleToggleStop = (stopId: string) => {
    setActiveStopId(stopId);
    mapRef.current?.focusStop(stopId);
    setExpandedStopIds((current) => {
      const next = new Set(current);
      if (next.has(stopId)) next.delete(stopId);
      else next.add(stopId);
      return next;
    });
  };

  return (
    <div className="life-calendar-day-detail life-calendar-day-detail--map">
      <div className="life-calendar-day-drawer__map">
        <DayRouteMap ref={mapRef} onStopSelect={handleSelectStop} stops={routeStops} />
      </div>
      <div className="life-calendar-day-stop-list">
        {routeStops.length > 0 ? (
          routeStops.map((stop, index) => (
            <MapPlaceCard
              address={stop.address}
              detailLines={[[stop.timeLabel, stop.label].filter(Boolean).join(" · ")]}
              index={index}
              isActive={activeStopId === stop.id}
              isExpanded={expandedStopIds.has(stop.id)}
              key={stop.id}
              name={stop.name}
              onSelect={() => handleToggleStop(stop.id)}
              onShowPhotos={() => onShowPhotos(stop.photos ?? [], stop.name)}
              photoCount={stop.photos?.length ?? 0}
              setRef={(element) => {
                if (element) stopItemRefs.current.set(stop.id, element);
                else stopItemRefs.current.delete(stop.id);
              }}
            />
          ))
        ) : (
          <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "지도에 그릴 장소 기록이 아직 부족해요."}</div>
        )}
      </div>
    </div>
  );
});
