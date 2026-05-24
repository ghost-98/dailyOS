"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, Folder, MapPin, Pencil, Plus, Search, Star, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/SectionCard";
import type { PlaceFolder, PlaceRecord } from "@/types/domain";
import {
  createPlaceFolderInDb,
  createPlaceInDb,
  deletePlaceFolderFromDb,
  deletePlaceFromDb,
  ensureDefaultPlaceFoldersInDb,
  fetchPlacesFromDb,
  setPlaceFolderLinksInDb,
  updatePlaceFolderInDb,
} from "./api";

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
        Point: new (x: number, y: number) => unknown;
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
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState(false);
  const [placePendingSave, setPlacePendingSave] = useState<PlaceRecord | null>(null);
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
    () => (selectedFolderId === allFolderId ? places : places.filter((place) => getPlaceFolderIds(place).includes(selectedFolderId))),
    [places, selectedFolderId],
  );

  const visiblePlaces = useMemo(() => {
    const merged = new Map<string, PlaceRecord>();
    for (const place of filteredSavedPlaces) merged.set(getPlaceKey(place), place);
    for (const place of searchResults) {
      const key = getPlaceKey(place);
      if (!merged.has(key)) merged.set(key, place);
    }
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
  }, [mapStatus, visiblePlaces, selectedPlace, folders, places, selectedFolderId]);

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

  const savePlaceFolders = async (place: PlaceRecord, folderIds: string[]) => {
    const uniqueFolderIds = [...new Set(folderIds)];
    const existingPlace = places.find((item) => isSamePlace(item, place));

    if (existingPlace) {
      if (uniqueFolderIds.length === 0) {
        await deletePlace(existingPlace.id);
        setPlacePendingSave(null);
        setMessage(`${existingPlace.name} 저장을 해제했습니다.`);
        return;
      }

      const didSyncFolders = await setPlaceFolderLinksInDb(existingPlace.id, uniqueFolderIds);
      if (!didSyncFolders) {
        setPlacePendingSave(null);
        setMessage("여러 폴더 저장을 쓰려면 Supabase에 장소 폴더 연결 SQL을 먼저 적용해 주세요.");
        return;
      }
      const nextPlace = { ...existingPlace, folderId: uniqueFolderIds[0], folderIds: uniqueFolderIds };
      setPlaces((current) => current.map((item) => (item.id === existingPlace.id ? nextPlace : item)));
      setSelectedPlace(nextPlace);
      setPlacePendingSave(null);
      setSelectedFolderId(uniqueFolderIds[0] ?? allFolderId);
      setMessage(`${existingPlace.name} 저장 폴더를 변경했습니다.`);
      return;
    }

    if (uniqueFolderIds.length === 0) {
      setPlacePendingSave(null);
      return;
    }

    const savedPlace = await createPlaceInDb({ ...place, folderId: uniqueFolderIds[0], folderIds: uniqueFolderIds });
    const nextPlace = { ...(savedPlace ?? place), folderId: uniqueFolderIds[0], folderIds: uniqueFolderIds };
    const didSyncFolders = await setPlaceFolderLinksInDb(nextPlace.id, uniqueFolderIds);
    const storedPlace = didSyncFolders ? nextPlace : { ...nextPlace, folderIds: [uniqueFolderIds[0]] };
    setPlaces((current) => [storedPlace, ...current]);
    setSelectedPlace(storedPlace);
    setSelectedFolderId(uniqueFolderIds[0]);
    setPlacePendingSave(null);
    setMessage(didSyncFolders ? `${nextPlace.name}을 저장했습니다.` : `${nextPlace.name}을 저장했습니다. 여러 폴더 저장은 Supabase SQL 적용 후 사용할 수 있습니다.`);
  };

  const deletePlace = async (id: string) => {
    await deletePlaceFromDb(id);
    setPlaces((current) => current.filter((place) => place.id !== id));
    if (selectedPlace?.id === id) setSelectedPlace(null);
  };

  const saveFolder = async (folder: PlaceFolder) => {
    const savedFolder = folder.id ? await updatePlaceFolderInDb(folder) : await createPlaceFolderInDb({ color: folder.color, icon: folder.icon, name: folder.name, sortOrder: folder.sortOrder });
    if (!savedFolder) return;
    setFolders((current) => {
      const exists = current.some((item) => item.id === savedFolder.id);
      const next = exists ? current.map((item) => (item.id === savedFolder.id ? savedFolder : item)) : [...current, savedFolder];
      return next.sort((a, b) => a.sortOrder - b.sortOrder);
    });
  };

  const deleteFolder = async (folderId: string) => {
    await deletePlaceFolderFromDb(folderId);
    setFolders((current) => current.filter((folder) => folder.id !== folderId));
    setPlaces((current) =>
      current.map((place) => {
        const nextFolderIds = getPlaceFolderIds(place).filter((id) => id !== folderId);
        return { ...place, folderId: nextFolderIds[0], folderIds: nextFolderIds };
      }),
    );
    if (selectedFolderId === folderId) setSelectedFolderId(allFolderId);
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
      const isSaved = places.some((item) => isSamePlace(item, place));
      const folder = resolveMarkerFolder(place, folders, selectedFolderId, isSaved);
      const marker = new window.naver!.maps.Marker({
        icon: {
          anchor: new window.naver!.maps.Point(18, 42),
          content: getMarkerContent(place, folder, isSaved),
        },
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
  const selectedPlaceFolders = folders.filter((folder) => selectedPlace && getPlaceFolderIds(selectedPlace).includes(folder.id));

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
                count={places.filter((place) => getPlaceFolderIds(place).includes(folder.id)).length}
                isActive={selectedFolderId === folder.id}
                key={folder.id}
                label={folder.name}
                onClick={() => setSelectedFolderId(folder.id)}
              />
            ))}
            <button className="places-folder places-folder--manage" onClick={() => setIsFolderManagerOpen(true)} type="button">
              <Plus aria-hidden size={14} />
              <strong>폴더 관리</strong>
            </button>
          </div>

          {selectedPlace ? (
            <SelectedPlacePanel
              folders={selectedPlaceFolders}
              isSaved={savedPlaceKeys.has(getPlaceKey(selectedPlace))}
              onDelete={selectedPlace.id && places.some((place) => place.id === selectedPlace.id) ? () => void deletePlace(selectedPlace.id) : undefined}
              onSave={() => setPlacePendingSave(selectedPlace)}
              place={selectedPlace}
            />
          ) : null}

          <div className="places-section">
            <div className="places-section__title">
              <strong>검색 결과</strong>
              <span>{searchResults.length}개</span>
            </div>
            <div className="places-list">
              {searchResults.length > 0 ? (
                searchResults.map((place) => {
                  const isSaved = savedPlaceKeys.has(getPlaceKey(place));
                  const savedPlace = places.find((item) => isSamePlace(item, place));
                  const savedFolders = folders.filter((folder) => savedPlace && getPlaceFolderIds(savedPlace).includes(folder.id));
                  return (
                    <PlaceItem
                      action={
                        <button
                          className={isSaved ? "place-item__saved-button" : ""}
                          disabled={folders.length === 0}
                          onClick={() => setPlacePendingSave(savedPlace ?? place)}
                          title={isSaved ? "저장 폴더 편집" : "폴더 선택 후 저장"}
                          type="button"
                        >
                          {isSaved ? <Check aria-hidden size={14} /> : <Plus aria-hidden size={14} />}
                        </button>
                      }
                      folders={savedFolders}
                      isSaved={isSaved}
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
                    folders={folders.filter((folder) => getPlaceFolderIds(place).includes(folder.id))}
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
              <strong>{selectedFolderId === allFolderId ? "전체 저장 장소" : `${selectedFolder?.name ?? "폴더"} 장소`}</strong>
            </div>
            <Badge tone="green">{visiblePlaces.length}개</Badge>
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

        </SectionCard>
      </div>

      {placePendingSave ? (
        <SavePlaceSheet
          folders={folders}
          onClose={() => setPlacePendingSave(null)}
          onSave={(folderIds) => void savePlaceFolders(placePendingSave, folderIds)}
          place={placePendingSave}
          savedFolderIds={getPlaceFolderIds(places.find((item) => isSamePlace(item, placePendingSave)) ?? placePendingSave)}
          recommendedFolderId={selectedFolderId === allFolderId ? selectedPlaceFolders[0]?.id ?? folders[0]?.id : selectedFolderId}
        />
      ) : null}

      {isFolderManagerOpen ? (
        <FolderManagerSheet
          folders={folders}
          onClose={() => setIsFolderManagerOpen(false)}
          onDelete={(folderId) => void deleteFolder(folderId)}
          onSave={(folder) => void saveFolder(folder)}
        />
      ) : null}
    </div>
  );
}

function FolderManagerSheet({
  folders,
  onClose,
  onDelete,
  onSave,
}: {
  folders: PlaceFolder[];
  onClose: () => void;
  onDelete: (folderId: string) => void;
  onSave: (folder: PlaceFolder) => void;
}) {
  const [editingFolder, setEditingFolder] = useState<PlaceFolder | null>(null);

  const startCreate = () => {
    setEditingFolder({
      id: "",
      color: "#9db2ff",
      icon: "dot",
      name: "",
      sortOrder: (folders.at(-1)?.sortOrder ?? 0) + 10,
    });
  };

  const save = () => {
    if (!editingFolder || editingFolder.name.trim().length === 0) return;
    onSave({ ...editingFolder, name: editingFolder.name.trim() });
    setEditingFolder(null);
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="folder-manager-title" aria-modal="true" className="event-sheet places-folder-sheet" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header">
          <div>
            <h2 id="folder-manager-title">폴더 관리</h2>
          </div>
          <button className="event-sheet__icon-button" aria-label="닫기" onClick={onClose} type="button">
            <X aria-hidden size={18} />
          </button>
        </header>

        <div className="places-folder-manager">
          <div className="places-folder-manager__list">
            {folders.map((folder) => (
              <article className="places-folder-row" key={folder.id}>
                <span style={{ backgroundColor: folder.color }} />
                <strong>{folder.name}</strong>
                <div>
                  <button aria-label="폴더 수정" onClick={() => setEditingFolder(folder)} type="button">
                    <Pencil aria-hidden size={14} />
                  </button>
                  <button aria-label="폴더 삭제" onClick={() => onDelete(folder.id)} type="button">
                    <Trash2 aria-hidden size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>

          {editingFolder ? (
            <div className="places-folder-form">
              <label>
                <span>폴더명</span>
                <input value={editingFolder.name} onChange={(event) => setEditingFolder((current) => (current ? { ...current, name: event.target.value } : current))} />
              </label>
              <label>
                <span>색상</span>
                <input type="color" value={editingFolder.color} onChange={(event) => setEditingFolder((current) => (current ? { ...current, color: event.target.value } : current))} />
              </label>
              <footer>
                <button className="event-sheet__secondary-button" onClick={() => setEditingFolder(null)} type="button">
                  취소
                </button>
                <button className="event-sheet__primary-button" disabled={editingFolder.name.trim().length === 0} onClick={save} type="button">
                  저장
                </button>
              </footer>
            </div>
          ) : (
            <button className="places-folder-add" onClick={startCreate} type="button">
              <Plus aria-hidden size={15} />
              새 폴더 추가
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function SavePlaceSheet({
  folders,
  onClose,
  onSave,
  place,
  recommendedFolderId,
  savedFolderIds,
}: {
  folders: PlaceFolder[];
  onClose: () => void;
  onSave: (folderIds: string[]) => void;
  place: PlaceRecord;
  recommendedFolderId?: string;
  savedFolderIds: string[];
}) {
  const initialFolderIds = savedFolderIds.length > 0 ? savedFolderIds : recommendedFolderId ? [recommendedFolderId] : [];
  const [checkedFolderIds, setCheckedFolderIds] = useState(initialFolderIds);
  const toggleFolder = (folderId: string) => {
    setCheckedFolderIds((current) => (current.includes(folderId) ? current.filter((id) => id !== folderId) : [...current, folderId]));
  };

  return (
    <div className="event-sheet-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="save-place-title" aria-modal="true" className="event-sheet places-save-sheet" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <div className="event-sheet__grabber" aria-hidden />
        <header className="event-sheet__header">
          <div>
            <h2 id="save-place-title">장소 저장</h2>
          </div>
          <button className="event-sheet__icon-button" aria-label="닫기" onClick={onClose} type="button">
            <X aria-hidden size={18} />
          </button>
        </header>

        <div className="places-save-target">
          <MapPin aria-hidden size={17} />
          <div>
            <strong>{place.name}</strong>
            <span>{place.address}</span>
          </div>
        </div>

        <div className="places-save-folder-grid">
          {folders.map((folder) => (
            <button className={checkedFolderIds.includes(folder.id) ? "places-save-folder places-save-folder--active" : "places-save-folder"} key={folder.id} onClick={() => toggleFolder(folder.id)} type="button">
              <span style={{ backgroundColor: folder.color }}>
                {checkedFolderIds.includes(folder.id) ? <Check aria-hidden size={13} /> : <Star aria-hidden size={13} />}
              </span>
              <strong>{folder.name}</strong>
            </button>
          ))}
        </div>

        <footer className="event-sheet__footer">
          <button className="event-sheet__secondary-button" onClick={onClose} type="button">
            취소
          </button>
          <button className="event-sheet__primary-button" onClick={() => onSave(checkedFolderIds)} type="button">
            적용
          </button>
        </footer>
      </section>
    </div>
  );
}

function SelectedPlacePanel({
  folders,
  isSaved,
  onDelete,
  onSave,
  place,
}: {
  folders: PlaceFolder[];
  isSaved: boolean;
  onDelete?: () => void;
  onSave: () => void;
  place: PlaceRecord;
}) {
  return (
    <section className="places-selected-panel" aria-label="선택 장소 정보">
      <div className="places-selected-panel__head">
        <div className="places-selected-panel__mark" style={{ backgroundColor: folders[0]?.color ?? "var(--violet)" }}>
          {isSaved ? <Star aria-hidden size={17} /> : <MapPin aria-hidden size={17} />}
        </div>
        <div>
          <span>{isSaved ? folders.map((folder) => folder.name).join(", ") || "저장됨" : "검색 결과"}</span>
          <strong>{place.name}</strong>
        </div>
      </div>
      <p>{place.address}</p>
      <div className="places-selected__meta">
        {place.category ? <Badge tone="violet">{place.category}</Badge> : null}
        {place.phone ? <span>{place.phone}</span> : null}
        {place.url ? (
          <a href={place.url} rel="noreferrer" target="_blank">
            링크 열기
          </a>
        ) : null}
      </div>
      <div className="places-selected-panel__actions">
        {isSaved ? (
          <button className="places-selected-panel__button places-selected-panel__button--muted" onClick={onSave} type="button">
            <Check aria-hidden size={15} />
            저장 폴더 편집
          </button>
        ) : (
          <button className="places-selected-panel__button" onClick={onSave} type="button">
            <Star aria-hidden size={15} />
            폴더에 저장
          </button>
        )}
        {onDelete ? (
          <button className="places-selected-panel__icon" aria-label="장소 삭제" onClick={onDelete} type="button">
            <Trash2 aria-hidden size={15} />
          </button>
        ) : null}
      </div>
    </section>
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
  folders = [],
  isSaved,
  isActive,
  onSelect,
  place,
}: {
  action: ReactNode;
  folders?: PlaceFolder[];
  isSaved?: boolean;
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
            {folders[0] ? <i style={{ backgroundColor: folders[0].color }} /> : null}
            {isSaved ? `${formatFolderNames(folders)}에 저장됨` : place.category || folders[0]?.name || "장소"}
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

function getPlaceFolderIds(place: PlaceRecord) {
  return [...new Set([...(place.folderIds ?? []), place.folderId].filter((folderId): folderId is string => Boolean(folderId)))];
}

function formatFolderNames(folders: PlaceFolder[]) {
  if (folders.length === 0) return "저장됨";
  if (folders.length <= 2) return folders.map((folder) => folder.name).join(", ");
  return `${folders[0].name} 외 ${folders.length - 1}`;
}

function isSamePlace(left: PlaceRecord, right: PlaceRecord) {
  return getPlaceKey(left) === getPlaceKey(right);
}

function resolveMarkerFolder(place: PlaceRecord, folders: PlaceFolder[], selectedFolderId: string, isSaved: boolean) {
  if (!isSaved) return undefined;

  const placeFolderIds = getPlaceFolderIds(place);
  if (selectedFolderId !== allFolderId && placeFolderIds.includes(selectedFolderId)) {
    return folders.find((folder) => folder.id === selectedFolderId);
  }

  return folders.find((folder) => placeFolderIds.includes(folder.id));
}

function getMarkerContent(place: PlaceRecord, folder: PlaceFolder | undefined, isSaved: boolean) {
  const color = folder?.color ?? (isSaved ? "#9db2ff" : "#a7a8ae");
  const safeName = escapeHtml(place.name);
  return `
    <button class="map-place-marker ${isSaved ? "map-place-marker--saved" : "map-place-marker--search"}" type="button">
      <span class="map-place-marker__star" style="background:${color}">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.8l2.73 5.54 6.12.89-4.43 4.32 1.05 6.1L12 16.78l-5.47 2.87 1.05-6.1-4.43-4.32 6.12-.89L12 2.8z"></path>
        </svg>
      </span>
      <strong>${safeName}</strong>
    </button>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
