import { getCurrentUserId } from "@/lib/authUser";
import { supabase } from "@/lib/supabase";
import { getPlaceVerificationQuery, hasCoordinates, normalizeAddress, normalizePlaceName, type PlaceIdentity } from "@/features/data/places/placeIdentity";
import type { PlaceRecord } from "@/types/domain";

export type PlaceVerificationStatus = "checking" | "error" | "unverified" | "verified";

export type PlaceVerificationTarget = PlaceIdentity & {
  key: string;
};

type PlaceVerificationRow = {
  checked_at: string;
  place_key: string;
  status: "unverified" | "verified";
};

const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_QUERY_BATCH_SIZE = 100;

export function isMissingPlaceVerificationTable(errorCode?: string) {
  return errorCode === "42P01" || errorCode === "PGRST205";
}

export async function loadPlaceVerificationCache(keys: string[]) {
  if (!supabase || keys.length === 0) return new Map<string, PlaceVerificationRow>();
  const userId = await getCurrentUserId();
  if (!userId) return new Map<string, PlaceVerificationRow>();
  const cache = new Map<string, PlaceVerificationRow>();

  for (let index = 0; index < keys.length; index += CACHE_QUERY_BATCH_SIZE) {
    const batch = keys.slice(index, index + CACHE_QUERY_BATCH_SIZE);
    const { data, error } = await supabase.from("place_verifications").select("place_key,status,checked_at").eq("user_id", userId).in("place_key", batch);
    if (isMissingPlaceVerificationTable(error?.code)) return new Map<string, PlaceVerificationRow>();
    if (error) throw error;
    ((data ?? []) as PlaceVerificationRow[]).forEach((row) => cache.set(row.place_key, row));
  }

  return cache;
}

export async function verifyPlaceTarget(target: PlaceVerificationTarget) {
  const query = getPlaceVerificationQuery(target);
  if (!query) return null;
  const response = await fetch(`/api/maps/search-place?query=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("장소 확인 요청에 실패했습니다.");
  const payload = await response.json() as { places?: PlaceRecord[] };
  const match = findMatchingPlace(target, payload.places ?? []);
  const status = match ? "verified" as const : "unverified" as const;
  await savePlaceVerification(target.key, status, match?.name, match?.address);
  return status;
}

function findMatchingPlace(target: PlaceVerificationTarget, candidates: PlaceRecord[]) {
  return candidates.find((candidate) => {
    if (target.providerPlaceId && candidate.providerPlaceId === target.providerPlaceId) return true;
    if (hasCoordinates(target) && distanceInMeters(target, candidate) <= 150) return true;

    const targetAddress = normalizeAddress(target.address);
    const candidateAddress = normalizeAddress(candidate.address);
    const addressMatches = Boolean(targetAddress && candidateAddress
      && (targetAddress.includes(candidateAddress) || candidateAddress.includes(targetAddress)));
    if (!addressMatches) return false;

    const targetName = normalizePlaceName(target.providerName || target.name);
    const candidateName = normalizePlaceName(candidate.name);
    return !targetName || !candidateName || targetName.includes(candidateName) || candidateName.includes(targetName);
  });
}

function distanceInMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const latitudeDistance = (a.latitude - b.latitude) * 111_320;
  const longitudeScale = Math.cos((a.latitude * Math.PI) / 180);
  const longitudeDistance = (a.longitude - b.longitude) * 111_320 * longitudeScale;
  return Math.hypot(latitudeDistance, longitudeDistance);
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
  if (isMissingPlaceVerificationTable(error?.code)) return;
  if (error) throw error;
}
