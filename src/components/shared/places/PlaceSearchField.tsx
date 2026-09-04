"use client";

import { useEffect, useState } from "react";
import { Bookmark, MapPin, Search, X } from "lucide-react";
import type { PlanPlace, PlaceRecord } from "@/types/domain";

const SAVED_PLACES_STORAGE_KEY = "dailyos.record.savedPlaces";

export function PlaceSearchField({ onSelect, selectedPlace }: { onSelect: (place: PlanPlace | undefined) => void; selectedPlace?: PlanPlace }) {
  const [query, setQuery] = useState(selectedPlace?.name ?? "");
  const [results, setResults] = useState<PlaceRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [savedPlaces, setSavedPlaces] = useState<PlanPlace[]>([]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SAVED_PLACES_STORAGE_KEY);
      if (saved) setSavedPlaces(JSON.parse(saved) as PlanPlace[]);
    } catch {
      setSavedPlaces([]);
    }
  }, []);

  const searchPlaces = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setIsSearching(true);
    setMessage("");

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

  const clearPlace = () => {
    onSelect(undefined);
    setQuery("");
    setResults([]);
    setMessage("");
  };

  const saveCurrentPlace = () => {
    if (!selectedPlace || savedPlaces.some((place) => getPlaceKey(place) === getPlaceKey(selectedPlace))) return;
    const nextPlaces = [...savedPlaces, selectedPlace];
    setSavedPlaces(nextPlaces);
    window.localStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify(nextPlaces));
  };

  const removeSavedPlace = (target: PlanPlace) => {
    const nextPlaces = savedPlaces.filter((place) => getPlaceKey(place) !== getPlaceKey(target));
    setSavedPlaces(nextPlaces);
    window.localStorage.setItem(SAVED_PLACES_STORAGE_KEY, JSON.stringify(nextPlaces));
  };

  return (
    <div className="planner-place-field">
      {selectedPlace ? <div className="planner-place-card__header">
        <strong>{selectedPlace.name}</strong>
        <div className="planner-place-card__actions">
          <button disabled={savedPlaces.some((place) => getPlaceKey(place) === getPlaceKey(selectedPlace))} onClick={saveCurrentPlace} type="button">
            <Bookmark aria-hidden size={13} /> 내 장소
          </button>
        {selectedPlace ? (
          <button onClick={clearPlace} type="button">
            <X aria-hidden size={13} /> 해제
          </button>
        ) : null}
        </div>
      </div> : null}

      {savedPlaces.length > 0 ? (
        <div className="planner-saved-places" aria-label="내 장소">
          {savedPlaces.map((place) => (
            <span key={getPlaceKey(place)}>
              <button onClick={() => { onSelect(place); setQuery(place.name); }} type="button"><Bookmark aria-hidden size={12} />{place.name}</button>
              <button aria-label={`${place.name} 내 장소 삭제`} onClick={() => removeSavedPlace(place)} type="button"><X aria-hidden size={11} /></button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="planner-place-search">
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
        <button disabled={isSearching || query.trim().length === 0} onClick={() => void searchPlaces()} type="button">
          <Search aria-hidden size={16} />
          {isSearching ? "검색 중" : "검색"}
        </button>
      </div>

      {selectedPlace ? (
        <p className="date-event__place">
          <MapPin aria-hidden size={14} />
          <span>{selectedPlace.name}</span>
          {selectedPlace.address ? <em>{selectedPlace.address}</em> : null}
        </p>
      ) : null}
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
    </div>
  );
}

function getPlaceKey(place: PlanPlace) {
  return `${place.providerPlaceId ?? ""}|${place.name}|${place.address}`;
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



