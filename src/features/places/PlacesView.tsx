"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Folder, MapPin, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import type { PlaceFolder, PlaceRecord } from "@/types/domain";
import { createPlaceInDb, deletePlaceFromDb, ensureDefaultPlaceFoldersInDb, fetchPlacesFromDb } from "./api";

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
const allFolderId = "all";

export function PlacesView() {
  const [folders, setFolders] = useState<PlaceFolder[]>([]);
  const [places, setPlaces] = useState<PlaceRecord[]>([]);
  const [searchResults, setSearchResults] = useState<PlaceRecord[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState(allFolderId);
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

    Promise.all([ensureDefaultPlaceFoldersInDb(), fetchPlacesFromDb()])
      .then(([dbFolders, dbPlaces]) => {
        if (!isMounted) return;
        const nextFolders = dbFolders ?? [];
        const nextPlaces = dbPlaces ?? [];
        setFolders(nextFolders);
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

  const filteredSavedPlaces = useMemo(
    () => (selectedFolderId === allFolderId ? places : places.filter((place) => place.folderId === selectedFolderId)),
    [places, selectedFolderId],
  );

  const visiblePlaces = useMemo(() => {
    const merged = new Map<string, PlaceRecord>();
    for (const place of filteredSavedPlaces) merged.set(place.id, place);
    for (const place of searchResults) merged.set(place.id, place);
    return [...merged.values()];
  }, [filteredSavedPlaces, searchResults]);

  useEffect(() => {
    if (mapStatus !== "ready" || !mapElementRef.current || !window.naver?.maps) return;

    if (!mapRef.current) {
      const initialPlace = selectedPlace ?? visiblePlaces[0];
      const center = new window.naver.maps.LatLng(initialPlace?.latitude ?? defaultCenter.latitude, initialPlace?.longitude ?? defaultCenter.longitude);
      mapRef.current = new window.naver.maps.Map(mapElementRef.current, {
        center,
        zoom: initialPlace ? 14 : 11,
      });
    }

    renderMarkers();
  }, [mapStatus, visiblePlaces, selectedPlace]);

  const searchPlaces = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setIsSearching(true);
    setMessage("");

    try {
      const response = await fetch(`/api/maps/search-place?query=${encodeURIComponent(trimmedQuery)}`);
      const payload = (await response.json()) as SearchResponse;

      if (!response.ok) {
        setSearchResults([]);
        setMessage(payload.error ?? "장소 검색에 실패했습니다.");
        return;
      }

      setSearchResults(payload.places);
      setSelectedPlace(payload.places[0] ?? null);
      if (payload.places.length === 0) setMessage("검색 결과가 없습니다. 다른 장소명이나 주소로 다시 검색해 주세요.");
    } catch (error) {
      console.error("Failed to search places", error);
      setMessage("장소 검색 중 문제가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const savePlace = async (place: PlaceRecord) => {
    const folderId = selectedFolderId === allFolderId ? folders[0]?.id : selectedFolderId;
    const savedPlace = await createPlaceInDb({ ...place, folderId });
    const nextPlace = savedPlace ?? { ...place, folderId };
    setPlaces((current) => (current.some((item) => isSamePlace(item, nextPlace)) ? current : [nextPlace, ...current]));
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

    const centerPlace = selectedPlace ?? visiblePlaces[0];
    if (centerPlace) {
      mapRef.current.setCenter(new window.naver.maps.LatLng(centerPlace.latitude, centerPlace.longitude));
    }
  };

  const savedPlaceKeys = new Set(places.map(getPlaceKey));
  const selectedFolder = folders.find((folder) => folder.id === selectedFolderId);

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
                  placeholder="서울시청, 강남역 카페, 한국전력공사"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void searchPlaces();
                  }}
                />
                <button disabled={isSearching || query.trim().length === 0} onClick={() => void searchPlaces()} type="button">
                  {isSearching ? "검색 중" : "검색"}
                </button>
              </div>
            </label>
            {message ? <p className="places-message">{message}</p> : null}
          </div>

          <div className="places-folder-strip" aria-label="장소 폴더">
            <FolderButton count={places.length} isActive={selectedFolderId === allFolderId} label="전체" onClick={() => setSelectedFolderId(allFolderId)} />
            {folders.map((folder) => (
              <FolderButton
                color={folder.color}
                count={places.filter((place) => place.folderId === folder.id).length}
                isActive={selectedFolderId === folder.id}
                key={folder.id}
                label={folder.name}
                onClick={() => setSelectedFolderId(folder.id)}
              />
            ))}
          </div>

          <div className="places-section">
            <div className="places-section__title">
              <strong>검색 결과</strong>
              <span>{searchResults.length}개</span>
            </div>
            <div className="places-list">
              {searchResults.length > 0 ? (
                searchResults.map((place) => {
                  const isSaved = savedPlaceKeys.has(getPlaceKey(place));
                  return (
                    <PlaceItem
                      action={
                        <button disabled={isSaved || folders.length === 0} onClick={() => void savePlace(place)} title={selectedFolder ? `${selectedFolder.name}에 저장` : "저장"} type="button">
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
              <strong>{selectedFolderId === allFolderId ? "저장한 장소" : `${selectedFolder?.name ?? "폴더"} 장소`}</strong>
              <span>{filteredSavedPlaces.length}개</span>
            </div>
            <div className="places-list">
              {filteredSavedPlaces.length > 0 ? (
                filteredSavedPlaces.map((place) => (
                  <PlaceItem
                    action={
                      <button aria-label="장소 삭제" onClick={() => void deletePlace(place.id)} type="button">
                        <Trash2 aria-hidden size={14} />
                      </button>
                    }
                    folder={folders.find((folder) => folder.id === place.folderId)}
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
                <p>`.env.local`에 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`를 넣으면 이 영역에 네이버 지도가 표시됩니다.</p>
              </div>
            ) : null}
          </div>

          {selectedPlace ? (
            <div className="places-selected">
              <span>선택 장소</span>
              <strong>{selectedPlace.name}</strong>
              <p>{selectedPlace.address}</p>
              <div className="places-selected__meta">
                {selectedPlace.category ? <Badge tone="violet">{selectedPlace.category}</Badge> : null}
                {selectedPlace.phone ? <span>{selectedPlace.phone}</span> : null}
                {selectedPlace.url ? (
                  <a href={selectedPlace.url} rel="noreferrer" target="_blank">
                    링크 열기
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}

function FolderButton({
  color,
  count,
  isActive,
  label,
  onClick,
}: {
  color?: string;
  count: number;
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={`places-folder ${isActive ? "places-folder--active" : ""}`} onClick={onClick} type="button">
      <span className="places-folder__mark" style={{ backgroundColor: color ?? "var(--violet)" }}>
        <Folder aria-hidden size={13} />
      </span>
      <strong>{label}</strong>
      <em>{count}</em>
    </button>
  );
}

function PlaceItem({
  action,
  folder,
  isActive,
  onSelect,
  place,
}: {
  action: ReactNode;
  folder?: PlaceFolder;
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
          <small>
            {folder ? <i style={{ backgroundColor: folder.color }} /> : null}
            {place.category || folder?.name || "장소"}
          </small>
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

function getPlaceKey(place: PlaceRecord) {
  return `${place.providerPlaceId ?? ""}|${place.name}|${place.address}`;
}

function isSamePlace(left: PlaceRecord, right: PlaceRecord) {
  return getPlaceKey(left) === getPlaceKey(right);
}
