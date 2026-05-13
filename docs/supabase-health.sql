-- dailyOS health tables
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.weight_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_date date not null,
  weight_kg numeric(5, 2) not null check (weight_kg > 0),
  measured_fasted boolean not null default true,
  muscle_mass_kg numeric(5, 2),
  body_fat_percent numeric(5, 2),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, record_date)
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_date date not null,
  type text not null check (type in ('running', 'stretching', 'bodyweight', 'weight', 'etc')),
  condition text not null default 'normal' check (condition in ('good', 'normal', 'low')),
  duration_minutes integer not null check (duration_minutes > 0),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_weight_records_updated_at on public.weight_records;
create trigger set_weight_records_updated_at
before update on public.weight_records
for each row
execute function public.set_updated_at();

drop trigger if exists set_workout_sessions_updated_at on public.workout_sessions;
create trigger set_workout_sessions_updated_at
before update on public.workout_sessions
for each row
execute function public.set_updated_at();

alter table public.weight_records enable row level security;
alter table public.workout_sessions enable row level security;

drop policy if exists "weight_records_select_own" on public.weight_records;
drop policy if exists "weight_records_insert_own" on public.weight_records;
drop policy if exists "weight_records_update_own" on public.weight_records;
drop policy if exists "weight_records_delete_own" on public.weight_records;

create policy "weight_records_select_own"
on public.weight_records for select
using ((select auth.uid()) = user_id);

create policy "weight_records_insert_own"
on public.weight_records for insert
with check ((select auth.uid()) = user_id);

create policy "weight_records_update_own"
on public.weight_records for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "weight_records_delete_own"
on public.weight_records for delete
using ((select auth.uid()) = user_id);

drop policy if exists "workout_sessions_select_own" on public.workout_sessions;
drop policy if exists "workout_sessions_insert_own" on public.workout_sessions;
drop policy if exists "workout_sessions_update_own" on public.workout_sessions;
drop policy if exists "workout_sessions_delete_own" on public.workout_sessions;

create policy "workout_sessions_select_own"
on public.workout_sessions for select
using ((select auth.uid()) = user_id);

create policy "workout_sessions_insert_own"
on public.workout_sessions for insert
with check ((select auth.uid()) = user_id);

create policy "workout_sessions_update_own"
on public.workout_sessions for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "workout_sessions_delete_own"
on public.workout_sessions for delete
using ((select auth.uid()) = user_id);

create index if not exists weight_records_user_date_idx
on public.weight_records (user_id, record_date desc);

create index if not exists workout_sessions_user_date_idx
on public.workout_sessions (user_id, workout_date desc);
