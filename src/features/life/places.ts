import type { LifeActivityRecord } from "@/types/domain";

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
