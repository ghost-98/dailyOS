import { supabase } from "@/lib/supabase";
import type { EventType } from "@/types/domain";
import type { CalendarEvent } from "./data";

type CalendarEventRow = {
  id: string;
  event_date: string;
  event_time: string | null;
  type: EventType;
  title: string;
  meta: string;
  place_name: string | null;
  place_address: string | null;
  place_latitude: number | string | null;
  place_longitude: number | string | null;
  place_provider_id: string | null;
  place_phone: string | null;
  place_category: string | null;
  place_url: string | null;
};

type CalendarEventInsert = Omit<CalendarEventRow, "id"> & {
  user_id: string;
};

type CalendarEventUpdate = Partial<Omit<CalendarEventInsert, "user_id">>;

const selectColumns = "id,event_date,event_time,type,title,meta,place_name,place_address,place_latitude,place_longitude,place_provider_id,place_phone,place_category,place_url";

async function getUserId() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

function mapRowToEvent(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    date: row.event_date,
    type: row.type,
    title: row.title,
    time: row.event_time?.slice(0, 5) || undefined,
    meta: row.meta,
    place: mapRowPlace(row),
  };
}

function mapRowPlace(row: CalendarEventRow) {
  const latitude = row.place_latitude === null ? null : Number(row.place_latitude);
  const longitude = row.place_longitude === null ? null : Number(row.place_longitude);
  if (!row.place_name || latitude === null || longitude === null || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;

  return {
    name: row.place_name,
    address: row.place_address ?? "",
    latitude,
    longitude,
    providerPlaceId: row.place_provider_id ?? undefined,
    phone: row.place_phone ?? undefined,
    category: row.place_category ?? undefined,
    url: row.place_url ?? undefined,
  };
}

function mapEventToInsert(event: CalendarEvent, userId: string): CalendarEventInsert {
  return {
    user_id: userId,
    event_date: event.date,
    event_time: event.time ?? null,
    type: event.type,
    title: event.title,
    meta: event.meta,
    place_name: event.place?.name ?? null,
    place_address: event.place?.address ?? null,
    place_latitude: event.place?.latitude ?? null,
    place_longitude: event.place?.longitude ?? null,
    place_provider_id: event.place?.providerPlaceId ?? null,
    place_phone: event.place?.phone ?? null,
    place_category: event.place?.category ?? null,
    place_url: event.place?.url ?? null,
  };
}

function mapEventToUpdate(event: CalendarEvent): CalendarEventUpdate {
  return {
    event_date: event.date,
    event_time: event.time ?? null,
    type: event.type,
    title: event.title,
    meta: event.meta,
    place_name: event.place?.name ?? null,
    place_address: event.place?.address ?? null,
    place_latitude: event.place?.latitude ?? null,
    place_longitude: event.place?.longitude ?? null,
    place_provider_id: event.place?.providerPlaceId ?? null,
    place_phone: event.place?.phone ?? null,
    place_category: event.place?.category ?? null,
    place_url: event.place?.url ?? null,
  };
}

export async function fetchCalendarEventsFromDb() {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("calendar_events")
    .select(selectColumns)
    .order("event_date", { ascending: true })
    .order("event_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as CalendarEventRow[]).map(mapRowToEvent);
}

export async function createCalendarEventInDb(event: CalendarEvent) {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("calendar_events")
    .insert(mapEventToInsert(event, userId))
    .select(selectColumns)
    .single();

  if (error) throw error;
  return mapRowToEvent(data as CalendarEventRow);
}

export async function updateCalendarEventInDb(event: CalendarEvent) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("calendar_events")
    .update(mapEventToUpdate(event))
    .eq("id", event.id)
    .select(selectColumns)
    .single();

  if (error) throw error;
  return mapRowToEvent(data as CalendarEventRow);
}

export async function deleteCalendarEventFromDb(id: string) {
  if (!supabase) return false;

  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw error;
  return true;
}
