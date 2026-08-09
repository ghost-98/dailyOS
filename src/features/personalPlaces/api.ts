import { getCurrentUserId } from "@/lib/authUser";
import { supabase } from "@/lib/supabase";
import type { PersonalPlaceRecord } from "@/types/domain";

type PersonalPlaceRow = {
  id: string;
  label: string;
  mapped_name: string | null;
  address: string;
  latitude: number | string;
  longitude: number | string;
  provider_place_id: string | null;
  phone: string | null;
  category: string | null;
  url: string | null;
  memo: string | null;
};

type PersonalPlaceInsert = Omit<PersonalPlaceRow, "id"> & {
  user_id: string;
};

const personalPlaceColumns = "id,label,mapped_name,address,latitude,longitude,provider_place_id,phone,category,url,memo";

function mapPersonalPlaceRow(row: PersonalPlaceRow): PersonalPlaceRecord {
  return {
    id: row.id,
    label: row.label,
    mappedName: row.mapped_name ?? undefined,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    providerPlaceId: row.provider_place_id ?? undefined,
    phone: row.phone ?? undefined,
    category: row.category ?? undefined,
    url: row.url ?? undefined,
    memo: row.memo ?? undefined,
  };
}

function mapPersonalPlaceInsert(place: Omit<PersonalPlaceRecord, "id">, userId: string): PersonalPlaceInsert {
  return {
    user_id: userId,
    label: place.label.trim(),
    mapped_name: place.mappedName?.trim() || null,
    address: place.address.trim(),
    latitude: place.latitude,
    longitude: place.longitude,
    provider_place_id: place.providerPlaceId ?? null,
    phone: place.phone?.trim() || null,
    category: place.category?.trim() || null,
    url: place.url?.trim() || null,
    memo: place.memo?.trim() || null,
  };
}

export async function fetchPersonalPlacesFromDb() {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase.from("personal_places").select(personalPlaceColumns).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as PersonalPlaceRow[]).map(mapPersonalPlaceRow);
}

export async function createPersonalPlaceInDb(place: Omit<PersonalPlaceRecord, "id">) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase.from("personal_places").insert(mapPersonalPlaceInsert(place, userId)).select(personalPlaceColumns).single();
  if (error) throw error;
  return mapPersonalPlaceRow(data as PersonalPlaceRow);
}

export async function updatePersonalPlaceInDb(place: PersonalPlaceRecord) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("personal_places")
    .update({
      label: place.label.trim(),
      mapped_name: place.mappedName?.trim() || null,
      address: place.address.trim(),
      latitude: place.latitude,
      longitude: place.longitude,
      provider_place_id: place.providerPlaceId ?? null,
      phone: place.phone?.trim() || null,
      category: place.category?.trim() || null,
      url: place.url?.trim() || null,
      memo: place.memo?.trim() || null,
    })
    .eq("id", place.id)
    .select(personalPlaceColumns)
    .single();

  if (error) throw error;
  return mapPersonalPlaceRow(data as PersonalPlaceRow);
}

export async function deletePersonalPlaceFromDb(id: string) {
  if (!supabase) return false;
  const { data, error } = await supabase.from("personal_places").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
