"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { DayRouteMap } from "@/features/screens/day/details/map/DayRouteMap";
import type { DayRouteMapHandle } from "@/features/screens/day/details/map/DayRouteMap";
import type { DayRouteStop } from "@/features/screens/day/dayDetailTypes";

export type DayMapDetailHandle = {
  resetViewport: () => void;
};

type DayMapDetailProps = {
  isLoading: boolean;
  routeStops: DayRouteStop[];
};

export const DayMapDetail = forwardRef<DayMapDetailHandle, DayMapDetailProps>(function DayMapDetail({ isLoading, routeStops }, ref) {
  const mapRef = useRef<DayRouteMapHandle | null>(null);
  const stopItemRefs = useRef(new Map<string, HTMLElement>());
  const [activeStopId, setActiveStopId] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    resetViewport: () => mapRef.current?.resetViewport(),
  }));

  const handleSelectStop = (stopId: string) => {
    setActiveStopId(stopId);
    mapRef.current?.focusStop(stopId);
    stopItemRefs.current.get(stopId)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="life-calendar-day-detail life-calendar-day-detail--map">
      <div className="life-calendar-day-drawer__map">
        <DayRouteMap ref={mapRef} onStopSelect={handleSelectStop} stops={routeStops} />
      </div>
      <div className="life-calendar-day-stop-list">
        {routeStops.length > 0 ? (
          routeStops.map((stop, index) => (
            <article
              className={activeStopId === stop.id ? "life-calendar-day-stop-list__item life-calendar-day-stop-list__item--active" : "life-calendar-day-stop-list__item"}
              key={stop.id}
              ref={(element) => {
                if (element) stopItemRefs.current.set(stop.id, element);
                else stopItemRefs.current.delete(stop.id);
              }}
              onClick={() => handleSelectStop(stop.id)}
              role="button"
              tabIndex={0}
            >
              <span className="life-calendar-route-marker life-calendar-route-marker--inline">{index + 1}</span>
              <strong>{stop.name}</strong>
              <p>{[stop.label, stop.address].filter(Boolean).join(" · ")}</p>
            </article>
          ))
        ) : (
          <div className="life-calendar-db-empty">{isLoading ? "기록 불러오는 중..." : "지도에 그릴 장소 기록이 아직 부족해요."}</div>
        )}
      </div>
    </div>
  );
});
