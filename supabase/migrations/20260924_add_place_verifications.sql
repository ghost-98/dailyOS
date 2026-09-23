create table if not exists public.place_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_key text not null,
  status text not null check (status in ('verified', 'unverified')),
  checked_at timestamptz not null default now(),
  matched_name text,
  matched_address text,
  created_at timestamptz not null default now(),
  unique (user_id, place_key)
);

alter table public.place_verifications enable row level security;

drop policy if exists "Users can read own place verifications" on public.place_verifications;
create policy "Users can read own place verifications"
on public.place_verifications for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own place verifications" on public.place_verifications;
create policy "Users can insert own place verifications"
on public.place_verifications for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own place verifications" on public.place_verifications;
create policy "Users can update own place verifications"
on public.place_verifications for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
