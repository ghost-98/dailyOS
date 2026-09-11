alter table public.workout_sessions
  add column if not exists start_time time,
  add column if not exists is_all_day boolean not null default true;
