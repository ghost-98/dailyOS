import { getCurrentUserId } from "@/lib/authUser";
import { supabase } from "@/lib/supabase";
import type { PersonRecord } from "@/types/domain";

type PersonRow = {
  id: string;
  name: string;
  memo: string | null;
};

const personColumns = "id,name,memo";

function mapRowToPerson(row: PersonRow): PersonRecord {
  return {
    id: row.id,
    memo: row.memo ?? undefined,
    name: row.name,
  };
}

export async function fetchPeopleFromDb() {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase.from("people").select(personColumns).eq("user_id", userId).order("name", { ascending: true });
  if (error) throw error;
  return (data as PersonRow[]).map(mapRowToPerson);
}

export async function createPersonInDb(input: { memo?: string; name: string }) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const trimmedName = input.name.trim();
  if (!trimmedName) return null;

  const { data, error } = await supabase
    .from("people")
    .insert({
      memo: input.memo?.trim() || null,
      name: trimmedName,
      user_id: userId,
    })
    .select(personColumns)
    .single();

  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("people")
      .select(personColumns)
      .eq("user_id", userId)
      .ilike("name", trimmedName)
      .maybeSingle();

    if (existingError) throw existingError;
    return existing ? mapRowToPerson(existing as PersonRow) : null;
  }

  if (error) throw error;
  return mapRowToPerson(data as PersonRow);
}

export async function updatePersonInDb(person: PersonRecord, previousName?: string) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const nextName = person.name.trim();
  const { data, error } = await supabase
    .from("people")
    .update({
      memo: person.memo?.trim() || null,
      name: nextName,
    })
    .eq("id", person.id)
    .eq("user_id", userId)
    .select(personColumns)
    .single();

  if (error) throw error;

  if (previousName && previousName !== nextName) {
    await renamePersonAcrossRecordsInDb(previousName, nextName);
  }

  return mapRowToPerson(data as PersonRow);
}

export async function deletePersonFromDb(id: string) {
  if (!supabase) return false;
  const userId = await getCurrentUserId();
  if (!userId) return false;
  const { error } = await supabase.from("people").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
  return true;
}

async function renamePersonAcrossRecordsInDb(previousName: string, nextName: string) {
  if (!supabase) return;
  const userId = await getCurrentUserId();
  if (!userId) return;

  await Promise.all([
    renameCompanionValuesInTable("calendar_events", userId, previousName, nextName),
    renameCompanionValuesInTable("tasks", userId, previousName, nextName),
    renameCompanionValuesInTable("life_activities", userId, previousName, nextName),
  ]);
}

async function renameCompanionValuesInTable(table: "calendar_events" | "life_activities" | "tasks", userId: string, previousName: string, nextName: string) {
  if (!supabase) return;

  const { data, error } = await supabase.from(table).select("id,companions").eq("user_id", userId).ilike("companions", `%${previousName}%`);
  if (error) throw error;

  for (const row of (data ?? []) as Array<{ companions: string | null; id: string }>) {
    const nextCompanions = renameCompanionValue(row.companions, previousName, nextName);
    if (nextCompanions === row.companions) continue;
    const { error: updateError } = await supabase.from(table).update({ companions: nextCompanions || null }).eq("id", row.id);
    if (updateError) throw updateError;
  }
}

function renameCompanionValue(value: string | null, previousName: string, nextName: string) {
  if (!value) return value;
  const names = value
    .split(/[,，、·]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const renamed = names.map((name) => (name === previousName ? nextName : name));
  return renamed.join(", ");
}
