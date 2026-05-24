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
  type text not null default 'schedule' check (type in ('schedule', 'todo', 'event', 'health', 'weight', 'career', 'expense')),
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
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expense_date date not null,
  title text not null,
  amount numeric(12, 0) not null check (amount > 0),
  category text not null default 'etc' check (category in ('food', 'transport', 'shopping', 'housing', 'health', 'culture', 'education', 'etc')),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  target_type text not null check (target_type in ('schedule', 'todo', 'career_event', 'workout', 'expense', 'daily_log')),
  target_id uuid not null,
  target_date date,
  starts_at timestamptz,
  ends_at timestamptz,
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
  expires_never boolean,
  certificate_file_path text,
  certificate_file_name text,
  priority text check (priority is null or priority in ('high', 'normal', 'low')),
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

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  posting_title text not null default '',
  job_role text not null default '',
  status text not null default 'planned' check (
    status in (
      'planned',
      'applied',
      'document_pending',
      'written_pending',
      'interview_pending',
      'result_pending',
      'accepted',
      'rejected',
      'closed'
    )
  ),
  posting_url text,
  source_file_path text,
  source_file_name text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_application_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.job_applications(id) on delete cascade,
  type text not null default 'etc' check (
    type in (
      'application',
      'document',
      'written',
      'coding_test',
      'assignment',
      'interview',
      'medical',
      'result',
      'employment',
      'etc'
    )
  ),
  title text not null,
  start_at timestamptz,
  end_at timestamptz,
  status text not null default 'confirmed' check (status in ('draft', 'confirmed', 'done', 'skipped')),
  order_index integer not null default 0,
  memo text,
  source_text text,
  confirmed_by_user boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_application_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.job_applications(id) on delete cascade,
  category text not null default 'note' check (
    category in (
      'eligibility',
      'document_evaluation',
      'language_score',
      'certificate_bonus',
      'preferred',
      'attachment_required',
      'document',
      'exam',
      'interview',
      'note'
    )
  ),
  title text not null,
  content text not null default '',
  source_text text,
  confirmed_by_user boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_application_check_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.job_applications(id) on delete cascade,
  title text not null,
  category text not null default 'note' check (
    category in (
      'eligibility',
      'document_evaluation',
      'language_score',
      'certificate_bonus',
      'preferred',
      'attachment_required',
      'document',
      'exam',
      'interview',
      'note'
    )
  ),
  due_at timestamptz,
  is_done boolean not null default false,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_application_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.job_applications(id) on delete cascade,
  kind text not null default 'posting' check (kind in ('posting', 'resume', 'proof', 'etc')),
  file_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_extraction_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references public.job_applications(id) on delete cascade,
  source_file_path text,
  source_file_name text,
  extracted_json jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'applied', 'discarded')),
  model_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists tasks_user_scheduled_idx on public.tasks(user_id, scheduled_date);
create index if not exists tasks_user_due_idx on public.tasks(user_id, due_date);
create index if not exists calendar_events_user_date_idx on public.calendar_events(user_id, event_date);
create index if not exists calendar_events_user_type_date_idx on public.calendar_events(user_id, type, event_date);
create index if not exists weight_records_user_date_idx on public.weight_records(user_id, record_date desc);
create index if not exists workout_sessions_user_date_idx on public.workout_sessions(user_id, workout_date desc);
create index if not exists expense_records_user_date_idx on public.expense_records(user_id, expense_date desc);
create index if not exists place_folders_user_sort_idx on public.place_folders(user_id, sort_order, created_at);
create index if not exists places_user_created_idx on public.places(user_id, created_at desc);
create index if not exists places_user_provider_idx on public.places(user_id, provider, provider_place_id);
create index if not exists places_user_folder_idx on public.places(user_id, folder_id, created_at desc);
create index if not exists place_folder_links_user_folder_idx on public.place_folder_links(user_id, folder_id);
create index if not exists place_folder_links_place_idx on public.place_folder_links(place_id);
create index if not exists place_links_user_target_idx on public.place_links(user_id, target_type, target_id);
create index if not exists place_links_place_idx on public.place_links(place_id, target_date);
create index if not exists career_records_user_tab_idx on public.career_records(user_id, tab, created_at desc);
create index if not exists application_events_record_idx on public.application_events(career_record_id, event_date);
create index if not exists job_applications_user_status_idx on public.job_applications(user_id, status, created_at desc);
create index if not exists job_application_steps_application_idx on public.job_application_steps(application_id, order_index, start_at);
create index if not exists job_application_steps_user_start_idx on public.job_application_steps(user_id, start_at);
create index if not exists job_application_requirements_application_idx on public.job_application_requirements(application_id, category);
create index if not exists job_application_check_items_application_idx on public.job_application_check_items(application_id, is_done, due_at);
create index if not exists job_application_files_application_idx on public.job_application_files(application_id, kind);
create index if not exists ai_extraction_drafts_application_idx on public.ai_extraction_drafts(application_id, status, created_at desc);

insert into storage.buckets (id, name, public)
values ('career-files', 'career-files', false)
on conflict (id) do nothing;

drop policy if exists "career_files_select_own" on storage.objects;
drop policy if exists "career_files_insert_own" on storage.objects;
drop policy if exists "career_files_update_own" on storage.objects;
drop policy if exists "career_files_delete_own" on storage.objects;

create policy "career_files_select_own"
on storage.objects for select
using (bucket_id = 'career-files' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy "career_files_insert_own"
on storage.objects for insert
with check (bucket_id = 'career-files' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy "career_files_update_own"
on storage.objects for update
using (bucket_id = 'career-files' and (select auth.uid())::text = (storage.foldername(name))[1])
with check (bucket_id = 'career-files' and (select auth.uid())::text = (storage.foldername(name))[1]);

create policy "career_files_delete_own"
on storage.objects for delete
using (bucket_id = 'career-files' and (select auth.uid())::text = (storage.foldername(name))[1]);

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

drop trigger if exists set_weight_records_updated_at on public.weight_records;
create trigger set_weight_records_updated_at
before update on public.weight_records
for each row execute function public.set_updated_at();

drop trigger if exists set_workout_sessions_updated_at on public.workout_sessions;
create trigger set_workout_sessions_updated_at
before update on public.workout_sessions
for each row execute function public.set_updated_at();

drop trigger if exists set_expense_records_updated_at on public.expense_records;
create trigger set_expense_records_updated_at
before update on public.expense_records
for each row execute function public.set_updated_at();

drop trigger if exists set_places_updated_at on public.places;
create trigger set_places_updated_at
before update on public.places
for each row execute function public.set_updated_at();

drop trigger if exists set_place_folders_updated_at on public.place_folders;
create trigger set_place_folders_updated_at
before update on public.place_folders
for each row execute function public.set_updated_at();

drop trigger if exists set_place_links_updated_at on public.place_links;
create trigger set_place_links_updated_at
before update on public.place_links
for each row execute function public.set_updated_at();

drop trigger if exists set_career_records_updated_at on public.career_records;
create trigger set_career_records_updated_at
before update on public.career_records
for each row execute function public.set_updated_at();

drop trigger if exists set_application_events_updated_at on public.application_events;
create trigger set_application_events_updated_at
before update on public.application_events
for each row execute function public.set_updated_at();

drop trigger if exists set_job_applications_updated_at on public.job_applications;
create trigger set_job_applications_updated_at
before update on public.job_applications
for each row execute function public.set_updated_at();

drop trigger if exists set_job_application_steps_updated_at on public.job_application_steps;
create trigger set_job_application_steps_updated_at
before update on public.job_application_steps
for each row execute function public.set_updated_at();

drop trigger if exists set_job_application_requirements_updated_at on public.job_application_requirements;
create trigger set_job_application_requirements_updated_at
before update on public.job_application_requirements
for each row execute function public.set_updated_at();

drop trigger if exists set_job_application_check_items_updated_at on public.job_application_check_items;
create trigger set_job_application_check_items_updated_at
before update on public.job_application_check_items
for each row execute function public.set_updated_at();

drop trigger if exists set_ai_extraction_drafts_updated_at on public.ai_extraction_drafts;
create trigger set_ai_extraction_drafts_updated_at
before update on public.ai_extraction_drafts
for each row execute function public.set_updated_at();

create or replace function public.delete_own_job_application(p_application_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_source_file_path text;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select source_file_path
    into target_source_file_path
  from public.job_applications
  where id = p_application_id
    and user_id = current_user_id;

  if not found then
    return false;
  end if;

  delete from public.job_application_check_items
  where application_id = p_application_id
    and user_id = current_user_id;

  delete from public.job_application_requirements
  where application_id = p_application_id
    and user_id = current_user_id;

  delete from public.job_application_steps
  where application_id = p_application_id
    and user_id = current_user_id;

  delete from public.ai_extraction_drafts
  where user_id = current_user_id
    and (
      application_id = p_application_id
      or (target_source_file_path is not null and source_file_path = target_source_file_path)
    );

  delete from public.job_application_files
  where user_id = current_user_id
    and (
      application_id = p_application_id
      or (target_source_file_path is not null and file_path = target_source_file_path)
    );

  delete from public.job_applications
  where id = p_application_id
    and user_id = current_user_id;

  return not exists (
    select 1
    from public.job_applications
    where id = p_application_id
      and user_id = current_user_id
  );
end;
$$;

revoke all on function public.delete_own_job_application(uuid) from public;
grant execute on function public.delete_own_job_application(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.calendar_events enable row level security;
alter table public.weight_records enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.expense_records enable row level security;
alter table public.place_folders enable row level security;
alter table public.places enable row level security;
alter table public.place_folder_links enable row level security;
alter table public.place_links enable row level security;
alter table public.career_records enable row level security;
alter table public.application_events enable row level security;
alter table public.job_applications enable row level security;
alter table public.job_application_steps enable row level security;
alter table public.job_application_requirements enable row level security;
alter table public.job_application_check_items enable row level security;
alter table public.job_application_files enable row level security;
alter table public.ai_extraction_drafts enable row level security;

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

drop policy if exists "Users can read own job applications" on public.job_applications;
create policy "Users can read own job applications"
on public.job_applications for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own job applications" on public.job_applications;
create policy "Users can insert own job applications"
on public.job_applications for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can update own job applications" on public.job_applications;
create policy "Users can update own job applications"
on public.job_applications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own job applications" on public.job_applications;
create policy "Users can delete own job applications"
on public.job_applications for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own job application steps" on public.job_application_steps;
create policy "Users can read own job application steps"
on public.job_application_steps for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own job application steps" on public.job_application_steps;
create policy "Users can insert own job application steps"
on public.job_application_steps for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.job_applications
    where job_applications.id = job_application_steps.application_id
      and job_applications.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own job application steps" on public.job_application_steps;
create policy "Users can update own job application steps"
on public.job_application_steps for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.job_applications
    where job_applications.id = job_application_steps.application_id
      and job_applications.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own job application steps" on public.job_application_steps;
create policy "Users can delete own job application steps"
on public.job_application_steps for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own job application requirements" on public.job_application_requirements;
create policy "Users can read own job application requirements"
on public.job_application_requirements for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own job application requirements" on public.job_application_requirements;
create policy "Users can insert own job application requirements"
on public.job_application_requirements for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.job_applications
    where job_applications.id = job_application_requirements.application_id
      and job_applications.user_id = auth.uid()
  )
);

drop policy if exists "Users can update own job application requirements" on public.job_application_requirements;
create policy "Users can update own job application requirements"
on public.job_application_requirements for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.job_applications
    where job_applications.id = job_application_requirements.application_id
      and job_applications.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own job application requirements" on public.job_application_requirements;
create policy "Users can delete own job application requirements"
on public.job_application_requirements for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own job application check items" on public.job_application_check_items;
create policy "Users can read own job application check items"
on public.job_application_check_items for select
to authenticated
using (
  user_id = auth.uid()
  and application_id in (
    select id
    from public.job_applications
    where user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own job application check items" on public.job_application_check_items;
create policy "Users can insert own job application check items"
on public.job_application_check_items for insert
to authenticated
with check (
  user_id = auth.uid()
  and application_id in (
    select id
    from public.job_applications
    where user_id = auth.uid()
  )
);

drop policy if exists "Users can update own job application check items" on public.job_application_check_items;
create policy "Users can update own job application check items"
on public.job_application_check_items for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and application_id in (
    select id
    from public.job_applications
    where user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own job application check items" on public.job_application_check_items;
create policy "Users can delete own job application check items"
on public.job_application_check_items for delete
to authenticated
using (
  user_id = auth.uid()
  and application_id in (
    select id
    from public.job_applications
    where user_id = auth.uid()
  )
);

drop policy if exists "Users can read own job application files" on public.job_application_files;
create policy "Users can read own job application files"
on public.job_application_files for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own job application files" on public.job_application_files;
create policy "Users can insert own job application files"
on public.job_application_files for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    application_id is null
    or exists (
      select 1
      from public.job_applications
      where job_applications.id = job_application_files.application_id
        and job_applications.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can update own job application files" on public.job_application_files;
create policy "Users can update own job application files"
on public.job_application_files for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    application_id is null
    or exists (
      select 1
      from public.job_applications
      where job_applications.id = job_application_files.application_id
        and job_applications.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can delete own job application files" on public.job_application_files;
create policy "Users can delete own job application files"
on public.job_application_files for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can read own ai extraction drafts" on public.ai_extraction_drafts;
create policy "Users can read own ai extraction drafts"
on public.ai_extraction_drafts for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can insert own ai extraction drafts" on public.ai_extraction_drafts;
create policy "Users can insert own ai extraction drafts"
on public.ai_extraction_drafts for insert
to authenticated
with check (
  user_id = auth.uid()
  and (
    application_id is null
    or exists (
      select 1
      from public.job_applications
      where job_applications.id = ai_extraction_drafts.application_id
        and job_applications.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can update own ai extraction drafts" on public.ai_extraction_drafts;
create policy "Users can update own ai extraction drafts"
on public.ai_extraction_drafts for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (
    application_id is null
    or exists (
      select 1
      from public.job_applications
      where job_applications.id = ai_extraction_drafts.application_id
        and job_applications.user_id = auth.uid()
    )
  )
);

drop policy if exists "Users can delete own ai extraction drafts" on public.ai_extraction_drafts;
create policy "Users can delete own ai extraction drafts"
on public.ai_extraction_drafts for delete
to authenticated
using (user_id = auth.uid());
