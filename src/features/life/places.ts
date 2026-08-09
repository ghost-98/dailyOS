import type { LifeActivityRecord, PlanPlace } from "@/types/domain";

export type LifePlaceRef = {
  address?: string;
  category?: string;
  latitude?: number;
  longitude?: number;
  name: string;
  providerPlaceId?: string;
};

export function getActivityPlaceRef(activity: LifeActivityRecord): LifePlaceRef | null {
  if (!activity.placeName) return null;
  return {
    address: activity.placeAddress,
    name: activity.placeName,
  };
}

export function getLifePlaceKey(place: LifePlaceRef) {
  return `${place.providerPlaceId ?? ""}|${place.name}|${place.latitude ?? ""}|${place.longitude ?? ""}|${place.address ?? ""}`;
}

export function uniqueLifePlaceRefs(places: LifePlaceRef[]) {
  const uniquePlaces = new Map<string, LifePlaceRef>();
  places.forEach((place) => {
    const key = getLifePlaceKey(place);
    if (!uniquePlaces.has(key)) uniquePlaces.set(key, place);
  });
  return [...uniquePlaces.values()];
}

export function uniquePlanPlaces(places: PlanPlace[]) {
  const uniquePlaces = new Map<string, PlanPlace>();
  places.forEach((place) => {
    const key = `${place.providerPlaceId ?? ""}|${place.name}|${place.latitude}|${place.longitude}`;
    if (!uniquePlaces.has(key)) uniquePlaces.set(key, place);
  });
  return [...uniquePlaces.values()];
}
