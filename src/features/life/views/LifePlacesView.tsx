"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, Check, MapPin, Plus, Search, ToggleLeft, ToggleRight, Trash2, X } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { IconButton } from "@/components/ui/IconButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { formatWon } from "@/features/life/formatters";
import {
  createPersonalPlaceInDb,
  deletePersonalPlaceFromDb,
  fetchPersonalPlacesFromDb,
  updatePersonalPlaceInDb,
} from "@/features/personalPlaces/api";
import type {
  DailyLogRecord,
  LifeActivityRecord,
  LifePhotoRecord,
  PersonalPlaceRecord,
  PlaceRecord,
} from "@/types/domain";

type LifePlacesViewProps = {
  activities: LifeActivityRecord[];
  dailyLogs: DailyLogRecord[];
  photos: LifePhotoRecord[];
};

type SearchMode = "place" | "records";
type SearchResponse = {
  error?: string;
  places: PlaceRecord[];
};

type NaverLatLng = unknown;
type NaverLatLngBounds = {
  extend: (latLng: NaverLatLng) => void;
  getCenter?: () => NaverLatLng;
};
type NaverMap = {
  fitBounds: (bounds: NaverLatLngBounds, padding?: number | Record<string, number>) => void;
  setCenter: (latLng: NaverLatLng) => void;
  setZoom: (zoom: number) => void;
};
type NaverMarker = {
  setMap: (map: NaverMap | null) => void;
};

type PlaceVisitRecord = {
  date: string;
  endTime?: string;
  expenseAmount?: number;
  id: string;
  logCount: number;
  memo?: string;
  people: string[];
  photoCount: number;
  startTime?: string;
  title: string;
};

type VisitedPlaceSummary = {
  address?: string;
  categories: string[];
  key: string;
  latitude: number;
  longitude: number;
  name: string;
  people: string[];
  records: PlaceVisitRecord[];
  totalExpense: number;
  visitCount: number;
  visitDates: string[];
};

type ResolvedVisitedPlace = {
  address?: string;
  key: string;
  latitude: number;
  longitude: number;
  name: string;
};

const naverMapClientId =
  process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID;
const defaultCenter = { latitude: 37.5666103, longitude: 126.9783882 };
const placeGeocodeCache = new Map<string, { latitude: number; longitude: number } | null>();

export function LifePlacesView({ activities, dailyLogs, photos }: LifePlacesViewProps) {
  const datedActivities = useMemo(
    () => activities.filter((activity) => Boolean(activity.placeName?.trim())),
    [activities],
  );
  const sortedDates = useMemo(
    () => datedActivities.map((activity) => activity.date).sort((left, right) => left.localeCompare(right)),
    [datedActivities],
  );
  const defaultStartDate = sortedDates[0] ?? "";
  const defaultEndDate = sortedDates.at(-1) ?? "";

  const [searchMode, setSearchMode] = useState<SearchMode>("place");
  const [query, setQuery] = useState("");
  const [isPeriodFilterEnabled, setIsPeriodFilterEnabled] = useState(true);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [showVisitedMarkers, setShowVisitedMarkers] = useState(true);
  const [selectedPlaceKey, setSelectedPlaceKey] = useState("");
  const [searchResults, setSearchResults] = useState<PlaceRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");

  const [personalPlaces, setPersonalPlaces] = useState<PersonalPlaceRecord[]>([]);
  const [isMyPlacesExpanded, setIsMyPlacesExpanded] = useState(true);
  const [selectedPersonalPlaceId, setSelectedPersonalPlaceId] = useState("");
  const [placeLabel, setPlaceLabel] = useState("");
  const [placeMemo, setPlaceMemo] = useState("");
  const [mappingQuery, setMappingQuery] = useState("");
  const [mappingResults, setMappingResults] = useState<PlaceRecord[]>([]);
  const [mappedPlace, setMappedPlace] = useState<PlaceRecord | null>(null);
  const [isMappingSearchLoading, setIsMappingSearchLoading] = useState(false);
  const [personalPlaceMessage, setPersonalPlaceMessage] = useState("");
  const [isSavingPersonalPlace, setIsSavingPersonalPlace] = useState(false);
  const [isDeletingPersonalPlace, setIsDeletingPersonalPlace] = useState(false);

  const [mapStatus, setMapStatus] = useState<"idle" | "ready" | "missing-key" | "error">("idle");
  const [resolvedPlaces, setResolvedPlaces] = useState<Record<string, ResolvedVisitedPlace>>({});

  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const markersRef = useRef<NaverMarker[]>([]);

  useEffect(() => {
    if (!startDate && defaultStartDate) setStartDate(defaultStartDate);
    if (!endDate && defaultEndDate) setEndDate(defaultEndDate);
  }, [defaultEndDate, defaultStartDate, endDate, startDate]);

  useEffect(() => {
    let isMounted = true;

    fetchPersonalPlacesFromDb()
      .then((records) => {
        if (!isMounted) return;
        setPersonalPlaces(records ?? []);
      })
      .catch((error) => console.error("Failed to load personal places", error));

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
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(
      naverMapClientId,
    )}`;
    script.onload = () => setMapStatus("ready");
    script.onerror = () => setMapStatus("error");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (searchMode !== "place") {
      setSearchResults([]);
      setSearchMessage("");
    }
  }, [searchMode]);

  const selectedPersonalPlace = personalPlaces.find((place) => place.id === selectedPersonalPlaceId) ?? null;

  useEffect(() => {
    if (!selectedPersonalPlace) return;
    setPlaceLabel(selectedPersonalPlace.label);
    setPlaceMemo(selectedPersonalPlace.memo ?? "");
    setMappedPlace({
      id: selectedPersonalPlace.id,
      address: selectedPersonalPlace.address,
      latitude: selectedPersonalPlace.latitude,
      longitude: selectedPersonalPlace.longitude,
      name: selectedPersonalPlace.mappedName ?? selectedPersonalPlace.address,
      provider: "manual",
      providerPlaceId: selectedPersonalPlace.providerPlaceId,
      phone: selectedPersonalPlace.phone,
      category: selectedPersonalPlace.category,
      url: selectedPersonalPlace.url,
    });
    setMappingQuery(selectedPersonalPlace.address);
    setMappingResults([]);
    setPersonalPlaceMessage("");
  }, [selectedPersonalPlace]);

  const allPersonalPlaces = useMemo(
    () =>
      [...personalPlaces].sort(
        (left, right) => left.label.localeCompare(right.label) || left.address.localeCompare(right.address),
      ),
    [personalPlaces],
  );

  const periodActivities = useMemo(
    () =>
      datedActivities.filter((activity) => {
        if (!isPeriodFilterEnabled) return true;
        if (startDate && activity.date < startDate) return false;
        if (endDate && activity.date > endDate) return false;
        return true;
      }),
    [datedActivities, endDate, isPeriodFilterEnabled, startDate],
  );

  const periodLogsByDate = useMemo(() => {
    const next = new Map<string, number>();
    dailyLogs.forEach((log) => {
      if (isPeriodFilterEnabled) {
        if (startDate && log.date < startDate) return;
        if (endDate && log.date > endDate) return;
      }
      next.set(log.date, (next.get(log.date) ?? 0) + 1);
    });
    return next;
  }, [dailyLogs, endDate, isPeriodFilterEnabled, startDate]);

  const periodPhotosByDate = useMemo(() => {
    const next = new Map<string, number>();
    photos.forEach((photo) => {
      if (isPeriodFilterEnabled) {
        if (startDate && photo.date < startDate) return;
        if (endDate && photo.date > endDate) return;
      }
      next.set(photo.date, (next.get(photo.date) ?? 0) + 1);
    });
    return next;
  }, [endDate, isPeriodFilterEnabled, photos, startDate]);

  const unresolvedPlaceBases = useMemo(() => {
    const places = new Map<string, { address?: string; key: string; name: string }>();

    periodActivities.forEach((activity) => {
      const key = getVisitedPlaceKey(activity.placeName ?? "", activity.placeAddress);
      if (places.has(key)) return;
      places.set(key, {
        address: activity.placeAddress?.trim() || undefined,
        key,
        name: activity.placeName?.trim() || "",
      });
    });

    return [...places.values()];
  }, [periodActivities]);

  useEffect(() => {
    let isMounted = true;
    const pendingPlaces = unresolvedPlaceBases.filter((place) => !resolvedPlaces[place.key]);
    if (pendingPlaces.length === 0) return;

    void (async () => {
      const resolvedEntries = await Promise.all(
        pendingPlaces.map(async (place) => {
          const coordinates = await resolvePlaceCoordinates(place.name, place.address);
          if (!coordinates) return null;
          return [
            place.key,
            { ...place, latitude: coordinates.latitude, longitude: coordinates.longitude },
          ] as const;
        }),
      );

      if (!isMounted) return;
      setResolvedPlaces((current) => {
        const next = { ...current };
        resolvedEntries.forEach((entry) => {
          if (!entry) return;
          next[entry[0]] = entry[1];
        });
        return next;
      });
    })();

    return () => {
      isMounted = false;
    };
  }, [resolvedPlaces, unresolvedPlaceBases]);

  const visitedPlaces = useMemo<VisitedPlaceSummary[]>(() => {
    const grouped = new Map<string, VisitedPlaceSummary>();

    periodActivities.forEach((activity) => {
      const key = getVisitedPlaceKey(activity.placeName ?? "", activity.placeAddress);
      const resolved = resolvedPlaces[key];
      if (!resolved) return;

      const people = parseCompanions(activity.companions);
      const record: PlaceVisitRecord = {
        date: activity.date,
        endTime: activity.endTime,
        expenseAmount: activity.expenseAmount,
        id: activity.id,
        logCount: periodLogsByDate.get(activity.date) ?? 0,
        memo: activity.memo,
        people,
        photoCount: periodPhotosByDate.get(activity.date) ?? 0,
        startTime: activity.startTime,
        title: activity.title,
      };

      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          address: resolved.address,
          categories: activity.category ? [activity.category] : [],
          key,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
          name: resolved.name,
          people,
          records: [record],
          totalExpense: activity.expenseAmount ?? 0,
          visitCount: 1,
          visitDates: [activity.date],
        });
        return;
      }

      existing.records.push(record);
      existing.visitCount += 1;
      existing.totalExpense += activity.expenseAmount ?? 0;
      existing.visitDates.push(activity.date);
      people.forEach((person) => {
        if (!existing.people.includes(person)) existing.people.push(person);
      });
      if (activity.category && !existing.categories.includes(activity.category)) {
        existing.categories.push(activity.category);
      }
    });

    return [...grouped.values()]
      .map((place) => ({
        ...place,
        records: place.records.sort((left, right) => {
          if (left.date !== right.date) return right.date.localeCompare(left.date);
          return (right.startTime ?? "").localeCompare(left.startTime ?? "");
        }),
        visitDates: [...new Set(place.visitDates)].sort((left, right) => left.localeCompare(right)),
      }))
      .sort(
        (left, right) =>
          right.visitCount - left.visitCount ||
          (right.visitDates.at(-1) ?? "").localeCompare(left.visitDates.at(-1) ?? ""),
      );
  }, [periodActivities, periodLogsByDate, periodPhotosByDate, resolvedPlaces]);

  const recordQuery = searchMode === "records" ? query.trim().toLowerCase() : "";
  const filteredVisitedPlaces = useMemo(() => {
    if (!recordQuery) return visitedPlaces;

    return visitedPlaces.filter((place) =>
      [place.name, place.address ?? "", place.people.join(" "), place.categories.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(recordQuery),
    );
  }, [recordQuery, visitedPlaces]);

  useEffect(() => {
    if (selectedPlaceKey && filteredVisitedPlaces.some((place) => place.key === selectedPlaceKey)) return;
    setSelectedPlaceKey(filteredVisitedPlaces[0]?.key ?? "");
  }, [filteredVisitedPlaces, selectedPlaceKey]);

  const selectedVisitedPlace =
    filteredVisitedPlaces.find((place) => place.key === selectedPlaceKey) ?? null;

  const personalPlaceDirty = Boolean(
    mappedPlace &&
      (selectedPersonalPlace
        ? placeLabel.trim() !== selectedPersonalPlace.label.trim() ||
          (placeMemo.trim() || "") !== (selectedPersonalPlace.memo?.trim() || "") ||
          mappedPlace.address !== selectedPersonalPlace.address ||
          mappedPlace.latitude !== selectedPersonalPlace.latitude ||
          mappedPlace.longitude !== selectedPersonalPlace.longitude ||
          (mappedPlace.name || "") !== (selectedPersonalPlace.mappedName || selectedPersonalPlace.address)
        : Boolean(placeLabel.trim()) || Boolean(placeMemo.trim()) || Boolean(mappingQuery.trim())),
  );

  const runPlaceSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchMessage("");
      return;
    }

    if (searchMode === "records") return;

    setIsSearching(true);
    setSearchMessage("");
    try {
      const response = await fetch(`/api/maps/search-place?query=${encodeURIComponent(trimmedQuery)}`);
      const payload = (await response.json()) as SearchResponse;

      if (!response.ok) {
        setSearchResults([]);
        setSearchMessage(payload.error ?? "장소 검색에 실패했습니다.");
        return;
      }

      setSearchResults(payload.places);
      if (payload.places.length === 0) {
        setSearchMessage("검색 결과가 없어요.");
      }
    } catch (error) {
      console.error("Failed to search places", error);
      setSearchResults([]);
      setSearchMessage("장소 검색 중 문제가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const runMappingSearch = async () => {
    const trimmedQuery = mappingQuery.trim();
    if (!trimmedQuery) {
      setMappingResults([]);
      return;
    }

    setIsMappingSearchLoading(true);
    setPersonalPlaceMessage("");
    try {
      const response = await fetch(`/api/maps/search-place?query=${encodeURIComponent(trimmedQuery)}`);
      const payload = (await response.json()) as SearchResponse;

      if (!response.ok) {
        setMappingResults([]);
        setPersonalPlaceMessage(payload.error ?? "위치 검색에 실패했습니다.");
        return;
      }

      setMappingResults(payload.places);
      if (payload.places.length === 0) setPersonalPlaceMessage("매핑할 위치를 찾지 못했어요.");
    } catch (error) {
      console.error("Failed to search mapping places", error);
      setMappingResults([]);
      setPersonalPlaceMessage("위치 검색 중 문제가 발생했습니다.");
    } finally {
      setIsMappingSearchLoading(false);
    }
  };

  const fitVisibleMarkers = useCallback(
    (placesToRender: Array<{ latitude: number; longitude: number }>) => {
      if (!mapRef.current || !window.naver?.maps) return;

      if (placesToRender.length === 0) {
        mapRef.current.setCenter(new window.naver.maps.LatLng(defaultCenter.latitude, defaultCenter.longitude));
        mapRef.current.setZoom(11);
        return;
      }

      if (placesToRender.length === 1) {
        mapRef.current.setCenter(
          new window.naver.maps.LatLng(placesToRender[0].latitude, placesToRender[0].longitude),
        );
        mapRef.current.setZoom(15);
        return;
      }

      const bounds = new window.naver.maps.LatLngBounds();
      placesToRender.forEach((place) =>
        bounds.extend(new window.naver!.maps.LatLng(place.latitude, place.longitude)),
      );
      (window.naver.maps.Event as { trigger?: (target: unknown, eventName: string) => void }).trigger?.(
        mapRef.current,
        "resize",
      );
      mapRef.current.fitBounds(bounds, { bottom: 40, left: 40, right: 40, top: 40 });
      const center = (bounds as NaverLatLngBounds & { getCenter?: () => NaverLatLng }).getCenter?.();
      if (center) mapRef.current.setCenter(center);
    },
    [],
  );

  const visibleVisitedMarkers = useMemo(
    () => (searchMode === "records" && showVisitedMarkers ? filteredVisitedPlaces : []),
    [filteredVisitedPlaces, searchMode, showVisitedMarkers],
  );

  const renderMarkers = useCallback(() => {
    if (!mapRef.current || !window.naver?.maps) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    const nextMarkers: NaverMarker[] = [];

    visibleVisitedMarkers.forEach((place) => {
      const marker = new window.naver!.maps.Marker({
        icon: {
          anchor: new window.naver!.maps.Point(44, 9),
          content: getLifePlaceMarkerContent(place.name, place.visitCount, "var(--violet)"),
        },
        map: mapRef.current,
        position: new window.naver!.maps.LatLng(place.latitude, place.longitude),
        title: place.name,
      });
      window.naver!.maps.Event.addListener(marker, "click", () => setSelectedPlaceKey(place.key));
      nextMarkers.push(marker);
    });

    allPersonalPlaces.forEach((place) => {
      const marker = new window.naver!.maps.Marker({
        icon: {
          anchor: new window.naver!.maps.Point(44, 9),
          content: getLifePlaceMarkerContent(place.label, undefined, "#4f8cff"),
        },
        map: mapRef.current,
        position: new window.naver!.maps.LatLng(place.latitude, place.longitude),
        title: place.label,
      });
      window.naver!.maps.Event.addListener(marker, "click", () => setSelectedPersonalPlaceId(place.id));
      nextMarkers.push(marker);
    });

    searchResults.forEach((place) => {
      const marker = new window.naver!.maps.Marker({
        icon: {
          anchor: new window.naver!.maps.Point(44, 9),
          content: getLifePlaceMarkerContent(place.name, undefined, "#22c55e"),
        },
        map: mapRef.current,
        position: new window.naver!.maps.LatLng(place.latitude, place.longitude),
        title: place.name,
      });
      nextMarkers.push(marker);
    });

    markersRef.current = nextMarkers;
    fitVisibleMarkers([
      ...visibleVisitedMarkers,
      ...allPersonalPlaces.map((place) => ({ latitude: place.latitude, longitude: place.longitude })),
      ...searchResults,
    ]);
  }, [allPersonalPlaces, fitVisibleMarkers, searchResults, visibleVisitedMarkers]);

  useEffect(() => {
    if (mapStatus !== "ready" || !mapElementRef.current || !window.naver?.maps) return;

    if (!mapRef.current) {
      mapRef.current = new window.naver.maps.Map(mapElementRef.current, {
        center: new window.naver.maps.LatLng(defaultCenter.latitude, defaultCenter.longitude),
        zoom: 11,
      });
    }

    renderMarkers();
  }, [mapStatus, renderMarkers]);

  const startCreatingPersonalPlace = () => {
    setSelectedPersonalPlaceId("");
    setPlaceLabel("");
    setPlaceMemo("");
    setMappingQuery("");
    setMappingResults([]);
    setMappedPlace(null);
    setPersonalPlaceMessage("");
    setIsMyPlacesExpanded(true);
  };

  const chooseMappingPlace = (place: PlaceRecord) => {
    setMappedPlace(place);
    setMappingQuery(place.address || place.name);
    setMappingResults([]);
    setPersonalPlaceMessage("");
  };

  const savePersonalPlace = async () => {
    if (!placeLabel.trim() || !mappedPlace || isSavingPersonalPlace) return;
    if (selectedPersonalPlace && !personalPlaceDirty) return;

    const confirmed = window.confirm(
      selectedPersonalPlace
        ? `"${selectedPersonalPlace.label}" 장소 정보를 저장할까요?`
        : `"${placeLabel.trim()}" 내 장소를 추가할까요?`,
    );
    if (!confirmed) return;

    setIsSavingPersonalPlace(true);
    setPersonalPlaceMessage("");

    try {
      if (selectedPersonalPlace) {
        const updated = await updatePersonalPlaceInDb({
          id: selectedPersonalPlace.id,
          label: placeLabel.trim(),
          mappedName: mappedPlace.name,
          address: mappedPlace.address,
          latitude: mappedPlace.latitude,
          longitude: mappedPlace.longitude,
          providerPlaceId: mappedPlace.providerPlaceId,
          phone: mappedPlace.phone,
          category: mappedPlace.category,
          url: mappedPlace.url,
          memo: placeMemo.trim() || undefined,
        });
        if (!updated) return;
        setPersonalPlaces((current) => current.map((place) => (place.id === updated.id ? updated : place)));
        setSelectedPersonalPlaceId(updated.id);
        setPersonalPlaceMessage("내 장소를 수정했어요.");
        return;
      }

      const duplicate = personalPlaces.find((place) => place.label.trim() === placeLabel.trim());
      if (duplicate) {
        setSelectedPersonalPlaceId(duplicate.id);
        setPersonalPlaceMessage("같은 이름의 내 장소가 이미 있어요.");
        return;
      }

      const created = await createPersonalPlaceInDb({
        label: placeLabel.trim(),
        mappedName: mappedPlace.name,
        address: mappedPlace.address,
        latitude: mappedPlace.latitude,
        longitude: mappedPlace.longitude,
        providerPlaceId: mappedPlace.providerPlaceId,
        phone: mappedPlace.phone,
        category: mappedPlace.category,
        url: mappedPlace.url,
        memo: placeMemo.trim() || undefined,
      });
      if (!created) return;
      setPersonalPlaces((current) => [created, ...current]);
      setSelectedPersonalPlaceId(created.id);
      setPersonalPlaceMessage("내 장소를 추가했어요.");
    } finally {
      setIsSavingPersonalPlace(false);
    }
  };

  const deletePersonalPlace = async () => {
    if (!selectedPersonalPlace || isDeletingPersonalPlace) return;

    const confirmed = window.confirm(`"${selectedPersonalPlace.label}" 내 장소를 삭제할까요?`);
    if (!confirmed) return;

    setIsDeletingPersonalPlace(true);
    try {
      await deletePersonalPlaceFromDb(selectedPersonalPlace.id);
      setPersonalPlaces((current) => current.filter((place) => place.id !== selectedPersonalPlace.id));
      startCreatingPersonalPlace();
      setPersonalPlaceMessage("내 장소를 삭제했어요.");
    } finally {
      setIsDeletingPersonalPlace(false);
    }
  };

  const totalPlaceVisits = filteredVisitedPlaces.reduce((sum, place) => sum + place.visitCount, 0);

  return (
    <div className="life-tab-panel">
      <LifeTabHeading
        title="장소"
        description="기본 검색과 기록 검색을 분리하고, 내 장소와 방문 기록을 더 안정적인 구조로 관리합니다."
      />

      <SectionCard className="life-places-toolbar">
        <div className="life-places-mode-switch">
          <button
            className={searchMode === "place" ? "life-places-mode-switch__button life-places-mode-switch__button--active" : "life-places-mode-switch__button"}
            onClick={() => setSearchMode("place")}
            type="button"
          >
            기본 검색
          </button>
          <button
            className={searchMode === "records" ? "life-places-mode-switch__button life-places-mode-switch__button--active" : "life-places-mode-switch__button"}
            onClick={() => setSearchMode("records")}
            type="button"
          >
            기록 검색
          </button>
        </div>

        <label className="life-places-search">
          <Search aria-hidden size={17} />
          <input
            placeholder={searchMode === "place" ? "장소 이름이나 주소 검색" : "기록된 장소, 주소, 함께한 사람 검색"}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (searchMode === "place" && event.key === "Enter") void runPlaceSearch();
            }}
          />
          {searchMode === "place" ? (
            <button disabled={isSearching || query.trim().length === 0} onClick={() => void runPlaceSearch()} type="button">
              {isSearching ? "검색 중..." : "검색"}
            </button>
          ) : null}
        </label>

        {searchMode === "records" ? (
          <div className="life-places-record-controls">
            <button
              className="life-places-period-toggle"
              onClick={() => setIsPeriodFilterEnabled((current) => !current)}
              type="button"
            >
              <CalendarRange aria-hidden size={16} />
              <span>기간 {isPeriodFilterEnabled ? "ON" : "OFF"}</span>
            </button>

            {isPeriodFilterEnabled ? (
              <div className="life-places-period">
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                <i>~</i>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </div>
            ) : (
              <div className="life-places-period life-places-period--disabled">
                <span>모든 기록</span>
              </div>
            )}

            <button
              className="life-places-toggle"
              onClick={() => setShowVisitedMarkers((current) => !current)}
              type="button"
            >
              {showVisitedMarkers ? <ToggleRight aria-hidden size={18} /> : <ToggleLeft aria-hidden size={18} />}
              <span>방문 마커 {showVisitedMarkers ? "ON" : "OFF"}</span>
            </button>
          </div>
        ) : null}
      </SectionCard>

      {searchMessage ? <p className="life-places-message">{searchMessage}</p> : null}
      {personalPlaceMessage ? <p className="life-places-message">{personalPlaceMessage}</p> : null}

      <div className="life-places-layout">
        <SectionCard className="life-places-map-panel life-places-map-panel--bleed">
          <div className="life-places-map-shell">
            <div className={`life-places-map ${mapStatus !== "ready" ? "life-places-map--hidden" : ""}`} ref={mapElementRef} />
            {mapStatus !== "ready" ? (
              <div className="life-places-map-empty">
                <MapPin aria-hidden size={24} />
                <strong>{mapStatus === "missing-key" ? "네이버 지도 키가 필요합니다." : "지도를 준비하는 중입니다."}</strong>
              </div>
            ) : visibleVisitedMarkers.length === 0 && allPersonalPlaces.length === 0 && searchResults.length === 0 ? (
              <div className="life-places-map-empty">
                <MapPin aria-hidden size={24} />
                <strong>표시할 장소가 아직 없어요.</strong>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <div className="life-places-side">
          <SectionCard className={`life-places-manager${isMyPlacesExpanded ? "" : " life-places-manager--collapsed"}`}>
            <div className="life-places-panel-head">
              <div>
                <span>My Places</span>
                <strong>
                  내 장소 <em className="life-places-count-accent">{allPersonalPlaces.length}곳</em>
                </strong>
              </div>
              <div className="life-places-panel-head__actions">
                {isMyPlacesExpanded ? (
                  <IconButton label="내 장소 접기" onClick={() => setIsMyPlacesExpanded(false)} size="sm" tone="ghost">
                    <X aria-hidden size={17} />
                  </IconButton>
                ) : (
                  <IconButton label="내 장소 추가" onClick={startCreatingPersonalPlace} size="sm" tone="ghost">
                    <Plus aria-hidden size={17} />
                  </IconButton>
                )}
              </div>
            </div>

            {isMyPlacesExpanded ? (
              <>
              <div className="life-places-manager__body">
                <div className="life-places-manager__directory">
                  <div className="life-places-manager__list">
                    {allPersonalPlaces.length > 0 ? (
                      allPersonalPlaces.map((place) => (
                        <button
                          className={
                            selectedPersonalPlaceId === place.id
                              ? "life-places-manager__place life-places-manager__place--active"
                              : "life-places-manager__place"
                          }
                          key={place.id}
                          onClick={() => {
                            setSelectedPersonalPlaceId(place.id);
                            setIsMyPlacesExpanded(true);
                          }}
                          type="button"
                        >
                          <strong>{place.label}</strong>
                          <span>{place.address}</span>
                          <em>{place.mappedName ?? "매핑 이름 없음"}</em>
                        </button>
                      ))
                    ) : (
                      <div className="life-places-empty-inline">
                        <strong>아직 등록한 내 장소가 없어요.</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="life-places-manager__form">
                  <div className="life-places-manager__form-head">
                    <div>
                      <strong>{selectedPersonalPlace ? "내 장소 수정" : "내 장소 추가"}</strong>
                      {mappedPlace ? <span>{mappedPlace.name}</span> : null}
                    </div>
                    {selectedPersonalPlace ? (
                      <div className="life-places-manager__form-tools">
                        <IconButton
                          disabled={!personalPlaceDirty || isSavingPersonalPlace || !placeLabel.trim() || !mappedPlace}
                          label="내 장소 저장"
                          onClick={() => void savePersonalPlace()}
                          tone="soft"
                        >
                          <Check aria-hidden size={16} />
                        </IconButton>
                        <IconButton
                          disabled={isDeletingPersonalPlace}
                          label="내 장소 삭제"
                          onClick={() => void deletePersonalPlace()}
                          tone="danger"
                        >
                          <Trash2 aria-hidden size={16} />
                        </IconButton>
                      </div>
                    ) : null}
                  </div>

                  <div className="life-places-manager__form-grid life-places-manager__form-grid--stacked">
                    <label>
                      <span>내 장소 이름</span>
                      <input
                        placeholder="예: 내 집, 부산 집, 회사"
                        value={placeLabel}
                        onChange={(event) => setPlaceLabel(event.target.value)}
                      />
                    </label>

                    <label>
                      <span>위치 매핑 검색</span>
                      <div className="schedule-place-search">
                        <MapPin aria-hidden size={18} />
                        <input
                          placeholder="예: 부산광역시 ... 아파트"
                          value={mappingQuery}
                          onChange={(event) => setMappingQuery(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void runMappingSearch();
                            }
                          }}
                        />
                        <button
                          disabled={isMappingSearchLoading || mappingQuery.trim().length === 0}
                          onClick={() => void runMappingSearch()}
                          type="button"
                        >
                          {isMappingSearchLoading ? "검색 중..." : "검색"}
                        </button>
                      </div>
                    </label>
                  </div>

                  {mappedPlace ? (
                    <div className="life-places-manager__mapped">
                      <strong>{mappedPlace.name}</strong>
                      <span>{mappedPlace.address}</span>
                    </div>
                  ) : null}

                  {mappingResults.length > 0 ? (
                    <div className="schedule-place-results">
                      {mappingResults.map((place) => (
                        <button
                          key={`${place.providerPlaceId ?? place.id}-${place.name}`}
                          onClick={() => chooseMappingPlace(place)}
                          type="button"
                        >
                          <strong>{place.name}</strong>
                          <span>{place.address || place.category || "주소 정보 없음"}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <label>
                    <span>메모</span>
                    <textarea
                      placeholder="이 장소를 어떤 맥락으로 쓰는지 적어둘 수 있어요."
                      rows={3}
                      value={placeMemo}
                      onChange={(event) => setPlaceMemo(event.target.value)}
                    />
                  </label>

                  <div className="life-places-manager__buttons">
                    {!selectedPersonalPlace ? (
                      <ActionButton disabled={isSavingPersonalPlace || !placeLabel.trim() || !mappedPlace} onClick={() => void savePersonalPlace()}>
                        <Plus aria-hidden size={15} />
                        내 장소 저장
                      </ActionButton>
                    ) : (
                      <ActionButton onClick={startCreatingPersonalPlace} variant="secondary">
                        <X aria-hidden size={15} />
                        새로 입력
                      </ActionButton>
                    )}
                  </div>
                </div>
              </div>
              </>
            ) : null}
          </SectionCard>

          <div className="life-places-side__bottom">
            <SectionCard className="life-places-summary">
              <div className="life-places-panel-head">
                <div>
                  <span>Visited Places</span>
                  <strong>
                    방문 장소 <em className="life-places-count-accent">{filteredVisitedPlaces.length}곳</em>
                  </strong>
                </div>
                <div className="life-places-panel-head__meta">
                  <b>{totalPlaceVisits}건</b>
                </div>
              </div>

              <div className="life-places-place-list">
                {filteredVisitedPlaces.length > 0 ? (
                  filteredVisitedPlaces.map((place) => (
                    <button
                      className={
                        selectedVisitedPlace?.key === place.key
                          ? "life-places-place-button life-places-place-button--active"
                          : "life-places-place-button"
                      }
                      key={place.key}
                      onClick={() => setSelectedPlaceKey(place.key)}
                      type="button"
                    >
                      <strong>{place.name}</strong>
                      <span>{place.address || "주소 없음"}</span>
                      <em>{place.visitCount}건 · {place.visitDates.length}일</em>
                    </button>
                  ))
                ) : (
                  <div className="life-places-empty-inline">
                    <strong>해당 조건의 방문 장소가 없어요.</strong>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard className="life-places-detail">
              <div className="life-places-panel-head">
                <div>
                  <span>Place Records</span>
                  <strong>{selectedVisitedPlace?.name ?? "기록 장소를 선택해 주세요"}</strong>
                </div>
                {selectedVisitedPlace ? (
                  <div className="life-places-panel-head__meta">
                    <b>{selectedVisitedPlace.visitCount}건</b>
                    <b>{selectedVisitedPlace.visitDates.length}일</b>
                  </div>
                ) : null}
              </div>

              {selectedVisitedPlace ? (
                <>
                  <div className="life-places-detail-metrics">
                    <article>
                      <span>방문</span>
                      <strong>{selectedVisitedPlace.visitCount}건</strong>
                    </article>
                    <article>
                      <span>방문일</span>
                      <strong>{selectedVisitedPlace.visitDates.length}일</strong>
                    </article>
                    <article>
                      <span>지출</span>
                      <strong>
                        {selectedVisitedPlace.totalExpense > 0
                          ? formatWon(selectedVisitedPlace.totalExpense)
                          : "-"}
                      </strong>
                    </article>
                  </div>

                  <div className="life-places-detail-meta">
                    {selectedVisitedPlace.address ? <p>{selectedVisitedPlace.address}</p> : null}
                    {selectedVisitedPlace.people.length > 0 ? (
                      <p>함께한 사람 · {selectedVisitedPlace.people.join(", ")}</p>
                    ) : null}
                    {selectedVisitedPlace.categories.length > 0 ? (
                      <p>주요 활동 · {selectedVisitedPlace.categories.join(" · ")}</p>
                    ) : null}
                  </div>

                  <div className="life-places-record-list">
                    {selectedVisitedPlace.records.map((record) => (
                      <article key={record.id}>
                        <div className="life-places-record-head">
                          <span>{record.date}</span>
                          <Link href={`/life/calendar?date=${record.date}`}>그날 보기</Link>
                        </div>
                        <strong>
                          {formatActivityTime(record.startTime, record.endTime)} {record.title}
                        </strong>
                        <div className="life-places-record-meta">
                          {record.people.length > 0 ? <p>with {record.people.join(", ")}</p> : null}
                          {typeof record.expenseAmount === "number" ? <p>{formatWon(record.expenseAmount)}</p> : null}
                          {record.logCount > 0 || record.photoCount > 0 ? (
                            <p>
                              하루기록 {record.logCount} · 사진 {record.photoCount}
                            </p>
                          ) : null}
                        </div>
                        {record.memo ? <p className="life-places-record-note">{record.memo}</p> : null}
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="life-places-empty-inline">
                  <strong>장소를 선택하면 기록이 열립니다.</strong>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function getVisitedPlaceKey(name: string, address?: string) {
  return `${name.trim()}|${address?.trim() ?? ""}`.toLowerCase();
}

function parseCompanions(value?: string) {
  return (value ?? "")
    .split(/[,\n/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatActivityTime(startTime?: string, endTime?: string) {
  if (startTime && endTime) return `${startTime} ~ ${endTime}`;
  if (startTime) return startTime;
  if (endTime) return `~ ${endTime}`;
  return "시간 미기록";
}

async function resolvePlaceCoordinates(name: string, address?: string) {
  const candidates = [address?.trim(), name.trim(), [name.trim(), address?.trim()].filter(Boolean).join(" ").trim()].filter(
    (value, index, values): value is string => Boolean(value) && values.indexOf(value) === index,
  );

  for (const candidate of candidates) {
    const cached = placeGeocodeCache.get(candidate);
    if (cached !== undefined) {
      if (cached) return cached;
      continue;
    }

    try {
      const endpoint = candidate === address?.trim() ? "/api/maps/geocode" : "/api/maps/search-place";
      const response = await fetch(`${endpoint}?query=${encodeURIComponent(candidate)}`);
      const payload = (await response.json()) as { places?: Array<{ latitude: number; longitude: number }> };
      const firstPlace = payload.places?.[0];
      if (!firstPlace) {
        placeGeocodeCache.set(candidate, null);
        continue;
      }
      const resolved = { latitude: firstPlace.latitude, longitude: firstPlace.longitude };
      placeGeocodeCache.set(candidate, resolved);
      return resolved;
    } catch (error) {
      console.error("Failed to resolve place coordinates", error);
      placeGeocodeCache.set(candidate, null);
    }
  }

  return null;
}

function getLifePlaceMarkerContent(name: string, count: number | undefined, color: string) {
  const safeName = escapeHtml(name);
  return `
    <div class="life-place-marker">
      <span style="background:${color}"></span>
      <strong>${safeName}</strong>
      ${count ? `<b>${count}건</b>` : ""}
    </div>
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
