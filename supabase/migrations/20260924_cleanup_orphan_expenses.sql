delete from public.expense_records expense
where expense.target_type = 'activity'
  and not exists (
    select 1
    from public.life_activities activity
    where activity.id = expense.target_id and activity.user_id = expense.user_id
  );

delete from public.expense_records expense
where expense.target_type = 'todo'
  and not exists (
    select 1
    from public.tasks task
    where task.id = expense.target_id and task.user_id = expense.user_id
  );

delete from public.expense_records expense
where expense.target_type in ('event', 'schedule')
  and not exists (
    select 1
    from public.calendar_events event
    where event.id = expense.target_id and event.user_id = expense.user_id
  );
