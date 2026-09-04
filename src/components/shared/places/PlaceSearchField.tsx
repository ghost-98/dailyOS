"use client";

import { useEffect, useState } from "react";
import { Bookmark, MapPin, Search, Star, X } from "lucide-react";
import type { PlanPlace, PlaceRecord } from "@/types/domain";

const SAVED_PLACES_STORAGE_KEY = "dailyos.record.savedPlaces";

export function PlaceSearchField({ onSelect, selectedPlace }: { onSelect: (place: PlanPlace | undefined) => void; selectedPlace?: PlanPlace }) {
  const [query, setQuery] = useState(selectedPlace?.name ?? "");
  const [mode, setMode] = useState<"search" | "saved">("search");
  const [results, setResults] = useState<PlaceRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [savedPlaces, setSavedPlaces] = useState<PlanPlace[]>([]);
  const isSelectedPlaceSaved = Boolean(selectedPlace && savedPlaces.some((place) => getPlaceKey(place) === getPlaceKey(selectedPlace)));

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SAVED_PLACES_STORAGE_KEY);
      if (saved) setSavedPlaces(JSON.parse(saved) as PlanPlace[]);
    } catch {
      setSavedPlaces([]);
    }
  }, []);

  useEffect(() => {
    setQuery(selectedPlace?.name ?? "");
  }, [selectedPlace?.name]);

  const searchPlaces = async (value?: string) => {
    const trimmedQuery = (value ?? query).trim();
    if (!trimmedQuery) return;

    setIsSearching(true);
    setMessage("");
    setMode("search");

    try {
      const response = await fetch(`/api/maps/search-place?query=${encodeURIComponent(trimmedQuery)}`);
      const payload = await readPlaceSearchResponse(response);
      if (!response.ok) {
        setMessage(payload.error ?? "장소 검색에 실패했습니다.");
        setResults([]);
        return;
      }

      const nextResults = payload.places ?? [];
      setResults(nextResults);
      if (nextResults.length === 0) setMessage("검색 결과가 없습니다.");
    } catch (error) {
      console.error("Failed to search place", error);
      setMessage("장소 검색 중 문제가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const chooseMapPlace = (place: PlaceRecord) => {
    onSelect(convertPlaceRecordToPlanPlace(place));
    setQuery(place.name);
    setMessage("");
  };

  const saveCurrentPlace = () => {
    if (!selectedPlace) return;
    const selectedKey = getPlaceKey(selectedPlace);
    const nextPlaces = isSelectedPlaceSaved
      ? savedPlaces.filter((place) => getPlaceKey(place) !== selectedKey)
      : [...savedPlaces, { ...selectedPlace, name: selectedPlace.name.trim() }];
    setSavedPlaces(nextPlaces);
    window.localStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify(nextPlaces));
  };

  const removeSavedPlace = (target: PlanPlace) => {
    const nextPlaces = savedPlaces.filter((place) => getPlaceKey(place) !== getPlaceKey(target));
    setSavedPlaces(nextPlaces);
    window.localStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify(nextPlaces));
  };

  return (
    <div className="planner-place-panel">
      <div className="planner-place-panel__top">
        <div className="planner-place-mode" role="tablist" aria-label="장소">
          <button
            aria-pressed={mode === "search"}
            className={mode === "search" ? "planner-place-mode__button planner-place-mode__button--active" : "planner-place-mode__button"}
            onClick={() => setMode("search")}
            type="button"
          >
            장소 검색
          </button>
          <button
            aria-pressed={mode === "saved"}
            className={mode === "saved" ? "planner-place-mode__button planner-place-mode__button--active" : "planner-place-mode__button"}
            onClick={() => setMode("saved")}
            type="button"
          >
            <Star aria-hidden size={12} /> 내 장소
          </button>
        </div>

        {mode === "search" && selectedPlace ? (
          <div className="planner-place-panel__selected">
            <input
              aria-label="내 장소 이름"
              onChange={(event) => onSelect({ ...selectedPlace, name: event.target.value })}
              placeholder="내 장소 이름"
              value={selectedPlace.name}
            />
            <div className="planner-place-panel__selected-actions">
              <button
                aria-label={isSelectedPlaceSaved ? "내 장소 저장 해제" : "내 장소 저장"}
                className={isSelectedPlaceSaved ? "planner-place-panel__bookmark planner-place-panel__bookmark--saved" : "planner-place-panel__bookmark"}
                disabled={!selectedPlace.name.trim()}
                onClick={saveCurrentPlace}
                type="button"
              >
                <Bookmark aria-hidden fill={isSelectedPlaceSaved ? "currentColor" : "none"} size={15} />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="planner-place-panel__body">
        {mode === "search" ? (
          <>
            <div className="planner-place-search ui-input-shell">
              <MapPin aria-hidden size={18} />
              <input
                placeholder="장소명이나 주소 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void searchPlaces();
                  }
                }}
              />
              <button aria-label="장소 검색" disabled={isSearching || query.trim().length === 0} onClick={() => void searchPlaces()} type="button">
                <Search aria-hidden size={14} />
              </button>
            </div>

            {message ? <p className="planner-place-message">{message}</p> : null}

            {results.length > 0 ? (
              <div className="planner-place-results">
                {results.map((place) => (
                  <button key={`${place.providerPlaceId ?? place.id}-${place.name}`} onClick={() => chooseMapPlace(place)} type="button">
                    <strong>{place.name}</strong>
                    <span>{place.address || place.category || "주소 정보 없음"}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <div className="planner-place-saved-list" aria-label="내 장소">
            {savedPlaces.length > 0 ? (
              savedPlaces.map((place) => (
                <div className="planner-place-saved-list__item" key={getPlaceKey(place)}>
                  <button onClick={() => { onSelect(place); setQuery(place.name); }} type="button">
                    <strong>{place.name}</strong>
                    <span>{place.address || "주소 정보 없음"}</span>
                  </button>
                  <button aria-label={`${place.name} 내 장소 삭제`} onClick={() => removeSavedPlace(place)} type="button">
                    <X aria-hidden size={11} />
                  </button>
                </div>
              ))
            ) : (
              <div className="planner-place-empty">
                <strong>아직 저장한 장소가 없어요.</strong>
                <p>자주 가는 장소를 저장해 두면 다음 입력이 더 빨라집니다.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getPlaceKey(place: PlanPlace) {
  const normalizedAddress = place.address.trim().toLowerCase();
  if (normalizedAddress) return normalizedAddress;
  if (place.providerPlaceId) return `provider:${place.providerPlaceId}`;
  return `coordinates:${place.latitude.toFixed(6)},${place.longitude.toFixed(6)}`;
}

async function readPlaceSearchResponse(response: Response): Promise<{ places?: PlaceRecord[]; error?: string }> {
  const body = await response.text();
  if (!body.trim()) {
    return { error: "장소 검색 응답이 비어 있습니다.", places: [] };
  }

  try {
    return JSON.parse(body) as { places?: PlaceRecord[]; error?: string };
  } catch {
    return { error: "장소 검색 응답을 읽지 못했습니다.", places: [] };
  }
}

function convertPlaceRecordToPlanPlace(place: PlaceRecord): PlanPlace {
  return {
    name: place.name,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    providerPlaceId: place.providerPlaceId,
    phone: place.phone,
    category: place.category,
    url: place.url,
  };
}
