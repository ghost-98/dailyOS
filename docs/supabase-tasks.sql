-- dailyOS tasks table
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'inProgress', 'done')),
  priority text not null default 'normal' check (priority in ('high', 'normal', 'low')),
  scheduled_date date not null,
  due_date date,
  memo text,
  deferred_count integer not null default 0 check (deferred_count >= 0),
  completed_at timestamptz,
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

drop trigger if exists set_tasks_updated_at on public.tasks;

create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

alter table public.tasks enable row level security;

drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;

create policy "tasks_select_own"
on public.tasks
for select
using ((select auth.uid()) = user_id);

create policy "tasks_insert_own"
on public.tasks
for insert
with check ((select auth.uid()) = user_id);

create policy "tasks_update_own"
on public.tasks
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "tasks_delete_own"
on public.tasks
for delete
using ((select auth.uid()) = user_id);

create index if not exists tasks_user_scheduled_idx
on public.tasks (user_id, scheduled_date);

create index if not exists tasks_user_due_idx
on public.tasks (user_id, due_date);
