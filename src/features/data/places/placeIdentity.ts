export type PlaceIdentity = {
  address?: string;
  latitude?: number;
  longitude?: number;
  name: string;
  providerName?: string;
  providerPlaceId?: string;
};

export function getPlaceIdentityKey(place: PlaceIdentity) {
  const providerPlaceId = normalizeText(place.providerPlaceId);
  if (providerPlaceId) return `provider:${providerPlaceId}`;

  if (hasCoordinates(place)) {
    return `coordinates:${place.latitude.toFixed(5)},${place.longitude.toFixed(5)}`;
  }

  const address = normalizeAddress(place.address);
  if (address) return `address:${address}`;
  return `name:${normalizeText(place.providerName || place.name)}`;
}

export function getPlaceVerificationQueries(place: PlaceIdentity) {
  const name = (place.providerName || place.name).trim();
  const address = place.address?.trim() || "";
  return [...new Set([name, address].filter(Boolean))];
}

export function isSamePlaceIdentity(left: PlaceIdentity, right: PlaceIdentity) {
  if (left.providerPlaceId && right.providerPlaceId) return left.providerPlaceId === right.providerPlaceId;
  if (hasCoordinates(left) && hasCoordinates(right)) return distanceInMeters(left, right) <= 30;

  const leftAddress = normalizeAddress(left.address);
  const rightAddress = normalizeAddress(right.address);
  return Boolean(leftAddress && rightAddress && leftAddress === rightAddress);
}

export function normalizeAddress(value?: string) {
  return normalizeText(value)
    .replace(/\s+/g, " ")
    .replace(/\b(대한민국|한국)\b/g, "")
    .trim();
}

export function normalizePlaceName(value?: string) {
  return normalizeText(value).replace(/\s+/g, "").replace(/[^0-9a-z가-힣]/g, "");
}

export function hasCoordinates(place: PlaceIdentity): place is PlaceIdentity & { latitude: number; longitude: number } {
  return typeof place.latitude === "number" && Number.isFinite(place.latitude)
    && typeof place.longitude === "number" && Number.isFinite(place.longitude)
    && !(place.latitude === 0 && place.longitude === 0);
}

function normalizeText(value?: string) {
  return value?.trim().toLocaleLowerCase("ko-KR") ?? "";
}

function distanceInMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const latitudeDistance = (a.latitude - b.latitude) * 111_320;
  const longitudeDistance = (a.longitude - b.longitude) * 111_320 * Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(latitudeDistance, longitudeDistance);
}
