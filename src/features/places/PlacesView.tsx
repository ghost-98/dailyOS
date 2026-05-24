"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MapPin, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import type { PlaceRecord } from "@/types/domain";
import { createPlaceInDb, deletePlaceFromDb, fetchPlacesFromDb } from "./api";

type SearchResponse = {
  error?: string;
  places: PlaceRecord[];
};

type NaverLatLng = unknown;
type NaverMap = {
  setCenter: (latLng: NaverLatLng) => void;
  setZoom: (zoom: number) => void;
};
type NaverMarker = {
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
        Map: new (element: HTMLElement, options: Record<string, unknown>) => NaverMap;
        Marker: new (options: Record<string, unknown>) => NaverMarker;
      };
    };
  }
}

const naverMapClientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID;
const defaultCenter = { latitude: 37.5666103, longitude: 126.9783882 };

export function PlacesView() {
  const [places, setPlaces] = useState<PlaceRecord[]>([]);
  const [searchResults, setSearchResults] = useState<PlaceRecord[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<PlaceRecord | null>(null);
  const [query, setQuery] = useState("");
  const [mapStatus, setMapStatus] = useState<"idle" | "ready" | "missing-key" | "error">("idle");
  const [message, setMessage] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const markersRef = useRef<NaverMarker[]>([]);

  useEffect(() => {
    let isMounted = true;

    fetchPlacesFromDb()
      .then((dbPlaces) => {
        if (!isMounted) return;
        const nextPlaces = dbPlaces ?? [];
        setPlaces(nextPlaces);
        setSelectedPlace(nextPlaces[0] ?? null);
      })
      .catch((error) => {
        console.error("Failed to load places from Supabase", error);
        if (isMounted) setMessage("저장된 장소를 불러오지 못했습니다. Supabase 스키마를 확인해 주세요.");
      })
      .finally(() => {
        if (isMounted) setIsLoadingPlaces(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!naverMapClientId) {
      setMapStatus("missing-key");
      return;
    }

    if (window.naver?.maps) {
      setMapStatus("ready");
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-dailyos-naver-map]");
    if (existingScript) {
      existingScript.addEventListener("load", () => setMapStatus("ready"), { once: true });
      existingScript.addEventListener("error", () => setMapStatus("error"), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.dataset.dailyosNaverMap = "true";
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(naverMapClientId)}`;
    script.onload = () => setMapStatus("ready");
    script.onerror = () => setMapStatus("error");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (mapStatus !== "ready" || !mapElementRef.current || !window.naver?.maps) return;

    if (!mapRef.current) {
      const initialPlace = selectedPlace ?? places[0];
      const center = new window.naver.maps.LatLng(initialPlace?.latitude ?? defaultCenter.latitude, initialPlace?.longitude ?? defaultCenter.longitude);
      mapRef.current = new window.naver.maps.Map(mapElementRef.current, {
        center,
        zoom: initialPlace ? 14 : 11,
      });
    }

    renderMarkers();
  }, [mapStatus, places, selectedPlace]);

  const visiblePlaces = useMemo(() => {
    const merged = new Map<string, PlaceRecord>();
    for (const place of places) merged.set(place.id, place);
    for (const place of searchResults) merged.set(place.id, place);
    return [...merged.values()];
  }, [places, searchResults]);

  const searchPlaces = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setIsSearching(true);
    setMessage("");

    try {
      const response = await fetch(`/api/maps/geocode?query=${encodeURIComponent(trimmedQuery)}`);
      const payload = (await response.json()) as SearchResponse;

      if (!response.ok) {
        setSearchResults([]);
        setMessage(payload.error ?? "장소 검색에 실패했습니다.");
        return;
      }

      setSearchResults(payload.places);
      setSelectedPlace(payload.places[0] ?? null);
      if (payload.places.length === 0) setMessage("검색 결과가 없습니다. 주소를 조금 더 구체적으로 입력해 주세요.");
    } catch (error) {
      console.error("Failed to search places", error);
      setMessage("장소 검색 중 문제가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const savePlace = async (place: PlaceRecord) => {
    const savedPlace = await createPlaceInDb(place);
    const nextPlace = savedPlace ?? place;
    setPlaces((current) => (current.some((item) => item.id === nextPlace.id) ? current : [nextPlace, ...current]));
    setSelectedPlace(nextPlace);
  };

  const deletePlace = async (id: string) => {
    await deletePlaceFromDb(id);
    setPlaces((current) => current.filter((place) => place.id !== id));
    if (selectedPlace?.id === id) setSelectedPlace(null);
  };

  const focusPlace = (place: PlaceRecord) => {
    setSelectedPlace(place);
    if (!mapRef.current || !window.naver?.maps) return;
    mapRef.current.setCenter(new window.naver.maps.LatLng(place.latitude, place.longitude));
    mapRef.current.setZoom(15);
  };

  const renderMarkers = () => {
    if (!mapRef.current || !window.naver?.maps) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = visiblePlaces.map((place) => {
      const marker = new window.naver!.maps.Marker({
        map: mapRef.current,
        position: new window.naver!.maps.LatLng(place.latitude, place.longitude),
        title: place.name,
      });
      window.naver!.maps.Event.addListener(marker, "click", () => focusPlace(place));
      return marker;
    });

    if (selectedPlace) {
      mapRef.current.setCenter(new window.naver.maps.LatLng(selectedPlace.latitude, selectedPlace.longitude));
    }
  };

  const savedIds = new Set(places.map((place) => `${place.latitude},${place.longitude},${place.address}`));

  return (
    <div className="places-page">
      <header className="page-header places-header">
        <div>
          <h1>지도</h1>
        </div>
      </header>

      <div className="places-layout">
        <SectionCard className="places-panel">
          <div className="places-search">
            <label>
              <span>장소 검색</span>
              <div className="places-search__control">
                <Search aria-hidden size={17} />
                <input
                  placeholder="주소나 장소명을 입력하세요"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void searchPlaces();
                  }}
                />
                <button disabled={isSearching || query.trim().length === 0} onClick={() => void searchPlaces()} type="button">
                  검색
                </button>
              </div>
            </label>
            {message ? <p className="places-message">{message}</p> : null}
          </div>

          <div className="places-section">
            <div className="places-section__title">
              <strong>검색 결과</strong>
              <span>{searchResults.length}개</span>
            </div>
            <div className="places-list">
              {searchResults.length > 0 ? (
                searchResults.map((place) => {
                  const isSaved = savedIds.has(`${place.latitude},${place.longitude},${place.address}`);
                  return (
                    <PlaceItem
                      action={
                        <button disabled={isSaved} onClick={() => void savePlace(place)} type="button">
                          <Plus aria-hidden size={14} />
                        </button>
                      }
                      isActive={selectedPlace?.id === place.id}
                      key={place.id}
                      onSelect={() => focusPlace(place)}
                      place={place}
                    />
                  );
                })
              ) : (
                <EmptyPlaces label="검색 결과가 없습니다." />
              )}
            </div>
          </div>

          <div className="places-section">
            <div className="places-section__title">
              <strong>저장한 장소</strong>
              <span>{places.length}개</span>
            </div>
            <div className="places-list">
              {places.length > 0 ? (
                places.map((place) => (
                  <PlaceItem
                    action={
                      <button aria-label="장소 삭제" onClick={() => void deletePlace(place.id)} type="button">
                        <Trash2 aria-hidden size={14} />
                      </button>
                    }
                    isActive={selectedPlace?.id === place.id}
                    key={place.id}
                    onSelect={() => focusPlace(place)}
                    place={place}
                  />
                ))
              ) : (
                <EmptyPlaces label={isLoadingPlaces ? "저장한 장소를 불러오는 중입니다." : "저장한 장소가 없습니다."} />
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard className="places-map-card">
          <div className="places-map-toolbar">
            <div>
              <span>지도 보기</span>
              <strong>{selectedPlace?.name ?? "장소를 검색하거나 선택하세요"}</strong>
            </div>
            {selectedPlace ? <Badge tone="green">{selectedPlace.provider === "naver" ? "NAVER" : "직접 입력"}</Badge> : null}
          </div>

          <div className="places-map-shell">
            <div className="places-map" ref={mapElementRef} />
            {mapStatus !== "ready" ? (
              <div className="places-map-state">
                <MapPin aria-hidden size={32} />
                <strong>{mapStatus === "missing-key" ? "네이버 지도 키가 필요합니다." : "지도를 불러오는 중입니다."}</strong>
                <p>
                  `.env.local`에 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`를 넣으면 이 영역에 네이버 지도가 표시됩니다.
                </p>
              </div>
            ) : null}
          </div>

          {selectedPlace ? (
            <div className="places-selected">
              <span>선택 장소</span>
              <strong>{selectedPlace.name}</strong>
              <p>{selectedPlace.address}</p>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}

function PlaceItem({
  action,
  isActive,
  onSelect,
  place,
}: {
  action: ReactNode;
  isActive: boolean;
  onSelect: () => void;
  place: PlaceRecord;
}) {
  return (
    <article className={`place-item ${isActive ? "place-item--active" : ""}`}>
      <button className="place-item__main" onClick={onSelect} type="button">
        <MapPin aria-hidden size={16} />
        <span>
          <strong>{place.name}</strong>
          <em>{place.address}</em>
        </span>
      </button>
      <div className="place-item__action">{action}</div>
    </article>
  );
}

function EmptyPlaces({ label }: { label: string }) {
  return (
    <div className="places-empty">
      <MapPin aria-hidden size={24} />
      <span>{label}</span>
    </div>
  );
}
