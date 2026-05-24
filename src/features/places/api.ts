import { supabase } from "@/lib/supabase";
import type { PlaceFolder, PlaceProvider, PlaceRecord } from "@/types/domain";

type PlaceRow = {
  id: string;
  folder_id: string | null;
  name: string;
  address: string;
  latitude: number | string;
  longitude: number | string;
  provider: PlaceProvider;
  provider_place_id: string | null;
  phone: string | null;
  category: string | null;
  url: string | null;
  is_favorite: boolean | null;
  memo: string | null;
};

type PlaceFolderRow = {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
};
type PlaceFolderLinkRow = {
  place_id: string;
  folder_id: string;
};

type PlaceInsert = Omit<PlaceRow, "id"> & {
  user_id: string;
};
type PlaceFolderInsert = Omit<PlaceFolderRow, "id"> & {
  user_id: string;
};
type PlaceFolderUpdate = Partial<Omit<PlaceFolderInsert, "user_id">>;
type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

const placeColumns = "id,folder_id,name,address,latitude,longitude,provider,provider_place_id,phone,category,url,is_favorite,memo";
const folderColumns = "id,name,color,icon,sort_order";
const folderLinkColumns = "place_id,folder_id";

async function getUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

function mapPlaceRow(row: PlaceRow, folderIds: string[] = []): PlaceRecord {
  const mergedFolderIds = [...new Set([row.folder_id, ...folderIds].filter((folderId): folderId is string => Boolean(folderId)))];
  return {
    id: row.id,
    folderId: mergedFolderIds[0] ?? undefined,
    folderIds: mergedFolderIds,
    name: row.name,
    address: row.address,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    provider: row.provider,
    providerPlaceId: row.provider_place_id ?? undefined,
    phone: row.phone ?? undefined,
    category: row.category ?? undefined,
    url: row.url ?? undefined,
    isFavorite: Boolean(row.is_favorite),
    memo: row.memo ?? undefined,
  };
}

function mapFolderRow(row: PlaceFolderRow): PlaceFolder {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order,
  };
}

function mapPlaceInsert(place: PlaceRecord, userId: string): PlaceInsert {
  return {
    user_id: userId,
    folder_id: place.folderId ?? null,
    name: place.name.trim(),
    address: place.address.trim(),
    latitude: place.latitude,
    longitude: place.longitude,
    provider: place.provider,
    provider_place_id: place.providerPlaceId ?? null,
    phone: place.phone?.trim() || null,
    category: place.category?.trim() || null,
    url: place.url?.trim() || null,
    is_favorite: Boolean(place.isFavorite),
    memo: place.memo?.trim() || null,
  };
}

function isMissingRelationError(error: SupabaseErrorLike | null | undefined) {
  return error?.code === "42P01" || error?.message?.includes("does not exist") || false;
}

export async function fetchPlaceFoldersFromDb() {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase.from("place_folders").select(folderColumns).order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as PlaceFolderRow[]).map(mapFolderRow);
}

export async function fetchPlacesFromDb() {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const [{ data, error }, { data: linkData, error: linkError }] = await Promise.all([
    supabase.from("places").select(placeColumns).order("created_at", { ascending: false }),
    supabase.from("place_folder_links").select(folderLinkColumns),
  ]);
  if (error) throw error;
  if (linkError && !isMissingRelationError(linkError)) throw linkError;

  const linksByPlaceId = new Map<string, string[]>();
  for (const link of (linkData ?? []) as PlaceFolderLinkRow[]) {
    linksByPlaceId.set(link.place_id, [...(linksByPlaceId.get(link.place_id) ?? []), link.folder_id]);
  }

  return (data as PlaceRow[]).map((row) => mapPlaceRow(row, linksByPlaceId.get(row.id) ?? []));
}

export async function createPlaceInDb(place: PlaceRecord) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase.from("places").insert(mapPlaceInsert(place, userId)).select(placeColumns).single();
  if (error) throw error;
  return mapPlaceRow(data as PlaceRow);
}

export async function setPlaceFolderLinksInDb(placeId: string, folderIds: string[]) {
  if (!supabase) return false;
  const userId = await getUserId();
  if (!userId) return false;

  const { error: deleteError } = await supabase.from("place_folder_links").delete().eq("place_id", placeId);
  if (isMissingRelationError(deleteError)) return false;
  if (deleteError) throw deleteError;

  const uniqueFolderIds = [...new Set(folderIds)];
  if (uniqueFolderIds.length === 0) return true;

  const { error: insertError } = await supabase.from("place_folder_links").insert(
    uniqueFolderIds.map((folderId) => ({
      user_id: userId,
      place_id: placeId,
      folder_id: folderId,
    })),
  );
  if (isMissingRelationError(insertError)) return false;
  if (insertError) throw insertError;
  return true;
}

export async function createPlaceFolderInDb(folder: Omit<PlaceFolder, "id">) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const row: PlaceFolderInsert = {
    user_id: userId,
    name: folder.name.trim(),
    color: folder.color,
    icon: folder.icon,
    sort_order: folder.sortOrder,
  };
  const { data, error } = await supabase.from("place_folders").insert(row).select(folderColumns).single();
  if (error) throw error;
  return mapFolderRow(data as PlaceFolderRow);
}

export async function updatePlaceFolderInDb(folder: PlaceFolder) {
  if (!supabase) return null;

  const row: PlaceFolderUpdate = {
    name: folder.name.trim(),
    color: folder.color,
    icon: folder.icon,
    sort_order: folder.sortOrder,
  };
  const { data, error } = await supabase.from("place_folders").update(row).eq("id", folder.id).select(folderColumns).single();
  if (error) throw error;
  return mapFolderRow(data as PlaceFolderRow);
}

export async function deletePlaceFolderFromDb(id: string) {
  if (!supabase) return false;
  const { data, error } = await supabase.from("place_folders").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function deletePlaceFromDb(id: string) {
  if (!supabase) return false;
  const { data, error } = await supabase.from("places").delete().eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
