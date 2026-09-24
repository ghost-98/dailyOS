import { getCurrentUserId } from "@/lib/authUser";
import { supabase } from "@/lib/supabase";
import type { PlanPlace } from "@/types/domain";
import { getPlaceIdentityKey } from "@/features/data/places/placeIdentity";

type SavedPlaceRow = {
  id: string;
  place_key: string;
  name: string;
  provider_name: string | null;
  address: string;
  latitude: number | string;
  longitude: number | string;
  provider_place_id: string | null;
  phone: string | null;
  category: string | null;
  url: string | null;
};

const savedPlaceColumns = "id,place_key,name,provider_name,address,latitude,longitude,provider_place_id,phone,category,url";

export function getSavedPlaceKey(place: PlanPlace) {
  return place.savedPlaceKey ?? getPlaceIdentityKey(place);
}

export async function fetchSavedPlacesFromDb() {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const { data, error } = await supabase.from("saved_places").select(savedPlaceColumns).eq("user_id", userId).order("name");
  if (error) throw error;
  return (data as SavedPlaceRow[]).map(mapSavedPlaceRow);
}

export async function saveSavedPlaceInDb(place: PlanPlace) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from("saved_places")
    .upsert({
      address: place.address.trim(),
      category: place.category?.trim() || null,
      latitude: place.latitude,
      longitude: place.longitude,
      name: place.name.trim(),
      provider_name: place.providerName?.trim() || place.name.trim(),
      phone: place.phone?.trim() || null,
      place_key: getSavedPlaceKey(place),
      provider_place_id: place.providerPlaceId ?? null,
      url: place.url?.trim() || null,
      user_id: userId,
    }, { onConflict: "user_id,place_key" })
    .select(savedPlaceColumns)
    .single();
  if (error) throw error;
  return mapSavedPlaceRow(data as SavedPlaceRow);
}

export async function deleteSavedPlaceFromDb(place: PlanPlace) {
  if (!supabase) return false;
  const userId = await getCurrentUserId();
  if (!userId) return false;
  let query = supabase.from("saved_places").delete().eq("user_id", userId);
  query = place.savedPlaceId ? query.eq("id", place.savedPlaceId) : query.eq("place_key", getSavedPlaceKey(place));
  const { error } = await query;
  if (error) throw error;
  return true;
}

function mapSavedPlaceRow(row: SavedPlaceRow): PlanPlace {
  return {
    address: row.address,
    category: row.category ?? undefined,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    name: row.name,
    providerName: row.provider_name ?? undefined,
    savedPlaceId: row.id,
    savedPlaceKey: row.place_key,
    phone: row.phone ?? undefined,
    providerPlaceId: row.provider_place_id ?? undefined,
    url: row.url ?? undefined,
  };
}
