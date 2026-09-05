-- One-time compatibility backfill for databases created before expense_records.
-- Safe to rerun: each insert skips an existing user/target pair.

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
