import { NextResponse } from "next/server";

const naverKeyId = process.env.NAVER_MAPS_API_KEY_ID ?? process.env.NAVER_MAPS_CLIENT_ID;
const naverKey = process.env.NAVER_MAPS_API_KEY ?? process.env.NAVER_MAPS_CLIENT_SECRET;

type NaverGeocodeAddress = {
  roadAddress?: string;
  jibunAddress?: string;
  englishAddress?: string;
  x?: string;
  y?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ places: [] });
  }

  if (!naverKeyId || !naverKey) {
    return NextResponse.json(
      { error: "네이버 지도 Geocoding API 키가 설정되지 않았습니다.", places: [] },
      { status: 503 },
    );
  }

  const response = await fetch(`https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(query)}&count=8`, {
    headers: {
      Accept: "application/json",
      "x-ncp-apigw-api-key": naverKey,
      "x-ncp-apigw-api-key-id": naverKeyId,
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "장소 검색에 실패했습니다.", places: [] }, { status: response.status });
  }

  const payload = await response.json();
  const places = ((payload.addresses ?? []) as NaverGeocodeAddress[])
    .map((address, index) => ({
      id: `${address.x ?? "lng"}-${address.y ?? "lat"}-${index}`,
      name: address.roadAddress || address.jibunAddress || query,
      address: address.roadAddress || address.jibunAddress || address.englishAddress || query,
      latitude: Number(address.y),
      longitude: Number(address.x),
      provider: "naver" as const,
      providerPlaceId: `${address.x ?? ""},${address.y ?? ""}`,
    }))
    .filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude));

  return NextResponse.json({ places });
}
