"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, MapPin, Plus, Save, Search, Star, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { LifeTabHeading } from "@/features/life/components/LifeTabHeading";
import { formatWon } from "@/features/life/formatters";
import { createPlaceInDb, deletePlaceFromDb, fetchPlacesFromDb, updatePlaceInDb } from "@/features/places/api";
import type { DailyLogRecord, LifeActivityRecord, LifePhotoRecord, PlaceRecord } from "@/types/domain";

type LifePlacesViewProps = {
  activities: LifeActivityRecord[];
  dailyLogs: DailyLogRecord[];
  photos: LifePhotoRecord[];
};

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

const naverMapClientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID ?? process.env.NEXT_PUBLIC_NAVER_MAPS_CLIENT_ID;
const defaultCenter = { latitude: 37.5666103, longitude: 126.9783882 };
const placeGeocodeCache = new Map<string, { latitude: number; longitude: number } | null>();

export function LifePlacesView({ activities, dailyLogs, photos }: LifePlacesViewProps) {
  const datedActivities = useMemo(() => activities.filter((activity) => Boolean(activity.placeName?.trim())), [activities]);
  const sortedDates = useMemo(() => datedActivities.map((activity) => activity.date).sort((left, right) => left.localeCompare(right)), [datedActivities]);
  const defaultStartDate = sortedDates[0] ?? "";
  const defaultEndDate = sortedDates.at(-1) ?? "";

  const [query, setQuery] = useState("");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [showVisitedMarkers, setShowVisitedMarkers] = useState(true);
  const [selectedPlaceKey, setSelectedPlaceKey] = useState("");
  const [selectedManagedPlaceId, setSelectedManagedPlaceId] = useState("");
  const [managedName, setManagedName] = useState("");
  const [managedAddress, setManagedAddress] = useState("");
  const [managedMemo, setManagedMemo] = useState("");
  const [managedPlaces, setManagedPlaces] = useState<PlaceRecord[]>([]);
  const [searchResults, setSearchResults] = useState<PlaceRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSavingPlace, setIsSavingPlace] = useState(false);
  const [isDeletingPlace, setIsDeletingPlace] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [managedMessage, setManagedMessage] = useState("");
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

    fetchPlacesFromDb()
      .then((records) => {
        if (!isMounted) return;
        setManagedPlaces(records ?? []);
      })
      .catch((error) => {
        console.error("Failed to load managed places", error);
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

  const selectedManagedPlace = managedPlaces.find((place) => place.id === selectedManagedPlaceId) ?? null;

  useEffect(() => {
    if (!selectedManagedPlace) return;
    setManagedName(selectedManagedPlace.name);
    setManagedAddress(selectedManagedPlace.address);
    setManagedMemo(selectedManagedPlace.memo ?? "");
  }, [selectedManagedPlace]);

  const managedPlacesFiltered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return managedPlaces;
    return managedPlaces.filter((place) => [place.name, place.address, place.memo ?? ""].join(" ").toLowerCase().includes(normalizedQuery));
  }, [managedPlaces, query]);

  const periodActivities = useMemo(
    () =>
      datedActivities.filter((activity) => {
        if (startDate && activity.date < startDate) return false;
        if (endDate && activity.date > endDate) return false;
        return true;
      }),
    [datedActivities, endDate, startDate],
  );

  const periodLogsByDate = useMemo(() => {
    const next = new Map<string, number>();
    dailyLogs.forEach((log) => {
      if (startDate && log.date < startDate) return;
      if (endDate && log.date > endDate) return;
      next.set(log.date, (next.get(log.date) ?? 0) + 1);
    });
    return next;
  }, [dailyLogs, endDate, startDate]);

  const periodPhotosByDate = useMemo(() => {
    const next = new Map<string, number>();
    photos.forEach((photo) => {
      if (startDate && photo.date < startDate) return;
      if (endDate && photo.date > endDate) return;
      next.set(photo.date, (next.get(photo.date) ?? 0) + 1);
    });
    return next;
  }, [endDate, photos, startDate]);

  const unresolvedPlaceBases = useMemo(() => {
    const places = new Map<string, { address?: string; key: string; name: string }>();
    periodActivities.forEach((activity) => {
      const key = getVisitedPlaceKey(activity.placeName ?? "", activity.placeAddress);
      if (!places.has(key)) {
        places.set(key, {
          address: activity.placeAddress?.trim() || undefined,
          key,
          name: activity.placeName?.trim() || "",
        });
      }
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
          return [place.key, { ...place, latitude: coordinates.latitude, longitude: coordinates.longitude }] as const;
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
      if (activity.category && !existing.categories.includes(activity.category)) existing.categories.push(activity.category);
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
      .sort((left, right) => right.visitCount - left.visitCount || right.visitDates.at(-1)!.localeCompare(left.visitDates.at(-1)!));
  }, [periodActivities, periodLogsByDate, periodPhotosByDate, resolvedPlaces]);

  const filteredVisitedPlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return visitedPlaces;
    return visitedPlaces.filter((place) =>
      [place.name, place.address ?? "", place.people.join(" "), place.categories.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, visitedPlaces]);

  useEffect(() => {
    if (selectedPlaceKey && filteredVisitedPlaces.some((place) => place.key === selectedPlaceKey)) return;
    setSelectedPlaceKey(filteredVisitedPlaces[0]?.key ?? "");
  }, [filteredVisitedPlaces, selectedPlaceKey]);

  const selectedVisitedPlace = filteredVisitedPlaces.find((place) => place.key === selectedPlaceKey) ?? null;

  const runExternalPlaceSearch = async () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      setSearchMessage("");
      return;
    }

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
      if (payload.places.length === 0) setSearchMessage("검색 결과가 없습니다. 다른 키워드로 다시 찾아보세요.");
    } catch (error) {
      console.error("Failed to search external places", error);
      setSearchResults([]);
      setSearchMessage("장소 검색 중 문제가 발생했습니다.");
    } finally {
      setIsSearching(false);
    }
  };

  const visibleVisitedMarkers = useMemo(() => (showVisitedMarkers ? filteredVisitedPlaces : []), [filteredVisitedPlaces, showVisitedMarkers]);

  const fitVisibleMarkers = useCallback(
    (placesToRender: Array<{ latitude: number; longitude: number }>) => {
      if (!mapRef.current || !window.naver?.maps) return;

      if (placesToRender.length === 0) {
        mapRef.current.setCenter(new window.naver.maps.LatLng(defaultCenter.latitude, defaultCenter.longitude));
        mapRef.current.setZoom(11);
        return;
      }

      if (placesToRender.length === 1) {
        mapRef.current.setCenter(new window.naver.maps.LatLng(placesToRender[0].latitude, placesToRender[0].longitude));
        mapRef.current.setZoom(15);
        return;
      }

      const bounds = new window.naver.maps.LatLngBounds();
      placesToRender.forEach((place) => bounds.extend(new window.naver!.maps.LatLng(place.latitude, place.longitude)));
      (window.naver.maps.Event as { trigger?: (target: unknown, eventName: string) => void }).trigger?.(mapRef.current, "resize");
      mapRef.current.fitBounds(bounds, { bottom: 60, left: 60, right: 60, top: 60 });
      const center = (bounds as NaverLatLngBounds & { getCenter?: () => NaverLatLng }).getCenter?.();
      if (center) mapRef.current.setCenter(center);
    },
    [],
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

    managedPlacesFiltered.forEach((place) => {
      const marker = new window.naver!.maps.Marker({
        icon: {
          anchor: new window.naver!.maps.Point(44, 9),
          content: getLifePlaceMarkerContent(place.name, undefined, "#4f8cff"),
        },
        map: mapRef.current,
        position: new window.naver!.maps.LatLng(place.latitude, place.longitude),
        title: place.name,
      });
      window.naver!.maps.Event.addListener(marker, "click", () => setSelectedManagedPlaceId(place.id));
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
    fitVisibleMarkers([...visibleVisitedMarkers, ...managedPlacesFiltered, ...searchResults]);
  }, [fitVisibleMarkers, managedPlacesFiltered, searchResults, visibleVisitedMarkers]);

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

  const beginCreateManagedPlace = () => {
    setSelectedManagedPlaceId("");
    setManagedName(query.trim());
    setManagedAddress("");
    setManagedMemo("");
    setManagedMessage("");
  };

  const saveManagedPlace = async () => {
    const trimmedName = managedName.trim();
    const trimmedAddress = managedAddress.trim();
    if (!trimmedName || !trimmedAddress || isSavingPlace) return;

    setIsSavingPlace(true);
    setManagedMessage("");
    try {
      const coordinates = await resolvePlaceCoordinates(trimmedName, trimmedAddress);
      if (!coordinates) {
        setManagedMessage("주소 좌표를 찾지 못했어요. 주소를 조금 더 정확히 적어주세요.");
        return;
      }

      const basePlace: PlaceRecord = {
        id: selectedManagedPlace?.id ?? "",
        address: trimmedAddress,
        category: selectedManagedPlace?.category,
        folderId: selectedManagedPlace?.folderId,
        folderIds: selectedManagedPlace?.folderIds ?? [],
        isFavorite: selectedManagedPlace?.isFavorite ?? false,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        memo: managedMemo.trim() || undefined,
        name: trimmedName,
        phone: selectedManagedPlace?.phone,
        provider: selectedManagedPlace?.provider ?? "manual",
        providerPlaceId: selectedManagedPlace?.providerPlaceId,
        url: selectedManagedPlace?.url,
      };

      if (selectedManagedPlace) {
        const updated = await updatePlaceInDb(basePlace);
        if (!updated) return;
        setManagedPlaces((current) => current.map((place) => (place.id === updated.id ? updated : place)));
        setSelectedManagedPlaceId(updated.id);
        setManagedMessage("내 장소를 수정했어요.");
        return;
      }

      const duplicate = managedPlaces.find((place) => getVisitedPlaceKey(place.name, place.address) === getVisitedPlaceKey(trimmedName, trimmedAddress));
      if (duplicate) {
        setSelectedManagedPlaceId(duplicate.id);
        setManagedMessage("같은 이름과 주소의 내 장소가 이미 있어요.");
        return;
      }

      const created = await createPlaceInDb(basePlace);
      if (!created) return;
      setManagedPlaces((current) => [created, ...current]);
      setSelectedManagedPlaceId(created.id);
      setManagedMessage("내 장소에 추가했어요.");
    } finally {
      setIsSavingPlace(false);
    }
  };

  const deleteManagedPlace = async () => {
    if (!selectedManagedPlace || isDeletingPlace) return;
    setIsDeletingPlace(true);
    try {
      await deletePlaceFromDb(selectedManagedPlace.id);
      setManagedPlaces((current) => current.filter((place) => place.id !== selectedManagedPlace.id));
      setSelectedManagedPlaceId("");
      setManagedName("");
      setManagedAddress("");
      setManagedMemo("");
      setManagedMessage("내 장소를 삭제했어요.");
    } finally {
      setIsDeletingPlace(false);
    }
  };

  const saveSearchResultToManagedPlaces = async (place: PlaceRecord) => {
    const duplicate = managedPlaces.find((item) => getVisitedPlaceKey(item.name, item.address) === getVisitedPlaceKey(place.name, place.address));
    if (duplicate) {
      setSelectedManagedPlaceId(duplicate.id);
      setManagedName(duplicate.name);
      setManagedAddress(duplicate.address);
      setManagedMemo(duplicate.memo ?? "");
      setManagedMessage("이미 저장된 내 장소예요.");
      return;
    }

    setIsSavingPlace(true);
    setManagedMessage("");
    try {
      const created = await createPlaceInDb({
        ...place,
        folderId: undefined,
        folderIds: [],
        memo: undefined,
      });
      if (!created) return;
      setManagedPlaces((current) => [created, ...current]);
      setSelectedManagedPlaceId(created.id);
      setManagedName(created.name);
      setManagedAddress(created.address);
      setManagedMemo(created.memo ?? "");
      setManagedMessage("검색 결과를 내 장소에 저장했어요.");
    } finally {
      setIsSavingPlace(false);
    }
  };

  const selectedPeriodLabel = startDate && endDate ? (startDate === endDate ? startDate : `${startDate} ~ ${endDate}`) : "전체 기간";
  const totalPlaceVisits = filteredVisitedPlaces.reduce((sum, place) => sum + place.visitCount, 0);
  const totalPlaceExpense = filteredVisitedPlaces.reduce((sum, place) => sum + place.totalExpense, 0);

  return (
    <div className="life-tab-panel">
      <LifeTabHeading title="장소" description="방문 흐름을 보는 장소 축과, 앞으로 기록 입력에 재사용할 내 장소 사전을 한 곳에서 함께 관리합니다." />

      <SectionCard className="life-places-toolbar">
        <label className="life-places-search">
          <Search aria-hidden size={17} />
          <input
            placeholder="장소명, 주소, 함께한 사람으로 찾기"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void runExternalPlaceSearch();
            }}
          />
          <button disabled={isSearching || query.trim().length === 0} onClick={() => void runExternalPlaceSearch()} type="button">
            {isSearching ? "검색 중..." : "장소 검색"}
          </button>
        </label>

        <div className="life-places-period">
          <span>
            <CalendarRange aria-hidden size={16} />
            기간
          </span>
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <i>~</i>
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </div>

        <button className="life-places-toggle" onClick={() => setShowVisitedMarkers((current) => !current)} type="button">
          {showVisitedMarkers ? <ToggleRight aria-hidden size={18} /> : <ToggleLeft aria-hidden size={18} />}
          <span>방문 마커 {showVisitedMarkers ? "ON" : "OFF"}</span>
          <b>{filteredVisitedPlaces.length}곳</b>
        </button>
      </SectionCard>

      {searchMessage ? <p className="life-places-message">{searchMessage}</p> : null}
      {managedMessage ? <p className="life-places-message">{managedMessage}</p> : null}

      <div className="life-places-layout">
        <SectionCard className="life-places-map-panel">
          <div className="life-places-panel-head">
            <div>
              <span>Place Map</span>
              <strong>{selectedPeriodLabel}</strong>
            </div>
            <p>{filteredVisitedPlaces.length}곳 · {totalPlaceVisits}건 방문 · {totalPlaceExpense > 0 ? formatWon(totalPlaceExpense) : "지출 연결 없음"}</p>
          </div>

          <div className="life-places-map-shell">
            <div className={`life-places-map ${mapStatus !== "ready" ? "life-places-map--hidden" : ""}`} ref={mapElementRef} />
            {mapStatus !== "ready" ? (
              <div className="life-places-map-empty">
                <MapPin aria-hidden size={24} />
                <strong>{mapStatus === "missing-key" ? "네이버 지도 키가 필요합니다." : "지도를 준비하는 중입니다."}</strong>
                <p>방문 장소와 내 장소를 같은 지도 위에서 함께 읽을 수 있게 불러오고 있어요.</p>
              </div>
            ) : filteredVisitedPlaces.length === 0 && managedPlacesFiltered.length === 0 && searchResults.length === 0 ? (
              <div className="life-places-map-empty">
                <MapPin aria-hidden size={24} />
                <strong>표시할 장소가 아직 없습니다.</strong>
                <p>활동에 장소를 더 붙이거나, 아래에서 내 장소를 먼저 만들어둘 수 있어요.</p>
              </div>
            ) : null}
          </div>

          {searchResults.length > 0 ? (
            <div className="life-places-search-results">
              {searchResults.map((place) => (
                <article key={place.id}>
                  <div>
                    <strong>{place.name}</strong>
                    <span>{place.address}</span>
                  </div>
                  <button disabled={isSavingPlace} onClick={() => void saveSearchResultToManagedPlaces(place)} type="button">
                    <Star aria-hidden size={14} />
                    내 장소 저장
                  </button>
                </article>
              ))}
            </div>
          ) : null}
        </SectionCard>

        <div className="life-places-side">
          <SectionCard className="life-places-manager">
            <div className="life-places-panel-head">
              <div>
                <span>Managed Places</span>
                <strong>내 장소 {managedPlaces.length}곳</strong>
              </div>
              <p>지도 검색과 별개로, 기록 입력에서 반복 재사용할 장소 사전</p>
            </div>

            <div className="life-places-manager__actions">
              <button onClick={beginCreateManagedPlace} type="button">
                <Plus aria-hidden size={15} />
                새 장소
              </button>
            </div>

            <div className="life-places-manager__list">
              {managedPlacesFiltered.length > 0 ? (
                managedPlacesFiltered.map((place) => (
                  <button
                    className={selectedManagedPlaceId === place.id ? "life-places-manager__place life-places-manager__place--active" : "life-places-manager__place"}
                    key={place.id}
                    onClick={() => setSelectedManagedPlaceId(place.id)}
                    type="button"
                  >
                    <strong>{place.name}</strong>
                    <span>{place.address}</span>
                  </button>
                ))
              ) : (
                <div className="life-places-empty-inline">
                  <strong>아직 저장된 내 장소가 없습니다.</strong>
                  <p>위 검색 결과에서 저장하거나, 직접 이름과 주소를 입력해서 만들 수 있어요.</p>
                </div>
              )}
            </div>

            <div className="life-places-manager__form">
              <div className="life-places-manager__form-head">
                <strong>{selectedManagedPlace ? "내 장소 수정" : "내 장소 추가"}</strong>
                {selectedManagedPlace ? <span>{selectedManagedPlace.provider === "naver" ? "지도 기반" : "직접 관리"}</span> : null}
              </div>

              <label>
                <span>장소 이름</span>
                <input placeholder="예: 집, 회사, 단골 카페" value={managedName} onChange={(event) => setManagedName(event.target.value)} />
              </label>

              <label>
                <span>주소</span>
                <input placeholder="예: 서울시 강남구 ..." value={managedAddress} onChange={(event) => setManagedAddress(event.target.value)} />
              </label>

              <label>
                <span>메모</span>
                <textarea placeholder="이 장소를 어떻게 기억하면 좋은지 적어둘 수 있어요." rows={3} value={managedMemo} onChange={(event) => setManagedMemo(event.target.value)} />
              </label>

              <div className="life-places-manager__buttons">
                <button disabled={isSavingPlace || !managedName.trim() || !managedAddress.trim()} onClick={() => void saveManagedPlace()} type="button">
                  <Save aria-hidden size={15} />
                  {selectedManagedPlace ? "수정 저장" : "내 장소 저장"}
                </button>
                {selectedManagedPlace ? (
                  <button className="life-places-manager__delete" disabled={isDeletingPlace} onClick={() => void deleteManagedPlace()} type="button">
                    <Trash2 aria-hidden size={15} />
                    삭제
                  </button>
                ) : null}
              </div>
            </div>
          </SectionCard>

          <SectionCard className="life-places-summary">
            <div className="life-places-panel-head">
              <div>
                <span>Visited Places</span>
                <strong>{filteredVisitedPlaces.length}곳</strong>
              </div>
              <p>현재 필터 기준으로 실제 방문 기록이 남은 장소</p>
            </div>

            <div className="life-places-place-list">
              {filteredVisitedPlaces.length > 0 ? (
                filteredVisitedPlaces.map((place) => (
                  <button
                    className={selectedVisitedPlace?.key === place.key ? "life-places-place-button life-places-place-button--active" : "life-places-place-button"}
                    key={place.key}
                    onClick={() => setSelectedPlaceKey(place.key)}
                    type="button"
                  >
                    <strong>{place.name}</strong>
                    <span>{place.address || "주소 없음"}</span>
                    <em>{place.visitCount}회 · {place.visitDates.length}일</em>
                  </button>
                ))
              ) : (
                <div className="life-places-empty-inline">
                  <strong>해당 기간에 방문 장소가 없습니다.</strong>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard className="life-places-detail">
            <div className="life-places-panel-head">
              <div>
                <span>Place Records</span>
                <strong>{selectedVisitedPlace?.name ?? "장소를 선택하세요"}</strong>
              </div>
              <p>{selectedVisitedPlace ? `${selectedVisitedPlace.visitCount}건 방문 기록` : "마커나 목록을 눌러 오른쪽에서 기록을 봅니다."}</p>
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
                    <strong>{selectedVisitedPlace.totalExpense > 0 ? formatWon(selectedVisitedPlace.totalExpense) : "-"}</strong>
                  </article>
                </div>

                <div className="life-places-detail-meta">
                  {selectedVisitedPlace.address ? <p>{selectedVisitedPlace.address}</p> : null}
                  {selectedVisitedPlace.people.length > 0 ? <p>함께한 사람 · {selectedVisitedPlace.people.join(", ")}</p> : null}
                  {selectedVisitedPlace.categories.length > 0 ? <p>주요 활동 · {selectedVisitedPlace.categories.join(" · ")}</p> : null}
                </div>

                <div className="life-places-record-list">
                  {selectedVisitedPlace.records.map((record) => (
                    <article key={record.id}>
                      <div className="life-places-record-head">
                        <span>{record.date}</span>
                        <Link href={`/life/calendar?date=${record.date}`}>그날 보기</Link>
                      </div>
                      <strong>{formatActivityTime(record.startTime, record.endTime)} {record.title}</strong>
                      <div className="life-places-record-meta">
                        {record.people.length > 0 ? <p>with {record.people.join(", ")}</p> : null}
                        {record.expenseAmount ? <p>{formatWon(record.expenseAmount)}</p> : null}
                        {record.logCount > 0 || record.photoCount > 0 ? <p>하루기록 {record.logCount} · 사진 {record.photoCount}</p> : null}
                      </div>
                      {record.memo ? <p className="life-places-record-note">{record.memo}</p> : null}
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="life-places-empty-inline">
                <strong>장소를 선택하면 여기서 기록이 열립니다.</strong>
                <p>방문 장소를 눌러, 그 장소에서 어떤 하루와 활동이 쌓였는지 바로 읽을 수 있어요.</p>
              </div>
            )}
          </SectionCard>
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
