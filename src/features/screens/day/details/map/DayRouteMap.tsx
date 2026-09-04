"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { getNaverMapClientId, isNaverMapReady, loadNaverMapScript } from "@/lib/naverMap";
import type { NaverLatLng, NaverLatLngBounds, NaverMap, NaverMarker, NaverPolyline } from "@/lib/naverMap";

export type DayRouteStop = {
  address?: string;
  id: string;
  label: string;
  latitude?: number;
  longitude?: number;
  name: string;
  sortMinutes?: number;
  timeLabel: string;
};

export type DayRouteMapHandle = {
  focusStop: (stopId: string) => void;
  resetViewport: () => void;
};

export const DayRouteMap = forwardRef<DayRouteMapHandle, {
  compact?: boolean;
  onStopSelect?: (stopId: string) => void;
  stops: DayRouteStop[];
}>(
function DayRouteMap({
  compact = false,
  onStopSelect,
  stops,
}: {
  compact?: boolean;
  onStopSelect?: (stopId: string) => void;
  stops: DayRouteStop[];
},
ref) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const markersRef = useRef<NaverMarker[]>([]);
  const polylineRef = useRef<NaverPolyline | null>(null);
  const onStopSelectRef = useRef(onStopSelect);
  const [mapStatus, setMapStatus] = useState<"idle" | "ready" | "missing-key" | "error">("idle");
  const [resolvedCoordinates, setResolvedCoordinates] = useState<Record<string, { latitude: number; longitude: number }>>({});
  const [isResolvingStops, setIsResolvingStops] = useState(false);

  useEffect(() => {
    onStopSelectRef.current = onStopSelect;
  }, [onStopSelect]);

  useEffect(() => {
    if (!getNaverMapClientId()) {
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
    Promise.all(unresolvedStops.map((stop) => resolveDayRouteStopCoordinates(stop))).then((results) => {
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
        .filter((stop): stop is DayRouteStop & { latitude: number; longitude: number } => hasCoordinates(stop)),
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
    markersRef.current = visibleStops.map((stop, index) => {
      const marker = new window.naver!.maps.Marker({
        icon: {
          anchor: new window.naver!.maps.Point(18, 18),
          content: `<div class="life-calendar-route-marker"><span>${index + 1}</span></div>`,
        },
        map: mapRef.current,
        position: new window.naver!.maps.LatLng(stop.latitude!, stop.longitude!),
        title: stop.name,
      });

      window.naver?.maps.Event.addListener(marker, "click", () => {
        const center = new window.naver!.maps.LatLng(stop.latitude!, stop.longitude!);
        mapRef.current?.setCenter(center);
        mapRef.current?.setZoom(compact ? 16 : 15);
        onStopSelectRef.current?.(stop.id);
      });

      return marker;
    });

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

  useImperativeHandle(ref, () => ({
    focusStop: (stopId: string) => {
      if (!mapRef.current || !window.naver?.maps || visibleStops.length === 0) return;
      const targetStop = visibleStops.find((stop) => stop.id === stopId);
      if (!targetStop) return;

      mapRef.current.setCenter(new window.naver.maps.LatLng(targetStop.latitude!, targetStop.longitude!));
      mapRef.current.setZoom(compact ? 16 : 15);
    },
    resetViewport: () => {
      if (!mapRef.current || !window.naver?.maps || visibleStops.length === 0) return;
      if (visibleStops.length === 1) {
        mapRef.current.setCenter(new window.naver.maps.LatLng(visibleStops[0].latitude!, visibleStops[0].longitude!));
        mapRef.current.setZoom(compact ? 16 : 15);
        return;
      }

      const bounds = new window.naver.maps.LatLngBounds();
      visibleStops.forEach((stop) => bounds.extend(new window.naver!.maps.LatLng(stop.latitude!, stop.longitude!)));
      syncDayRouteMapViewport(mapRef.current, bounds, compact);
    },
  }), [compact, visibleStops]);

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
});

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

function hasCoordinates(stop: DayRouteStop): stop is DayRouteStop & { latitude: number; longitude: number } {
  return typeof stop.latitude === "number" && Number.isFinite(stop.latitude) && typeof stop.longitude === "number" && Number.isFinite(stop.longitude);
}

const dayRouteGeocodeCache = new Map<string, { latitude: number; longitude: number } | null>();
