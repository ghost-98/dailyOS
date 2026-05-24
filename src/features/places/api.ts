import { supabase } from "@/lib/supabase";
import type { PlaceProvider, PlaceRecord } from "@/types/domain";

type PlaceRow = {
  id: string;
  name: string;
  address: string;
  latitude: number | string;
  longitude: number | string;
  provider: PlaceProvider;
  provider_place_id: string | null;
  memo: string | null;
};

type PlaceInsert = Omit<PlaceRow, "id"> & {
  user_id: string;
};

const placeColumns = "id,name,address,latitude,longitude,provider,provider_place_id,memo";

async function getUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

function mapPlaceRow(row: PlaceRow): PlaceRecord {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    provider: row.provider,
    providerPlaceId: row.provider_place_id ?? undefined,
    memo: row.memo ?? undefined,
  };
}

function mapPlaceInsert(place: PlaceRecord, userId: string): PlaceInsert {
  return {
    user_id: userId,
    name: place.name.trim(),
    address: place.address.trim(),
    latitude: place.latitude,
    longitude: place.longitude,
    provider: place.provider,
    provider_place_id: place.providerPlaceId ?? null,
    memo: place.memo?.trim() || null,
  };
}

export async function fetchPlacesFromDb() {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase.from("places").select(placeColumns).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as PlaceRow[]).map(mapPlaceRow);
}

export async function createPlaceInDb(place: PlaceRecord) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase.from("places").insert(mapPlaceInsert(place, userId)).select(placeColumns).single();
  if (error) throw error;
  return mapPlaceRow(data as PlaceRow);
}

export async function deletePlaceFromDb(id: string) {
  if (!supabase) return false;
  const { error } = await supabase.from("places").delete().eq("id", id);
  if (error) throw error;
  return true;
}
