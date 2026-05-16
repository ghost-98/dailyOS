-- dailyOS initial Supabase schema
-- Run this file in Supabase Dashboard > SQL Editor.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'inProgress', 'done')),
  priority text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  scheduled_date date not null,
  due_date date,
  completed_at timestamptz,
  deferred_count integer not null default 0 check (deferred_count >= 0),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  event_time time,
  type text not null default 'schedule' check (type in ('schedule', 'todo', 'event', 'health', 'weight', 'career')),
  title text not null,
  meta text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weight_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_date date not null,
  weight_kg numeric(5, 2) not null check (weight_kg > 0),
  measured_fasted boolean not null default false,
  muscle_mass_kg numeric(5, 2) check (muscle_mass_kg is null or muscle_mass_kg > 0),
  body_fat_percent numeric(5, 2) check (body_fat_percent is null or body_fat_percent >= 0),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_date date not null,
  type text not null check (type in ('running', 'stretching', 'bodyweight', 'weight', 'etc')),
  condition text not null default 'normal' check (condition in ('good', 'normal', 'low')),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.career_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tab text not null check (tab in ('applied', 'planned', 'certificates')),
  title text not null,
  subtitle text not null default '',
  status text not null default '',
  primary_date date,
  deadline_date date,
  exam_date date,
  interview_date date,
  result_date date,
  url text,
  resume_name text,
  required_certs text,
  required_docs text,
  certificate_number text,
  issuer text,
  result_type text check (result_type is null or result_type in ('score', 'passFail', 'grade')),
  result_value text,
  score text,
  grade text,
  priority text check (priority is null or priority in ('high', 'normal', 'low')),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
  );

alter table public.career_records
add column if not exists result_type text
check (result_type is null or result_type in ('score', 'passFail', 'grade'));

alter table public.career_records
add column if not exists result_value text;

create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  career_record_id uuid not null references public.career_records(id) on delete cascade,
  stage text not null check (stage in ('document', 'written', 'interview')),
  event_date date not null,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_date_idx on public.tasks(user_id, scheduled_date);
create index if not exists tasks_user_due_idx on public.tasks(user_id, due_date);
create index if not exists calendar_events_user_date_idx on public.calendar_events(user_id, event_date);
create index if not exists weight_records_user_date_idx on public.weight_records(user_id, record_date desc);
create index if not exists workout_sessions_user_date_idx on public.workout_sessions(user_id, workout_date desc);
create index if not exists career_records_user_tab_idx on public.career_records(user_id, tab);
create index if not exists application_events_record_idx on public.application_events(career_record_id, event_date);

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_calendar_events_updated_at on public.calendar_events;
create trigger set_calendar_events_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

drop trigger if exists set_weight_records_updated_at on public.weight_records;
create trigger set_weight_records_updated_at
before update on public.weight_records
for each row execute function public.set_updated_at();

drop trigger if exists set_workout_sessions_updated_at on public.workout_sessions;
create trigger set_workout_sessions_updated_at
before update on public.workout_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_career_records_updated_at on public.career_records;
create trigger set_career_records_updated_at
before update on public.career_records
for each row execute function public.set_updated_at();

drop trigger if exists set_application_events_updated_at on public.application_events;
create trigger set_application_events_updated_at
before update on public.application_events
for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;
alter table public.calendar_events enable row level security;
alter table public.weight_records enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.career_records enable row level security;
alter table public.application_events enable row level security;

drop policy if exists "Users can read own tasks" on public.tasks;
create policy "Users can read own tasks"
on public.tasks for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own tasks" on public.tasks;
create policy "Users can insert own tasks"
on public.tasks for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own tasks" on public.tasks;
create policy "Users can update own tasks"
on public.tasks for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own tasks" on public.tasks;
create policy "Users can delete own tasks"
on public.tasks for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own calendar events" on public.calendar_events;
create policy "Users can read own calendar events"
on public.calendar_events for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own calendar events" on public.calendar_events;
create policy "Users can insert own calendar events"
on public.calendar_events for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own calendar events" on public.calendar_events;
create policy "Users can update own calendar events"
on public.calendar_events for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own calendar events" on public.calendar_events;
create policy "Users can delete own calendar events"
on public.calendar_events for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own weight records" on public.weight_records;
create policy "Users can read own weight records"
on public.weight_records for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own weight records" on public.weight_records;
create policy "Users can insert own weight records"
on public.weight_records for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own weight records" on public.weight_records;
create policy "Users can update own weight records"
on public.weight_records for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own weight records" on public.weight_records;
create policy "Users can delete own weight records"
on public.weight_records for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own workout sessions" on public.workout_sessions;
create policy "Users can read own workout sessions"
on public.workout_sessions for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own workout sessions" on public.workout_sessions;
create policy "Users can insert own workout sessions"
on public.workout_sessions for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own workout sessions" on public.workout_sessions;
create policy "Users can update own workout sessions"
on public.workout_sessions for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own workout sessions" on public.workout_sessions;
create policy "Users can delete own workout sessions"
on public.workout_sessions for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own career records" on public.career_records;
create policy "Users can read own career records"
on public.career_records for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own career records" on public.career_records;
create policy "Users can insert own career records"
on public.career_records for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own career records" on public.career_records;
create policy "Users can update own career records"
on public.career_records for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own career records" on public.career_records;
create policy "Users can delete own career records"
on public.career_records for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own application events" on public.application_events;
create policy "Users can read own application events"
on public.application_events for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own application events" on public.application_events;
create policy "Users can insert own application events"
on public.application_events for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.career_records
    where career_records.id = application_events.career_record_id
      and career_records.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own application events" on public.application_events;
create policy "Users can update own application events"
on public.application_events for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.career_records
    where career_records.id = application_events.career_record_id
      and career_records.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own application events" on public.application_events;
create policy "Users can delete own application events"
on public.application_events for delete
to authenticated
using (user_id = auth.uid());
