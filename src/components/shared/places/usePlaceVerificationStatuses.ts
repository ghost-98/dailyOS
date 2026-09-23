"use client";

import { useEffect, useMemo, useState } from "react";
import { isFreshPlaceVerification, loadPlaceVerificationCache, verifyPlaceTarget, type PlaceVerificationStatus, type PlaceVerificationTarget } from "@/features/data/places/verificationApi";

export function usePlaceVerificationStatuses(targets: PlaceVerificationTarget[]) {
  const [statuses, setStatuses] = useState<Record<string, PlaceVerificationStatus>>({});
  const targetSignature = useMemo(() => targets.map((target) => `${target.key}|${target.name}|${target.address ?? ""}`).join("\n"), [targets]);

  useEffect(() => {
    let isMounted = true;
    const uniqueTargets = [...new Map(targets.map((target) => [target.key, target])).values()];
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

      await Promise.all(targetsToCheck.map(async (target) => {
        try {
          const status = await verifyPlaceTarget(target);
          if (isMounted && status) setStatuses((current) => ({ ...current, [target.key]: status }));
        } catch (error) {
          console.error("Failed to verify place", error);
        }
      }));
    };
    void run();
    return () => { isMounted = false; };
  }, [targetSignature]);

  return statuses;
}

export function getPlaceVerificationKey(place: { address?: string; latitude?: number; longitude?: number; name: string }) {
  const address = place.address?.trim().toLocaleLowerCase("ko-KR");
  if (address) return `address:${address}`;
  if (typeof place.latitude === "number" && typeof place.longitude === "number") return `coordinates:${place.latitude.toFixed(6)},${place.longitude.toFixed(6)}`;
  return `name:${place.name.trim().toLocaleLowerCase("ko-KR")}`;
}
