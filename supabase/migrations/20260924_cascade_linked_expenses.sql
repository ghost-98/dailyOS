create or replace function public.delete_linked_expenses_for_record()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'tasks' then
    delete from public.expense_records
    where user_id = old.user_id and target_type = 'todo' and target_id = old.id;
  elsif tg_table_name = 'calendar_events' then
    delete from public.expense_records
    where user_id = old.user_id and target_type in ('event', 'schedule') and target_id = old.id;
  elsif tg_table_name = 'life_activities' then
    delete from public.expense_records
    where user_id = old.user_id and target_type = 'activity' and target_id = old.id;
  end if;

  return old;
end;
$$;

drop trigger if exists delete_task_linked_expenses on public.tasks;
create trigger delete_task_linked_expenses
after delete on public.tasks
for each row execute function public.delete_linked_expenses_for_record();

drop trigger if exists delete_event_linked_expenses on public.calendar_events;
create trigger delete_event_linked_expenses
after delete on public.calendar_events
for each row execute function public.delete_linked_expenses_for_record();

drop trigger if exists delete_activity_linked_expenses on public.life_activities;
create trigger delete_activity_linked_expenses
after delete on public.life_activities
for each row execute function public.delete_linked_expenses_for_record();
