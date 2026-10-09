"use client";

import { useEffect, useMemo, useState } from "react";
import { isFreshPlaceVerification, loadPlaceVerificationCache, verifyPlaceTarget, type PlaceVerificationStatus, type PlaceVerificationTarget } from "@/features/data/places/verificationApi";
import { getPlaceIdentityKey, type PlaceIdentity } from "@/features/data/places/placeIdentity";

const VERIFICATION_CONCURRENCY = 4;
const VERIFICATION_KEY_VERSION = "v5";

export function usePlaceVerificationStatuses(targets: PlaceVerificationTarget[]) {
  const [statuses, setStatuses] = useState<Record<string, PlaceVerificationStatus>>({});
  const targetSignature = JSON.stringify(targets);
  const uniqueTargets = useMemo(() => {
    const snapshot = JSON.parse(targetSignature) as PlaceVerificationTarget[];
    return [...new Map(snapshot.map((target) => [target.key, target])).values()];
  }, [targetSignature]);

  useEffect(() => {
    let isMounted = true;
    if (uniqueTargets.length === 0) {
      setStatuses({});
      return () => { isMounted = false; };
    }

    const run = async () => {
      const cache = await loadPlaceVerificationCache(uniqueTargets.map((target) => target.key));
      const next: Record<string, PlaceVerificationStatus> = {};
      const targetsToCheck: PlaceVerificationTarget[] = [];
      uniqueTargets.forEach((target) => {
        const cached = cache.get(target.key);
        if (cached && isFreshPlaceVerification(cached.checked_at)) next[target.key] = cached.status;
        else {
          next[target.key] = "checking";
          targetsToCheck.push(target);
        }
      });
      if (isMounted) setStatuses(next);

      let nextTargetIndex = 0;
      const verifyNext = async () => {
        while (nextTargetIndex < targetsToCheck.length) {
          const target = targetsToCheck[nextTargetIndex++];
          try {
            const status = await verifyPlaceTarget(target);
            if (isMounted && status) setStatuses((current) => ({ ...current, [target.key]: status }));
          } catch (error) {
            console.error("Failed to verify place", error);
            if (isMounted) setStatuses((current) => ({ ...current, [target.key]: "error" }));
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(VERIFICATION_CONCURRENCY, targetsToCheck.length) }, verifyNext));
    };
    void run().catch((error) => {
      console.error("Failed to load place verification cache", error);
      if (isMounted) setStatuses(Object.fromEntries(uniqueTargets.map((target) => [target.key, "error"])));
    });
    return () => { isMounted = false; };
  }, [uniqueTargets]);

  return statuses;
}

export function getPlaceVerificationKey(place: PlaceIdentity) {
  return `${VERIFICATION_KEY_VERSION}:${getPlaceIdentityKey(place)}`;
}

export function createPlaceVerificationTarget(place: PlaceIdentity): PlaceVerificationTarget {
  return { ...place, key: getPlaceVerificationKey(place) };
}

export function getPlaceVerificationNotice(status?: PlaceVerificationStatus) {
  if (status === "unverified") return "NAVER에서 현재 확인되지 않는 장소";
  if (status === "checking") return "NAVER 장소 확인 중";
  if (status === "error") return "NAVER 장소 확인을 잠시 완료하지 못함";
  return undefined;
}

export function getPlaceVerificationBadge(status?: PlaceVerificationStatus) {
  if (status === "unverified") return "NAVER 확인 안 됨";
  if (status === "checking") return "확인 중";
  if (status === "error") return "확인 지연";
  return undefined;
}
