-- dailyOS career tables
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.career_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tab text not null check (tab in ('applied', 'planned', 'certificates')),
  title text not null,
  subtitle text not null default '',
  status text not null default '',
  primary_date text,
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
  score text,
  grade text,
  priority text check (priority in ('high', 'normal', 'low')),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_career_records_updated_at on public.career_records;
create trigger set_career_records_updated_at
before update on public.career_records
for each row
execute function public.set_updated_at();

drop trigger if exists set_application_events_updated_at on public.application_events;
create trigger set_application_events_updated_at
before update on public.application_events
for each row
execute function public.set_updated_at();

alter table public.career_records enable row level security;
alter table public.application_events enable row level security;

drop policy if exists "career_records_select_own" on public.career_records;
drop policy if exists "career_records_insert_own" on public.career_records;
drop policy if exists "career_records_update_own" on public.career_records;
drop policy if exists "career_records_delete_own" on public.career_records;

create policy "career_records_select_own"
on public.career_records for select
using ((select auth.uid()) = user_id);

create policy "career_records_insert_own"
on public.career_records for insert
with check ((select auth.uid()) = user_id);

create policy "career_records_update_own"
on public.career_records for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "career_records_delete_own"
on public.career_records for delete
using ((select auth.uid()) = user_id);

drop policy if exists "application_events_select_own" on public.application_events;
drop policy if exists "application_events_insert_own" on public.application_events;
drop policy if exists "application_events_update_own" on public.application_events;
drop policy if exists "application_events_delete_own" on public.application_events;

create policy "application_events_select_own"
on public.application_events for select
using ((select auth.uid()) = user_id);

create policy "application_events_insert_own"
on public.application_events for insert
with check ((select auth.uid()) = user_id);

create policy "application_events_update_own"
on public.application_events for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "application_events_delete_own"
on public.application_events for delete
using ((select auth.uid()) = user_id);

create index if not exists career_records_user_tab_idx
on public.career_records (user_id, tab, created_at desc);

create index if not exists application_events_record_idx
on public.application_events (career_record_id, event_date);
