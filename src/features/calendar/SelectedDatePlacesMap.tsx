"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, Maximize2, Route } from "lucide-react";
import { escapeHtml, getPlanPlaceKey } from "@/features/calendar/utils";
import type { PlanPlace } from "@/types/domain";

type NaverLatLng = unknown;
type NaverLatLngBounds = {
  extend: (latLng: NaverLatLng) => void;
};
type NaverMap = {
  fitBounds: (bounds: NaverLatLngBounds, padding?: number | Record<string, number>) => void;
  setCenter: (latLng: NaverLatLng) => void;
  setZoom: (zoom: number) => void;
};
type NaverMarker = {
  setMap: (map: NaverMap | null) => void;
};
type NaverPolyline = {
  setMap: (map: NaverMap | null) => void;
};

declare global {
  interface Window {
    naver?: {
      maps: {
        Event: {
          addListener: (target: NaverMarker, eventName: string, listener: () => void) => void;
        };
        LatLng: new (latitude: number, longitude: number) => NaverLatLng;
        LatLngBounds: new () => NaverLatLngBounds;
        Map: new (element: HTMLElement, options: Record<string, unknown>) => NaverMap;
        Marker: new (options: Record<string, unknown>) => NaverMarker;
        Polyline: new (options: Record<string, unknown>) => NaverPolyline;
        Point: new (x: number, y: number) => unknown;
      };
    };
  }
}

const naverMapClientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID;

export function SelectedDatePlacesMap({ places }: { places: PlanPlace[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLargeMapOpen, setIsLargeMapOpen] = useState(false);
  const [isRouteVisible, setIsRouteVisible] = useState(false);
  const [isPortalReady, setIsPortalReady] = useState(false);
  const placeKeys = useMemo(() => places.map((place) => getPlanPlaceKey(place)), [places]);
  const [visiblePlaceKeys, setVisiblePlaceKeys] = useState<string[]>(placeKeys);
  const visiblePlaceKeySet = useMemo(() => new Set(visiblePlaceKeys), [visiblePlaceKeys]);
  const visiblePlaces = useMemo(
    () => places.filter((place) => visiblePlaceKeySet.has(getPlanPlaceKey(place))),
    [places, visiblePlaceKeySet],
  );

  useEffect(() => {
    setIsPortalReady(true);
  }, []);

  useEffect(() => {
    setVisiblePlaceKeys(placeKeys);
  }, [placeKeys]);

  const togglePlaceVisibility = (place: PlanPlace) => {
    const placeKey = getPlanPlaceKey(place);
    setVisiblePlaceKeys((current) =>
      current.includes(placeKey) ? current.filter((key) => key !== placeKey) : [...current, placeKey],
    );
  };

  if (places.length === 0) {
    return (
      <div className="schedule-date-map schedule-date-map--empty">
        <button className="schedule-date-map__toggle" onClick={() => setIsOpen((current) => !current)} type="button">
          <span>
            <MapPin aria-hidden size={18} />
            이날 간 장소
          </span>
          <strong>0곳</strong>
        </button>
        {isOpen ? <p>이 날짜에 연결된 장소가 없습니다.</p> : null}
      </div>
    );
  }

  return (
    <>
      <div className={`schedule-date-map ${isOpen ? "schedule-date-map--open" : ""}`}>
        <div className="schedule-date-map__header">
          <button className="schedule-date-map__toggle" onClick={() => setIsOpen((current) => !current)} type="button">
            <span>
              <MapPin aria-hidden size={18} />
              이날 간 장소
            </span>
            <strong>{places.length}곳</strong>
          </button>
          <div className="schedule-date-map__actions" aria-label="지도 동작">
            <button aria-label="크게 보기" title="크게 보기" onClick={() => setIsLargeMapOpen(true)} type="button">
              <Maximize2 aria-hidden size={16} />
            </button>
            <button
              aria-label="경로 그리기"
              className={isRouteVisible ? "schedule-date-map__route-button schedule-date-map__route-button--active" : "schedule-date-map__route-button"}
              disabled={visiblePlaces.length < 2}
              onClick={() => {
                setIsRouteVisible((current) => !current);
                setIsLargeMapOpen(true);
              }}
              title="경로 그리기"
              type="button"
            >
              <Route aria-hidden size={16} />
            </button>
          </div>
        </div>
        {isOpen ? (
          <div className="schedule-date-map__body">
            <DatePlacesMapCanvas className="schedule-date-map__canvas" places={visiblePlaces} routeVisible={false} />
            <div className="schedule-date-map__places">
              {places.map((place, index) => {
                const isVisible = visiblePlaceKeySet.has(getPlanPlaceKey(place));

                return (
                  <button
                    aria-pressed={isVisible}
                    className={isVisible ? "schedule-date-map__place schedule-date-map__place--active" : "schedule-date-map__place"}
                    key={getPlanPlaceKey(place)}
                    onClick={() => togglePlaceVisibility(place)}
                    type="button"
                  >
                    <b>{index + 1}</b>
                    {place.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
      {isLargeMapOpen && isPortalReady ? createPortal(
        <div className="schedule-map-modal-backdrop" role="presentation" onMouseDown={() => setIsLargeMapOpen(false)}>
          <section aria-modal="true" className="schedule-map-modal" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
            <header className="schedule-map-modal__header">
              <div>
                <span>이날 간 장소</span>
                <h2>{visiblePlaces.length}/{places.length}곳 지도</h2>
              </div>
              <div className="schedule-map-modal__actions">
                <button
                  aria-label="경로 그리기"
                  className={isRouteVisible ? "schedule-date-map__route-button schedule-date-map__route-button--active" : "schedule-date-map__route-button"}
                  disabled={visiblePlaces.length < 2}
                  onClick={() => setIsRouteVisible((current) => !current)}
                  title="경로 그리기"
                  type="button"
                >
                  <Route aria-hidden size={16} />
                </button>
                <button onClick={() => setIsLargeMapOpen(false)} type="button">닫기</button>
              </div>
            </header>
            <div className="schedule-map-modal__content">
              <DatePlacesMapCanvas className="schedule-map-modal__canvas" places={visiblePlaces} routeVisible={isRouteVisible} />
              <ol className="schedule-map-modal__list">
                {places.map((place, index) => {
                  const isVisible = visiblePlaceKeySet.has(getPlanPlaceKey(place));

                  return (
                    <li className={isVisible ? "schedule-map-modal__place schedule-map-modal__place--active" : "schedule-map-modal__place"} key={getPlanPlaceKey(place)}>
                      <button aria-pressed={isVisible} onClick={() => togglePlaceVisibility(place)} type="button">
                        <b>{index + 1}</b>
                        <div>
                          <strong>{place.name}</strong>
                          {place.address ? <span>{place.address}</span> : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  );
}

function DatePlacesMapCanvas({ className, places, routeVisible }: { className: string; places: PlanPlace[]; routeVisible: boolean }) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const markersRef = useRef<NaverMarker[]>([]);
  const routeRef = useRef<NaverPolyline | null>(null);
  const [mapStatus, setMapStatus] = useState<"idle" | "loading" | "ready" | "missing" | "error">("idle");

  useEffect(() => {
    if (!naverMapClientId) {
      setMapStatus("missing");
      return;
    }

    if (window.naver?.maps) {
      setMapStatus("ready");
      return;
    }

    setMapStatus("loading");
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-dailyos-naver-map]");
    if (existingScript) {
      existingScript.addEventListener("load", () => setMapStatus("ready"), { once: true });
      existingScript.addEventListener("error", () => setMapStatus("error"), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.dataset.dailyosNaverMap = "true";
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(naverMapClientId)}`;
    script.async = true;
    script.onload = () => setMapStatus("ready");
    script.onerror = () => setMapStatus("error");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (mapStatus !== "ready" || !mapElementRef.current || !window.naver?.maps) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    routeRef.current?.setMap(null);
    routeRef.current = null;

    if (places.length === 0) return;

    const firstPlace = places[0];
    if (!mapRef.current) {
      mapRef.current = new window.naver.maps.Map(mapElementRef.current, {
        center: new window.naver.maps.LatLng(firstPlace.latitude, firstPlace.longitude),
        zoom: places.length === 1 ? 15 : 12,
      });
    }

    markersRef.current = places.map(
      (place, index) =>
        new window.naver!.maps.Marker({
          icon: {
            anchor: new window.naver!.maps.Point(16, 42),
            content: getSchedulePlaceMarkerContent(place, index),
          },
          map: mapRef.current!,
          position: new window.naver!.maps.LatLng(place.latitude, place.longitude),
          title: place.name,
        }),
    );

    if (routeVisible && places.length > 1) {
      routeRef.current = new window.naver.maps.Polyline({
        map: mapRef.current,
        path: places.map((place) => new window.naver!.maps.LatLng(place.latitude, place.longitude)),
        strokeColor: "#c8b6ff",
        strokeLineCap: "round",
        strokeLineJoin: "round",
        strokeOpacity: 0.95,
        strokeWeight: 5,
      });
    }

    if (places.length === 1) {
      mapRef.current.setCenter(new window.naver.maps.LatLng(firstPlace.latitude, firstPlace.longitude));
      mapRef.current.setZoom(15);
      return;
    }

    const bounds = new window.naver.maps.LatLngBounds();
    places.forEach((place) => bounds.extend(new window.naver!.maps.LatLng(place.latitude, place.longitude)));
    mapRef.current.fitBounds(bounds);
  }, [mapStatus, places, routeVisible]);

  return (
    <div className={className} ref={mapElementRef}>
      {mapStatus === "loading" ? <span>지도를 불러오는 중입니다.</span> : null}
      {mapStatus === "missing" ? <span>네이버 지도 키가 필요합니다.</span> : null}
      {mapStatus === "error" ? <span>지도를 불러오지 못했습니다.</span> : null}
      {mapStatus === "ready" && places.length === 0 ? <span>표시할 장소를 선택해 주세요.</span> : null}
    </div>
  );
}

function getSchedulePlaceMarkerContent(place: PlanPlace, index: number) {
  const safeName = escapeHtml(place.name);
  return `
    <div class="schedule-place-marker">
      <span>${index + 1}</span>
      <strong>${safeName}</strong>
    </div>
  `;
}
