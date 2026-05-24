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

type PlaceInsert = Omit<PlaceRow, "id"> & {
  user_id: string;
};
type PlaceFolderInsert = Omit<PlaceFolderRow, "id"> & {
  user_id: string;
};
type PlaceFolderUpdate = Partial<Omit<PlaceFolderInsert, "user_id">>;

const placeColumns = "id,folder_id,name,address,latitude,longitude,provider,provider_place_id,phone,category,url,is_favorite,memo";
const folderColumns = "id,name,color,icon,sort_order";

const defaultFolderDrafts = [
  { color: "#9db2ff", icon: "briefcase", name: "취업", sortOrder: 10 },
  { color: "#65c9a4", icon: "heart", name: "생활", sortOrder: 20 },
  { color: "#d9ad63", icon: "book", name: "공부", sortOrder: 30 },
  { color: "#f09aaa", icon: "star", name: "가보고 싶은 곳", sortOrder: 40 },
  { color: "#a7a8ae", icon: "dot", name: "기타", sortOrder: 50 },
];

async function getUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

function mapPlaceRow(row: PlaceRow): PlaceRecord {
  return {
    id: row.id,
    folderId: row.folder_id ?? undefined,
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

export async function fetchPlaceFoldersFromDb() {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase.from("place_folders").select(folderColumns).order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as PlaceFolderRow[]).map(mapFolderRow);
}

export async function ensureDefaultPlaceFoldersInDb() {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const existingFolders = await fetchPlaceFoldersFromDb();
  if (existingFolders && existingFolders.length > 0) return existingFolders;

  const rows = defaultFolderDrafts.map((folder) => ({
    user_id: userId,
    name: folder.name,
    color: folder.color,
    icon: folder.icon,
    sort_order: folder.sortOrder,
  }));

  const { data, error } = await supabase.from("place_folders").insert(rows).select(folderColumns).order("sort_order", { ascending: true });
  if (error) throw error;
  return (data as PlaceFolderRow[]).map(mapFolderRow);
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
  const { error } = await supabase.from("place_folders").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function deletePlaceFromDb(id: string) {
  if (!supabase) return false;
  const { error } = await supabase.from("places").delete().eq("id", id);
  if (error) throw error;
  return true;
}
