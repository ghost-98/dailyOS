-- dailyOS latest Supabase schema
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

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  gender text not null default 'prefer_not_to_say' check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, full_name, gender, birth_date)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'gender', ''), 'prefer_not_to_say'),
    nullif(new.raw_user_meta_data ->> 'birth_date', '')::date
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    gender = excluded.gender,
    birth_date = excluded.birth_date,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'inProgress', 'done')),
  priority text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  scheduled_date date not null,
  due_date date,
  start_time time,
  end_time time,
  is_all_day boolean not null default true,
  completed_at timestamptz,
  deferred_count integer not null default 0 check (deferred_count >= 0),
  memo text,
  expense_amount numeric(12, 0) check (expense_amount is null or expense_amount >= 0),
  companions text,
  place_name text,
  place_address text,
  place_latitude numeric(10, 7),
  place_longitude numeric(10, 7),
  place_provider_id text,
  place_phone text,
  place_category text,
  place_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  end_date date,
  event_time time,
  end_time time,
  is_all_day boolean not null default true,
  type text not null default 'schedule' check (type in ('schedule', 'todo', 'event', 'health', 'weight', 'expense')),
  title text not null,
  meta text not null default '',
  expense_amount numeric(12, 0) check (expense_amount is null or expense_amount >= 0),
  companions text,
  place_name text,
  place_address text,
  place_latitude numeric(10, 7),
  place_longitude numeric(10, 7),
  place_provider_id text,
  place_phone text,
  place_category text,
  place_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists is_all_day boolean not null default true,
  add column if not exists expense_amount numeric(12, 0) check (expense_amount is null or expense_amount >= 0),
  add column if not exists companions text,
  add column if not exists place_name text,
  add column if not exists place_address text,
  add column if not exists place_latitude numeric(10, 7),
  add column if not exists place_longitude numeric(10, 7),
  add column if not exists place_provider_id text,
  add column if not exists place_phone text,
  add column if not exists place_category text,
  add column if not exists place_url text;

alter table public.calendar_events
  add column if not exists end_date date,
  add column if not exists end_time time,
  add column if not exists is_all_day boolean not null default true,
  add column if not exists expense_amount numeric(12, 0) check (expense_amount is null or expense_amount >= 0),
  add column if not exists companions text,
  add column if not exists place_name text,
  add column if not exists place_address text,
  add column if not exists place_latitude numeric(10, 7),
  add column if not exists place_longitude numeric(10, 7),
  add column if not exists place_provider_id text,
  add column if not exists place_phone text,
  add column if not exists place_category text,
  add column if not exists place_url text;

create table if not exists public.weight_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_date date not null,
  weight_kg numeric(5, 2) not null check (weight_kg > 0),
  measured_fasted boolean not null default true,
  muscle_mass_kg numeric(5, 2) check (muscle_mass_kg is null or muscle_mass_kg > 0),
  body_fat_percent numeric(5, 2) check (body_fat_percent is null or body_fat_percent >= 0),
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
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  distance_km numeric(7, 2) check (distance_km is null or distance_km > 0),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workout_sessions
  add column if not exists distance_km numeric(7, 2) check (distance_km is null or distance_km > 0),
  add column if not exists duration_seconds integer check (duration_seconds is null or duration_seconds > 0);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  content text not null,
  linked_target_type text check (linked_target_type is null or linked_target_type in ('schedule', 'todo', 'event', 'activity')),
  linked_target_id uuid,
  linked_target_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.life_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  start_time time,
  end_time time,
  is_all_day boolean not null default false,
  title text not null,
  memo text,
  category text,
  food text,
  expense_amount numeric(12, 0) check (expense_amount is null or expense_amount >= 0),
  companions text,
  place_name text,
  place_address text,
  start_place_name text,
  start_place_address text,
  end_place_name text,
  end_place_address text,
  transport_mode text,
  source_type text check (source_type is null or source_type in ('schedule', 'todo', 'event')),
  source_id text,
  source_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.life_activities
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists is_all_day boolean not null default false,
  add column if not exists memo text,
  add column if not exists category text,
  add column if not exists food text,
  add column if not exists expense_amount numeric(12, 0) check (expense_amount is null or expense_amount >= 0),
  add column if not exists companions text,
  add column if not exists place_name text,
  add column if not exists place_address text,
  add column if not exists start_place_name text,
  add column if not exists start_place_address text,
  add column if not exists end_place_name text,
  add column if not exists end_place_address text,
  add column if not exists transport_mode text,
  add column if not exists source_type text check (source_type is null or source_type in ('schedule', 'todo', 'event')),
  add column if not exists source_id text,
  add column if not exists source_title text;

alter table public.daily_logs
  add column if not exists linked_target_type text check (linked_target_type is null or linked_target_type in ('schedule', 'todo', 'event', 'activity')),
  add column if not exists linked_target_id uuid,
  add column if not exists linked_target_title text;

create table if not exists public.life_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_date date not null,
  file_name text not null,
  file_path text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds numeric(10, 3) check (duration_seconds is null or duration_seconds >= 0),
  caption text,
  linked_target_type text check (linked_target_type is null or linked_target_type in ('schedule', 'todo', 'event', 'activity')),
  linked_target_id uuid,
  linked_target_title text,
  taken_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, file_path)
);

alter table public.life_photos
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  add column if not exists width integer check (width is null or width > 0),
  add column if not exists height integer check (height is null or height > 0),
  add column if not exists duration_seconds numeric(10, 3) check (duration_seconds is null or duration_seconds >= 0),
  add column if not exists caption text,
  add column if not exists linked_target_type text check (linked_target_type is null or linked_target_type in ('schedule', 'todo', 'event', 'activity')),
  add column if not exists linked_target_id uuid,
  add column if not exists linked_target_title text,
  add column if not exists taken_at timestamptz;

create table if not exists public.expense_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_date date not null,
  title text not null,
  amount numeric(12, 0) not null check (amount > 0),
  category text not null default 'etc' check (category in ('food', 'transport', 'shopping', 'housing', 'health', 'culture', 'education', 'etc')),
  memo text,
  target_type text not null check (target_type in ('schedule', 'todo', 'event', 'activity')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.income_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  income_date date not null,
  title text not null,
  amount numeric(12, 0) not null check (amount > 0),
  category text not null default 'etc' check (category in ('salary', 'business', 'investment', 'gift', 'refund', 'side', 'etc')),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.expense_records
  add column if not exists target_type text check (target_type in ('schedule', 'todo', 'event', 'activity')),
  add column if not exists target_id uuid;

alter table public.daily_logs drop constraint if exists daily_logs_linked_target_type_check;
alter table public.daily_logs
  add constraint daily_logs_linked_target_type_check check (linked_target_type is null or linked_target_type in ('schedule', 'todo', 'event', 'activity'));

alter table public.life_photos drop constraint if exists life_photos_linked_target_type_check;
alter table public.life_photos
  add constraint life_photos_linked_target_type_check check (linked_target_type is null or linked_target_type in ('schedule', 'todo', 'event', 'activity'));

alter table public.expense_records drop constraint if exists expense_records_target_type_check;
alter table public.expense_records
  add constraint expense_records_target_type_check check (target_type in ('schedule', 'todo', 'event', 'activity'));

delete from public.expense_records
where target_type is null
   or target_id is null;

alter table public.expense_records
  alter column target_type set not null,
  alter column target_id set not null;

create table if not exists public.place_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#9db2ff',
  icon text not null default 'dot',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references public.place_folders(id) on delete set null,
  name text not null,
  address text not null default '',
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  provider text not null default 'manual' check (provider in ('naver', 'manual')),
  provider_place_id text,
  phone text,
  category text,
  url text,
  is_favorite boolean not null default false,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  mapped_name text,
  address text not null,
  latitude numeric(10, 7) not null,
  longitude numeric(10, 7) not null,
  provider_place_id text,
  phone text,
  category text,
  url text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, label)
);

create table if not exists public.place_folder_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  folder_id uuid not null references public.place_folders(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, place_id, folder_id)
);

create table if not exists public.place_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  target_type text not null check (target_type in ('schedule', 'todo', 'workout', 'expense', 'daily_log')),
  target_id uuid not null,
  target_date date,
  starts_at timestamptz,
  ends_at timestamptz,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.people_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid references public.people(id) on delete cascade,
  person_name text not null,
  target_type text not null check (target_type in ('schedule', 'todo', 'event', 'daily_log', 'photo', 'expense', 'workout')),
  target_id uuid not null,
  target_date date,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, person_name, target_type, target_id)
);

create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists tasks_user_scheduled_idx on public.tasks(user_id, scheduled_date);
create index if not exists tasks_user_due_idx on public.tasks(user_id, due_date);
create index if not exists calendar_events_user_date_idx on public.calendar_events(user_id, event_date);
create index if not exists calendar_events_user_type_date_idx on public.calendar_events(user_id, type, event_date);
create index if not exists life_activities_user_date_idx on public.life_activities(user_id, activity_date, start_time, created_at desc);
create index if not exists life_activities_user_source_idx on public.life_activities(user_id, source_type, source_id);
create index if not exists weight_records_user_date_idx on public.weight_records(user_id, record_date desc);
create index if not exists workout_sessions_user_date_idx on public.workout_sessions(user_id, workout_date desc);
create index if not exists expense_records_user_date_idx on public.expense_records(user_id, expense_date desc);
create index if not exists income_records_user_date_idx on public.income_records(user_id, income_date desc);
create index if not exists people_user_name_idx on public.people(user_id, name);
create index if not exists people_links_user_person_idx on public.people_links(user_id, person_name);
create unique index if not exists expense_records_user_target_unique_idx on public.expense_records(user_id, target_type, target_id) where target_type is not null and target_id is not null;
create index if not exists personal_places_user_label_idx on public.personal_places(user_id, label);

create or replace view public.life_people_index
with (security_invoker = true)
as
select
  user_id,
  trim(person_name) as person_name,
  'schedule' as source_type,
  id as source_id,
  event_date as source_date,
  title,
  place_name
from public.calendar_events
cross join lateral regexp_split_to_table(coalesce(companions, ''), '\s*[,，、·]\s*') as person_name
where type = 'schedule'
  and trim(person_name) <> ''
union all
select
  user_id,
  trim(person_name) as person_name,
  'event' as source_type,
  id as source_id,
  event_date as source_date,
  title,
  place_name
from public.calendar_events
cross join lateral regexp_split_to_table(coalesce(companions, ''), '\s*[,，、·]\s*') as person_name
where type = 'event'
  and trim(person_name) <> ''
union all
select
  user_id,
  trim(person_name) as person_name,
  'todo' as source_type,
  id as source_id,
  scheduled_date as source_date,
  title,
  place_name
from public.tasks
cross join lateral regexp_split_to_table(coalesce(companions, ''), '\s*[,，、·]\s*') as person_name
where trim(person_name) <> ''
union all
select
  user_id,
  trim(person_name) as person_name,
  'activity' as source_type,
  id as source_id,
  activity_date as source_date,
  title,
  place_name
from public.life_activities
cross join lateral regexp_split_to_table(coalesce(companions, ''), '\s*[,???]\s*') as person_name
where trim(person_name) <> ''
union all
select
  user_id,
  person_name,
  target_type as source_type,
  target_id as source_id,
  target_date as source_date,
  coalesce(memo, person_name) as title,
  null as place_name
from public.people_links;

create or replace view public.life_record_index
with (security_invoker = true)
as
select
  user_id,
  event_date as record_date,
  type::text as source_type,
  id as source_id,
  case when type = 'event' then 'event' else 'schedule' end as target_type,
  id as target_id,
  title,
  nullif(meta, '') as summary,
  expense_amount as amount,
  place_name,
  created_at
from public.calendar_events
where type in ('schedule', 'event')
union all
select
  user_id,
  scheduled_date as record_date,
  'todo' as source_type,
  id as source_id,
  'todo' as target_type,
  id as target_id,
  title,
  memo as summary,
  expense_amount as amount,
  place_name,
  created_at
from public.tasks
union all
select
  user_id,
  activity_date as record_date,
  'activity' as source_type,
  id as source_id,
  'activity' as target_type,
  id as target_id,
  title,
  concat_ws(' ? ', nullif(category, ''), nullif(food, ''), nullif(memo, '')) as summary,
  expense_amount as amount,
  place_name,
  created_at
from public.life_activities
union all
select
  user_id,
  expense_date as record_date,
  'expense' as source_type,
  id as source_id,
  target_type,
  target_id,
  title,
  memo as summary,
  amount,
  null as place_name,
  created_at
from public.expense_records
union all
select
  user_id,
  log_date as record_date,
  'daily_log' as source_type,
  id as source_id,
  linked_target_type as target_type,
  linked_target_id as target_id,
  '하루 기록' as title,
  content as summary,
  null as amount,
  null as place_name,
  created_at
from public.daily_logs
union all
select
  user_id,
  photo_date as record_date,
  'photo' as source_type,
  id as source_id,
  linked_target_type as target_type,
  linked_target_id as target_id,
  coalesce(caption, file_name) as title,
  file_name as summary,
  null as amount,
  null as place_name,
  created_at
from public.life_photos
union all
select
  user_id,
  workout_date as record_date,
  'workout' as source_type,
  id as source_id,
  null as target_type,
  null as target_id,
  case when type = 'running' then '러닝 기록' else '운동 기록' end as title,
  concat_ws(' · ', case when distance_km is not null then distance_km::text || 'km' end, coalesce(duration_seconds, duration_minutes * 60)::text || '초') as summary,
  null as amount,
  null as place_name,
  created_at
from public.workout_sessions
union all
select
  user_id,
  record_date,
  'weight' as source_type,
  id as source_id,
  null as target_type,
  null as target_id,
  '아침 몸무게' as title,
  weight_kg::text || 'kg' as summary,
  null as amount,
  null as place_name,
  created_at
from public.weight_records;

insert into public.expense_records (user_id, expense_date, title, amount, category, memo, target_type, target_id)
select
  user_id,
  event_date,
  title,
  expense_amount,
  'etc',
  nullif(meta, ''),
  case when type = 'event' then 'event' else 'schedule' end,
  id
from public.calendar_events
where expense_amount is not null
  and expense_amount > 0
  and type in ('schedule', 'event')
  and not exists (
    select 1
    from public.expense_records
    where expense_records.user_id = calendar_events.user_id
      and expense_records.target_type = case when calendar_events.type = 'event' then 'event' else 'schedule' end
      and expense_records.target_id = calendar_events.id
  );

insert into public.expense_records (user_id, expense_date, title, amount, category, memo, target_type, target_id)
select
  user_id,
  scheduled_date,
  title,
  expense_amount,
  'etc',
  memo,
  'todo',
  id
from public.tasks
where expense_amount is not null
  and expense_amount > 0
  and not exists (
    select 1
    from public.expense_records
    where expense_records.user_id = tasks.user_id
      and expense_records.target_type = 'todo'
      and expense_records.target_id = tasks.id
  );
create index if not exists place_folders_user_sort_idx on public.place_folders(user_id, sort_order, created_at);
create index if not exists places_user_created_idx on public.places(user_id, created_at desc);
create index if not exists places_user_provider_idx on public.places(user_id, provider, provider_place_id);
create index if not exists places_user_folder_idx on public.places(user_id, folder_id, created_at desc);
create index if not exists place_folder_links_user_folder_idx on public.place_folder_links(user_id, folder_id);
create index if not exists place_folder_links_place_idx on public.place_folder_links(place_id);
create index if not exists place_links_user_target_idx on public.place_links(user_id, target_type, target_id);
create index if not exists place_links_place_idx on public.place_links(place_id, target_date);
create index if not exists daily_logs_user_date_idx on public.daily_logs(user_id, log_date, created_at desc);
create index if not exists life_photos_user_date_idx on public.life_photos(user_id, photo_date, created_at desc);

insert into storage.buckets (id, name, public)
values ('life-media', 'life-media', false)
on conflict (id) do nothing;

drop policy if exists "life_media_select_own" on storage.objects;
drop policy if exists "life_media_insert_own" on storage.objects;
drop policy if exists "life_media_update_own" on storage.objects;
drop policy if exists "life_media_delete_own" on storage.objects;

create policy "life_media_select_own"
on storage.objects for select
using (bucket_id = 'life-media' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy "life_media_insert_own"
on storage.objects for insert
with check (bucket_id = 'life-media' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy "life_media_update_own"
on storage.objects for update
using (bucket_id = 'life-media' and (select auth.uid())::text = (storage.foldername(name))[1])
with check (bucket_id = 'life-media' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy "life_media_delete_own"
on storage.objects for delete
using (bucket_id = 'life-media' and (select auth.uid())::text = (storage.foldername(name))[1]);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists set_calendar_events_updated_at on public.calendar_events;
create trigger set_calendar_events_updated_at
before update on public.calendar_events
for each row execute function public.set_updated_at();

drop trigger if exists set_life_activities_updated_at on public.life_activities;
create trigger set_life_activities_updated_at
before update on public.life_activities
for each row execute function public.set_updated_at();

drop trigger if exists set_weight_records_updated_at on public.weight_records;
create trigger set_weight_records_updated_at
before update on public.weight_records
for each row execute function public.set_updated_at();

drop trigger if exists set_workout_sessions_updated_at on public.workout_sessions;
create trigger set_workout_sessions_updated_at
before update on public.workout_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_logs_updated_at on public.daily_logs;
create trigger set_daily_logs_updated_at
before update on public.daily_logs
for each row execute function public.set_updated_at();

drop trigger if exists set_life_photos_updated_at on public.life_photos;
create trigger set_life_photos_updated_at
before update on public.life_photos
for each row execute function public.set_updated_at();

drop trigger if exists set_expense_records_updated_at on public.expense_records;
create trigger set_expense_records_updated_at
before update on public.expense_records
for each row execute function public.set_updated_at();

drop trigger if exists set_income_records_updated_at on public.income_records;
create trigger set_income_records_updated_at
before update on public.income_records
for each row execute function public.set_updated_at();

drop trigger if exists set_places_updated_at on public.places;
create trigger set_places_updated_at
before update on public.places
for each row execute function public.set_updated_at();

drop trigger if exists set_personal_places_updated_at on public.personal_places;
create trigger set_personal_places_updated_at
before update on public.personal_places
for each row execute function public.set_updated_at();

drop trigger if exists set_place_folders_updated_at on public.place_folders;
create trigger set_place_folders_updated_at
before update on public.place_folders
for each row execute function public.set_updated_at();

drop trigger if exists set_place_links_updated_at on public.place_links;
create trigger set_place_links_updated_at
before update on public.place_links
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.calendar_events enable row level security;
alter table public.life_activities enable row level security;
alter table public.weight_records enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.daily_logs enable row level security;
alter table public.life_photos enable row level security;
alter table public.expense_records enable row level security;
alter table public.income_records enable row level security;
alter table public.place_folders enable row level security;
alter table public.places enable row level security;
alter table public.personal_places enable row level security;
alter table public.place_folder_links enable row level security;
alter table public.place_links enable row level security;
alter table public.people enable row level security;
alter table public.people_links enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

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

drop policy if exists "Users can read own life activities" on public.life_activities;
create policy "Users can read own life activities"
on public.life_activities for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own life activities" on public.life_activities;
create policy "Users can insert own life activities"
on public.life_activities for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own life activities" on public.life_activities;
create policy "Users can update own life activities"
on public.life_activities for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own life activities" on public.life_activities;
create policy "Users can delete own life activities"
on public.life_activities for delete
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

drop policy if exists "Users can read own daily logs" on public.daily_logs;
create policy "Users can read own daily logs"
on public.daily_logs for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own daily logs" on public.daily_logs;
create policy "Users can insert own daily logs"
on public.daily_logs for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own daily logs" on public.daily_logs;
create policy "Users can update own daily logs"
on public.daily_logs for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own daily logs" on public.daily_logs;
create policy "Users can delete own daily logs"
on public.daily_logs for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own life photos" on public.life_photos;
create policy "Users can read own life photos"
on public.life_photos for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own life photos" on public.life_photos;
create policy "Users can insert own life photos"
on public.life_photos for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own life photos" on public.life_photos;
create policy "Users can update own life photos"
on public.life_photos for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own life photos" on public.life_photos;
create policy "Users can delete own life photos"
on public.life_photos for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own expense records" on public.expense_records;
create policy "Users can read own expense records"
on public.expense_records for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own expense records" on public.expense_records;
create policy "Users can insert own expense records"
on public.expense_records for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own expense records" on public.expense_records;
create policy "Users can update own expense records"
on public.expense_records for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own expense records" on public.expense_records;
create policy "Users can delete own expense records"
on public.expense_records for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own income records" on public.income_records;
create policy "Users can read own income records"
on public.income_records for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own income records" on public.income_records;
create policy "Users can insert own income records"
on public.income_records for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own income records" on public.income_records;
create policy "Users can update own income records"
on public.income_records for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own income records" on public.income_records;
create policy "Users can delete own income records"
on public.income_records for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own place folders" on public.place_folders;
create policy "Users can read own place folders"
on public.place_folders for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own place folders" on public.place_folders;
create policy "Users can insert own place folders"
on public.place_folders for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own place folders" on public.place_folders;
create policy "Users can update own place folders"
on public.place_folders for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own place folders" on public.place_folders;
create policy "Users can delete own place folders"
on public.place_folders for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own places" on public.places;
create policy "Users can read own places"
on public.places for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own places" on public.places;
create policy "Users can insert own places"
on public.places for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    folder_id is null
    or exists (
      select 1
      from public.place_folders
      where place_folders.id = places.folder_id
        and place_folders.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can update own places" on public.places;
create policy "Users can update own places"
on public.places for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    folder_id is null
    or exists (
      select 1
      from public.place_folders
      where place_folders.id = places.folder_id
        and place_folders.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can delete own places" on public.places;
create policy "Users can delete own places"
on public.places for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own personal places" on public.personal_places;
create policy "Users can read own personal places"
on public.personal_places for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own personal places" on public.personal_places;
create policy "Users can insert own personal places"
on public.personal_places for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own personal places" on public.personal_places;
create policy "Users can update own personal places"
on public.personal_places for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own personal places" on public.personal_places;
create policy "Users can delete own personal places"
on public.personal_places for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own place folder links" on public.place_folder_links;
create policy "Users can read own place folder links"
on public.place_folder_links for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own place folder links" on public.place_folder_links;
create policy "Users can insert own place folder links"
on public.place_folder_links for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.places
    where places.id = place_folder_links.place_id
      and places.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.place_folders
    where place_folders.id = place_folder_links.folder_id
      and place_folders.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own place folder links" on public.place_folder_links;
create policy "Users can delete own place folder links"
on public.place_folder_links for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own place links" on public.place_links;
create policy "Users can read own place links"
on public.place_links for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own place links" on public.place_links;
create policy "Users can insert own place links"
on public.place_links for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.places
    where places.id = place_links.place_id
      and places.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own place links" on public.place_links;
create policy "Users can update own place links"
on public.place_links for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.places
    where places.id = place_links.place_id
      and places.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own place links" on public.place_links;
create policy "Users can delete own place links"
on public.place_links for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own people" on public.people;
create policy "Users can read own people"
on public.people for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own people" on public.people;
create policy "Users can insert own people"
on public.people for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own people" on public.people;
create policy "Users can update own people"
on public.people for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own people" on public.people;
create policy "Users can delete own people"
on public.people for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own people links" on public.people_links;
create policy "Users can read own people links"
on public.people_links for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own people links" on public.people_links;
create policy "Users can insert own people links"
on public.people_links for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    person_id is null
    or exists (
      select 1
      from public.people
      where people.id = people_links.person_id
        and people.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can update own people links" on public.people_links;
create policy "Users can update own people links"
on public.people_links for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    person_id is null
    or exists (
      select 1
      from public.people
      where people.id = people_links.person_id
        and people.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can delete own people links" on public.people_links;
create policy "Users can delete own people links"
on public.people_links for delete
to authenticated
using (user_id = auth.uid());

notify pgrst, 'reload schema';
