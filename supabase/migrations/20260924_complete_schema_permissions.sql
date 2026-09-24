drop policy if exists "Users can delete own profile" on public.profiles;
create policy "Users can delete own profile"
on public.profiles for delete
to authenticated
using (user_id = auth.uid());

create index if not exists place_verifications_user_status_idx
on public.place_verifications(user_id, status, checked_at desc);
