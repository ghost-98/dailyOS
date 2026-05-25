import { NextResponse } from "next/server";

const searchClientId = process.env.NAVER_SEARCH_CLIENT_ID;
const searchClientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
const mapsKeyId = process.env.NAVER_MAPS_API_KEY_ID ?? process.env.NAVER_MAPS_CLIENT_ID;
const mapsKey = process.env.NAVER_MAPS_API_KEY ?? process.env.NAVER_MAPS_CLIENT_SECRET;

type NaverLocalItem = {
  address?: string;
  category?: string;
  description?: string;
  link?: string;
  mapx?: string;
  mapy?: string;
  roadAddress?: string;
  telephone?: string;
  title?: string;
};

type NaverGeocodeAddress = {
  roadAddress?: string;
  jibunAddress?: string;
  x?: string;
  y?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ places: [] });
  }

  if (!searchClientId || !searchClientSecret) {
    return NextResponse.json(
      { error: "네이버 지역 검색 API 키가 설정되지 않았습니다.", places: [] },
      { status: 503 },
    );
  }

  const response = await fetch(`https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&sort=random`, {
    headers: {
      Accept: "application/json",
      "X-Naver-Client-Id": searchClientId,
      "X-Naver-Client-Secret": searchClientSecret,
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ detail, error: "네이버 지역 검색에 실패했습니다.", places: [] }, { status: response.status });
  }

  const payload = await response.json();
  const items = ((payload.items ?? []) as NaverLocalItem[]).slice(0, 5);
  const places = await Promise.all(items.map((item, index) => toPlace(item, index, query)));

  return NextResponse.json({ places: places.filter(Boolean) });
}

async function toPlace(item: NaverLocalItem, index: number, query: string) {
  const address = stripTags(item.roadAddress || item.address || "");
  const coordinates = getCoordinatesFromLocalItem(item) ?? (await geocodeAddress(address || query));
  if (!coordinates) return null;

  return {
    id: `naver-local-${coordinates.longitude}-${coordinates.latitude}-${index}`,
    name: stripTags(item.title || query),
    address,
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    provider: "naver" as const,
    providerPlaceId: `${coordinates.longitude},${coordinates.latitude}`,
    phone: stripTags(item.telephone || ""),
    category: stripTags(item.category || ""),
    url: item.link || "",
  };
}

function getCoordinatesFromLocalItem(item: NaverLocalItem) {
  if (!item.mapx || !item.mapy) return null;

  const longitude = Number(item.mapx) / 10000000;
  const latitude = Number(item.mapy) / 10000000;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}

async function geocodeAddress(address: string) {
  if (!address || !mapsKeyId || !mapsKey) return null;

  const response = await fetch(`https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}&count=1`, {
    headers: {
      Accept: "application/json",
      "x-ncp-apigw-api-key": mapsKey,
      "x-ncp-apigw-api-key-id": mapsKeyId,
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) return null;

  const payload = await response.json();
  const firstAddress = ((payload.addresses ?? []) as NaverGeocodeAddress[])[0];
  if (!firstAddress?.x || !firstAddress.y) return null;

  const longitude = Number(firstAddress.x);
  const latitude = Number(firstAddress.y);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
}
