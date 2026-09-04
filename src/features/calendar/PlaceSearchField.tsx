"use client";

import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import type { PlanPlace, PlaceRecord } from "@/types/domain";

export function PlaceSearchField({ onSelect, selectedPlace }: { onSelect: (place: PlanPlace | undefined) => void; selectedPlace?: PlanPlace }) {
  const [query, setQuery] = useState(selectedPlace?.name ?? "");
  const [results, setResults] = useState<PlaceRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [message, setMessage] = useState("");

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

  return (
    <div className="event-form-card planner-place-card">
      <div className="planner-place-card__header">
        <div>
          <strong>{selectedPlace ? selectedPlace.name : "장소 선택"}</strong>
        </div>
        {selectedPlace ? (
          <button onClick={clearPlace} type="button">
            선택 해제
          </button>
        ) : null}
      </div>

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
