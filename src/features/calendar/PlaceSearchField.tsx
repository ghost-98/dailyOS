"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, Search, Star } from "lucide-react";
import { PlaceLine } from "@/features/calendar/components";
import { fetchPersonalPlacesFromDb } from "@/features/personalPlaces/api";
import type { PersonalPlaceRecord, PlanPlace, PlaceRecord } from "@/types/domain";

type SearchMode = "map" | "saved";

export function PlaceSearchField({ onSelect, selectedPlace }: { onSelect: (place: PlanPlace | undefined) => void; selectedPlace?: PlanPlace }) {
  const [query, setQuery] = useState(selectedPlace?.name ?? "");
  const [searchMode, setSearchMode] = useState<SearchMode>("map");
  const [savedPlaces, setSavedPlaces] = useState<PersonalPlaceRecord[]>([]);
  const [results, setResults] = useState<PlaceRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    fetchPersonalPlacesFromDb()
      .then((records) => {
        if (!isMounted) return;
        setSavedPlaces(records ?? []);
      })
      .catch((error) => {
        console.error("Failed to load personal places", error);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSaved(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredSavedPlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return savedPlaces.slice(0, 12);
    return savedPlaces
      .filter((place) => [place.label, place.address, place.mappedName ?? "", place.memo ?? ""].join(" ").toLowerCase().includes(normalizedQuery))
      .slice(0, 12);
  }, [query, savedPlaces]);

  const searchPlaces = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setIsSearching(true);
    setSearchMode("map");
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

  const choosePersonalPlace = (place: PersonalPlaceRecord) => {
    onSelect(convertPersonalPlaceToPlanPlace(place));
    setQuery(place.label);
    setMessage("");
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
    setSearchMode("map");
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

      <div className="planner-place-mode">
        <button className={searchMode === "map" ? "planner-place-mode__button planner-place-mode__button--active" : "planner-place-mode__button"} onClick={() => setSearchMode("map")} type="button">
          <MapPin aria-hidden size={14} />
          장소 선택
        </button>
        <button className={searchMode === "saved" ? "planner-place-mode__button planner-place-mode__button--active" : "planner-place-mode__button"} onClick={() => setSearchMode("saved")} type="button">
          <Star aria-hidden size={14} />
          내 장소
          <b>{savedPlaces.length}</b>
        </button>
      </div>

      <div className="planner-place-search">
        <MapPin aria-hidden size={18} />
        <input
          placeholder={searchMode === "saved" ? "내 장소 이름이나 주소 찾기" : "장소명이나 주소 검색"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (searchMode === "map") void searchPlaces();
            }
          }}
        />
        {searchMode === "map" ? (
          <button disabled={isSearching || query.trim().length === 0} onClick={() => void searchPlaces()} type="button">
            <Search aria-hidden size={16} />
            {isSearching ? "검색 중" : "검색"}
          </button>
        ) : null}
      </div>

      {selectedPlace ? <PlaceLine place={selectedPlace} /> : null}
      {message ? <p className="planner-place-message">{message}</p> : null}

      {searchMode === "saved" ? (
        <div className="planner-place-results">
          {filteredSavedPlaces.length > 0 ? (
            filteredSavedPlaces.map((place) => (
              <button key={place.id} onClick={() => choosePersonalPlace(place)} type="button">
                <strong>{place.label}</strong>
                <span>{place.address}</span>
              </button>
            ))
          ) : (
            <p className="planner-place-message">
              {isLoadingSaved ? "내 장소 불러오는 중..." : "저장된 내 장소가 없어요. DB의 장소 탭에서 먼저 만들어둘 수 있어요."}
            </p>
          )}
        </div>
      ) : results.length > 0 ? (
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

function convertPersonalPlaceToPlanPlace(place: PersonalPlaceRecord): PlanPlace {
  return {
    name: place.label,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    providerPlaceId: place.providerPlaceId,
    phone: place.phone,
    category: place.category,
    url: place.url,
  };
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
