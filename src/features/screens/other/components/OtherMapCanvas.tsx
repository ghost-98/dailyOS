"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { getNaverMapClientId, isNaverMapReady, loadNaverMapScript } from "@/lib/naverMap";
import type { NaverLatLngBounds, NaverMap, NaverMarker } from "@/lib/naverMap";
import type { PlaceVerificationStatus } from "@/features/data/places/verificationApi";
import { getPlaceVerificationQueries } from "@/features/data/places/placeIdentity";

const DEFAULT_CENTER = { latitude: 37.5665, longitude: 126.978 };

export type OtherMapPlace = {
  address?: string;
  id: string;
  latitude?: number;
  longitude?: number;
  name: string;
  records: Array<{ date: string; label: string; targetId: string; targetType: "activity" | "event" | "todo"; title: string }>;
  verificationKey: string;
};

export type OtherMapCanvasHandle = {
  focusPlace: (placeId: string) => void;
  resetViewport: () => void;
};

export type MapPlaceResolutionStatus = "resolved" | "unresolved";

export const OtherMapCanvas = forwardRef<OtherMapCanvasHandle, {
  onPlaceResolutionChange?: (statuses: Record<string, MapPlaceResolutionStatus>) => void;
  onPlaceSelect?: (placeId: string) => void;
  places: OtherMapPlace[];
  verificationStatuses?: Record<string, PlaceVerificationStatus>;
}>(function OtherMapCanvas({ onPlaceResolutionChange, onPlaceSelect, places, verificationStatuses = {} }, ref) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const markersRef = useRef<NaverMarker[]>([]);
  const onPlaceSelectRef = useRef(onPlaceSelect);
  const onPlaceResolutionChangeRef = useRef(onPlaceResolutionChange);
  const [resolvedCoordinates, setResolvedCoordinates] = useState<Record<string, { latitude: number; longitude: number }>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "missing-key" | "error">("loading");

  useEffect(() => {
    onPlaceSelectRef.current = onPlaceSelect;
  }, [onPlaceSelect]);

  useEffect(() => {
    onPlaceResolutionChangeRef.current = onPlaceResolutionChange;
  }, [onPlaceResolutionChange]);

  useEffect(() => {
    if (!getNaverMapClientId()) {
      setStatus("missing-key");
      return;
    }

    if (isNaverMapReady()) {
      setStatus("ready");
      return;
    }

    loadNaverMapScript().then(() => setStatus("ready"), () => setStatus("error"));
  }, []);

  useEffect(() => {
    const unresolved = places.filter((place) => !hasCoordinates(place) && (place.address || place.name));
    const initialStatuses = places.reduce<Record<string, MapPlaceResolutionStatus>>((statuses, place) => {
      if (hasCoordinates(place)) statuses[place.id] = "resolved";
      return statuses;
    }, {});

    if (unresolved.length === 0) {
      onPlaceResolutionChangeRef.current?.(initialStatuses);
      return;
    }

    let isMounted = true;
    Promise.all(unresolved.map(resolvePlaceCoordinates)).then((results) => {
      if (!isMounted) return;
      setResolvedCoordinates((current) => {
        const next = { ...current };
        results.forEach((result) => {
          if (result.status === "resolved") next[result.id] = { latitude: result.latitude, longitude: result.longitude };
        });
        return next;
      });
      onPlaceResolutionChangeRef.current?.(results.reduce<Record<string, MapPlaceResolutionStatus>>((statuses, result) => {
        statuses[result.id] = result.status;
        return statuses;
      }, initialStatuses));
    });
    return () => { isMounted = false; };
  }, [places]);

  const visiblePlaces = useMemo(() => places.map((place, displayIndex) => ({
    ...place,
    displayIndex,
    latitude: place.latitude ?? resolvedCoordinates[place.id]?.latitude,
    longitude: place.longitude ?? resolvedCoordinates[place.id]?.longitude,
  })).filter((place): place is OtherMapPlace & { displayIndex: number; latitude: number; longitude: number } => hasCoordinates(place)), [places, resolvedCoordinates]);

  useEffect(() => {
    if (status !== "ready" || !elementRef.current || !window.naver?.maps) return;

    if (!mapRef.current) {
      mapRef.current = new window.naver.maps.Map(elementRef.current, {
        center: new window.naver.maps.LatLng(DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude),
        zoom: 13,
      });
    }

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      if (!mapRef.current || !window.naver?.maps) return;
      window.naver.maps.Event.trigger(mapRef.current, "resize");
    });
    observer?.observe(elementRef.current);
    return () => observer?.disconnect();
  }, [status]);

  useEffect(() => {
    if (status !== "ready" || !mapRef.current || !window.naver?.maps) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = visiblePlaces.map((place) => {
      const verificationStatus = verificationStatuses[place.verificationKey];
      const marker = new window.naver!.maps.Marker({
        icon: {
          anchor: new window.naver!.maps.Point(18, 18),
          content: `<div class="life-calendar-route-marker ${verificationStatus === "unverified" ? "life-calendar-route-marker--unverified" : verificationStatus === "checking" ? "life-calendar-route-marker--checking" : ""}"><span>${place.displayIndex + 1}</span></div>`,
        },
        map: mapRef.current,
        position: new window.naver!.maps.LatLng(place.latitude, place.longitude),
        title: place.name,
      });
      window.naver!.maps.Event.addListener(marker, "click", () => {
        mapRef.current?.setCenter(new window.naver!.maps.LatLng(place.latitude, place.longitude));
        mapRef.current?.setZoom(16);
        onPlaceSelectRef.current?.(place.id);
      });
      return marker;
    });

    if (visiblePlaces.length === 0) {
      mapRef.current.setCenter(new window.naver.maps.LatLng(DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude));
      mapRef.current.setZoom(13);
      return;
    }

    if (visiblePlaces.length === 1) {
      mapRef.current.setCenter(new window.naver.maps.LatLng(visiblePlaces[0].latitude, visiblePlaces[0].longitude));
      mapRef.current.setZoom(15);
      return;
    }

    fitVisiblePlaces(mapRef.current, visiblePlaces);
  }, [status, verificationStatuses, visiblePlaces]);

  useImperativeHandle(ref, () => ({
    focusPlace: (placeId: string) => {
      const place = visiblePlaces.find((item) => item.id === placeId);
      if (!place || !mapRef.current || !window.naver?.maps) return;
      mapRef.current.setCenter(new window.naver.maps.LatLng(place.latitude, place.longitude));
      mapRef.current.setZoom(16);
    },
    resetViewport: () => {
      if (!mapRef.current || !window.naver?.maps) return;
      if (visiblePlaces.length === 0) {
        mapRef.current.setCenter(new window.naver.maps.LatLng(DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude));
        mapRef.current.setZoom(13);
        return;
      }
      if (visiblePlaces.length === 1) {
        mapRef.current.setCenter(new window.naver.maps.LatLng(visiblePlaces[0].latitude, visiblePlaces[0].longitude));
        mapRef.current.setZoom(15);
        return;
      }
      fitVisiblePlaces(mapRef.current, visiblePlaces);
    },
  }), [visiblePlaces]);

  const message = status === "missing-key"
    ? "네이버 지도 클라이언트 ID를 확인해 주세요."
    : status === "error"
      ? "지도를 불러오지 못했어요."
      : status === "loading"
        ? "지도를 불러오는 중..."
        : null;

  return (
    <div className="other-map-canvas">
      <div className="other-map-canvas__map" ref={elementRef} />
      {message ? <div className="other-map-canvas__status">{message}</div> : null}
    </div>
  );
});

function fitVisiblePlaces(map: NaverMap, places: Array<OtherMapPlace & { latitude: number; longitude: number }>) {
  if (!window.naver?.maps) return;
  const bounds: NaverLatLngBounds = new window.naver.maps.LatLngBounds();
  places.forEach((place) => bounds.extend(new window.naver!.maps.LatLng(place.latitude, place.longitude)));
  map.fitBounds(bounds, 44);
}

function hasCoordinates(place: OtherMapPlace): place is OtherMapPlace & { latitude: number; longitude: number } {
  return typeof place.latitude === "number" && typeof place.longitude === "number";
}

async function resolvePlaceCoordinates(place: OtherMapPlace) {
  const candidates = [
    place.address?.trim() ? { endpoint: "/api/maps/geocode", query: place.address.trim() } : null,
    ...getPlaceVerificationQueries(place).map((query) => ({ endpoint: "/api/maps/search-place", query })),
  ].filter((candidate): candidate is { endpoint: string; query: string } => Boolean(candidate?.query));

  for (const candidate of candidates) {
    try {
      const response = await fetch(`${candidate.endpoint}?query=${encodeURIComponent(candidate.query)}`);
      if (!response.ok) continue;
      const payload = await response.json() as { places?: Array<{ latitude: number; longitude: number }> };
      const first = payload.places?.[0];
      if (first) return { id: place.id, latitude: first.latitude, longitude: first.longitude, status: "resolved" as const };
    } catch {
      continue;
    }
  }

  return { id: place.id, status: "unresolved" as const };
}
