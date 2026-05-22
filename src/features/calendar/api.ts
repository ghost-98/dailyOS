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
};

type CalendarEventInsert = Omit<CalendarEventRow, "id"> & {
  user_id: string;
};

type CalendarEventUpdate = Partial<Omit<CalendarEventInsert, "user_id">>;

const selectColumns = "id,event_date,event_time,type,title,meta";

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
  };
}

function mapEventToUpdate(event: CalendarEvent): CalendarEventUpdate {
  return {
    event_date: event.date,
    event_time: event.time ?? null,
    type: event.type,
    title: event.title,
    meta: event.meta,
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
