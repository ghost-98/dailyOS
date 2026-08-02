import { getCurrentUserId } from "@/lib/authUser";
import { supabase } from "@/lib/supabase";
import type { WeightRecord, WorkoutCondition, WorkoutSession, WorkoutType } from "@/types/domain";

type WeightRow = {
  id: string;
  record_date: string;
  weight_kg: number | string;
  measured_fasted: boolean;
  muscle_mass_kg: number | string | null;
  body_fat_percent: number | string | null;
  memo: string | null;
};

type WorkoutRow = {
  id: string;
  workout_date: string;
  type: WorkoutType;
  condition: WorkoutCondition;
  duration_minutes: number;
  duration_seconds: number | null;
  distance_km: number | string | null;
  memo: string | null;
};

type WeightInsert = Omit<WeightRow, "id"> & {
  user_id: string;
};

type WorkoutInsert = Omit<WorkoutRow, "id"> & {
  user_id: string;
};

type WeightUpdate = Partial<Omit<WeightInsert, "user_id">>;
type WorkoutUpdate = Partial<Omit<WorkoutInsert, "user_id">>;

const weightColumns = "id,record_date,weight_kg,measured_fasted,muscle_mass_kg,body_fat_percent,memo";
const workoutColumns = "id,workout_date,type,condition,duration_minutes,duration_seconds,distance_km,memo";

function toNumber(value: number | string | null) {
  if (value === null) return undefined;
  return Number(value);
}

function mapWeightRow(row: WeightRow): WeightRecord {
  return {
    id: row.id,
    date: row.record_date,
    weightKg: Number(row.weight_kg),
    measuredFasted: row.measured_fasted,
    muscleMassKg: toNumber(row.muscle_mass_kg),
    bodyFatPercent: toNumber(row.body_fat_percent),
    memo: row.memo ?? undefined,
  };
}

function mapWorkoutRow(row: WorkoutRow): WorkoutSession {
  return {
    id: row.id,
    date: row.workout_date,
    type: row.type,
    condition: row.condition,
    durationMinutes: row.duration_minutes,
    durationSeconds: row.duration_seconds ?? undefined,
    distanceKm: toNumber(row.distance_km),
    memo: row.memo ?? undefined,
  };
}

function mapWeightInsert(record: WeightRecord, userId: string): WeightInsert {
  return {
    user_id: userId,
    record_date: record.date,
    weight_kg: record.weightKg,
    measured_fasted: record.measuredFasted,
    muscle_mass_kg: record.muscleMassKg ?? null,
    body_fat_percent: record.bodyFatPercent ?? null,
    memo: record.memo ?? null,
  };
}

function mapWeightUpdate(record: WeightRecord): WeightUpdate {
  return {
    record_date: record.date,
    weight_kg: record.weightKg,
    measured_fasted: record.measuredFasted,
    muscle_mass_kg: record.muscleMassKg ?? null,
    body_fat_percent: record.bodyFatPercent ?? null,
    memo: record.memo ?? null,
  };
}

function mapWorkoutInsert(session: WorkoutSession, userId: string): WorkoutInsert {
  return {
    user_id: userId,
    workout_date: session.date,
    type: session.type,
    condition: session.condition,
    duration_minutes: session.durationMinutes,
    duration_seconds: session.durationSeconds ?? session.durationMinutes * 60,
    distance_km: session.distanceKm ?? null,
    memo: session.memo ?? null,
  };
}

function mapWorkoutUpdate(session: WorkoutSession): WorkoutUpdate {
  return {
    workout_date: session.date,
    type: session.type,
    condition: session.condition,
    duration_minutes: session.durationMinutes,
    duration_seconds: session.durationSeconds ?? session.durationMinutes * 60,
    distance_km: session.distanceKm ?? null,
    memo: session.memo ?? null,
  };
}

export async function fetchWeightRecordsFromDb() {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("weight_records")
    .select(weightColumns)
    .order("record_date", { ascending: false });

  if (error) throw error;
  return (data as WeightRow[]).map(mapWeightRow);
}

export async function createWeightRecordInDb(record: WeightRecord) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("weight_records")
    .insert(mapWeightInsert(record, userId))
    .select(weightColumns)
    .single();

  if (error) throw error;
  return mapWeightRow(data as WeightRow);
}

export async function updateWeightRecordInDb(record: WeightRecord) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("weight_records")
    .update(mapWeightUpdate(record))
    .eq("id", record.id)
    .select(weightColumns)
    .single();

  if (error) throw error;
  return mapWeightRow(data as WeightRow);
}

export async function deleteWeightRecordFromDb(id: string) {
  if (!supabase) return false;
  const { error } = await supabase.from("weight_records").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function fetchWorkoutSessionsFromDb() {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("workout_sessions")
    .select(workoutColumns)
    .order("workout_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as WorkoutRow[]).map(mapWorkoutRow);
}

export async function createWorkoutSessionInDb(session: WorkoutSession) {
  if (!supabase) return null;
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert(mapWorkoutInsert(session, userId))
    .select(workoutColumns)
    .single();

  if (error) throw error;
  return mapWorkoutRow(data as WorkoutRow);
}

export async function updateWorkoutSessionInDb(session: WorkoutSession) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("workout_sessions")
    .update(mapWorkoutUpdate(session))
    .eq("id", session.id)
    .select(workoutColumns)
    .single();

  if (error) throw error;
  return mapWorkoutRow(data as WorkoutRow);
}

export async function deleteWorkoutSessionFromDb(id: string) {
  if (!supabase) return false;
  const { error } = await supabase.from("workout_sessions").delete().eq("id", id);
  if (error) throw error;
  return true;
}
