import { getCurrentUserId } from "@/lib/authUser";
import { supabase } from "@/lib/supabase";

export type PlaceVerificationStatus = "checking" | "unverified" | "verified";

export type PlaceVerificationTarget = {
  address?: string;
  key: string;
  name: string;
};

type PlaceVerificationRow = {
  checked_at: string;
  place_key: string;
  status: "unverified" | "verified";
};

const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function loadPlaceVerificationCache(keys: string[]) {
  if (!supabase || keys.length === 0) return new Map<string, PlaceVerificationRow>();
  const userId = await getCurrentUserId();
  if (!userId) return new Map<string, PlaceVerificationRow>();
  const { data, error } = await supabase.from("place_verifications").select("place_key,status,checked_at").eq("user_id", userId).in("place_key", keys);
  if (error?.code === "42P01") return new Map<string, PlaceVerificationRow>();
  if (error) throw error;
  return new Map(((data ?? []) as PlaceVerificationRow[]).map((row) => [row.place_key, row]));
}

export async function verifyPlaceTarget(target: PlaceVerificationTarget) {
  const query = target.address?.trim() || target.name.trim();
  if (!query) return null;
  const endpoint = target.address?.trim() ? "/api/maps/geocode" : "/api/maps/search-place";
  const response = await fetch(`${endpoint}?query=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("장소 확인 요청에 실패했습니다.");
  const payload = await response.json() as { places?: Array<{ address?: string; name?: string }> };
  const match = payload.places?.[0];
  const status = match ? "verified" as const : "unverified" as const;
  await savePlaceVerification(target.key, status, match?.name, match?.address);
  return status;
}

export function isFreshPlaceVerification(checkedAt: string) {
  const checkedTime = new Date(checkedAt).getTime();
  return Number.isFinite(checkedTime) && Date.now() - checkedTime < CACHE_MAX_AGE_MS;
}

async function savePlaceVerification(placeKey: string, status: "unverified" | "verified", matchedName?: string, matchedAddress?: string) {
  if (!supabase) return;
  const userId = await getCurrentUserId();
  if (!userId) return;
  const { error } = await supabase.from("place_verifications").upsert({
    checked_at: new Date().toISOString(),
    matched_address: matchedAddress ?? null,
    matched_name: matchedName ?? null,
    place_key: placeKey,
    status,
    user_id: userId,
  }, { onConflict: "user_id,place_key" });
  if (error?.code === "42P01") return;
  if (error) throw error;
}
