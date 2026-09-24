alter table public.saved_places
  add column if not exists provider_name text;

update public.saved_places
set provider_name = name
where provider_name is null and provider_place_id is not null;

alter table public.tasks
  add column if not exists place_provider_name text;

alter table public.calendar_events
  add column if not exists place_provider_name text;

alter table public.life_activities
  add column if not exists place_latitude numeric(10, 7),
  add column if not exists place_longitude numeric(10, 7),
  add column if not exists place_provider_name text,
  add column if not exists place_provider_id text,
  add column if not exists start_place_latitude numeric(10, 7),
  add column if not exists start_place_longitude numeric(10, 7),
  add column if not exists start_place_provider_name text,
  add column if not exists start_place_provider_id text,
  add column if not exists end_place_latitude numeric(10, 7),
  add column if not exists end_place_longitude numeric(10, 7),
  add column if not exists end_place_provider_name text,
  add column if not exists end_place_provider_id text;

drop policy if exists "Users can delete own place verifications" on public.place_verifications;
create policy "Users can delete own place verifications"
on public.place_verifications for delete
using (auth.uid() = user_id);

create index if not exists place_verifications_user_status_idx
on public.place_verifications(user_id, status, checked_at desc);
