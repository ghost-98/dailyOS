-- dailyOS calendar events table
-- Supabase SQL Editor에서 실행하세요.

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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_calendar_events_updated_at on public.calendar_events;

create trigger set_calendar_events_updated_at
before update on public.calendar_events
for each row
execute function public.set_updated_at();

alter table public.calendar_events enable row level security;

drop policy if exists "calendar_events_select_own" on public.calendar_events;
drop policy if exists "calendar_events_insert_own" on public.calendar_events;
drop policy if exists "calendar_events_update_own" on public.calendar_events;
drop policy if exists "calendar_events_delete_own" on public.calendar_events;

create policy "calendar_events_select_own"
on public.calendar_events
for select
using ((select auth.uid()) = user_id);

create policy "calendar_events_insert_own"
on public.calendar_events
for insert
with check ((select auth.uid()) = user_id);

create policy "calendar_events_update_own"
on public.calendar_events
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "calendar_events_delete_own"
on public.calendar_events
for delete
using ((select auth.uid()) = user_id);

create index if not exists calendar_events_user_date_idx
on public.calendar_events (user_id, event_date);

create index if not exists calendar_events_user_type_date_idx
on public.calendar_events (user_id, type, event_date);
