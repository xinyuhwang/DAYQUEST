-- Evening reflection and carry-over (DESIGN.md §3 step 8, §4).
--
-- A reflection earns the +10 bonus, so it's part of the game economy
-- (principle 4): the server checks the time window and writes it. Users can
-- read their reflections but not write them directly.
revoke insert, update, delete on public.reflections from authenticated;

-- A carried mission is copied to the next day; the original stays on its day
-- as `carried_over` (hidden from the list, kept for history and analytics).
alter table public.tasks add column carried_from uuid;
alter table public.tasks
  add constraint tasks_carried_from_fkey
  foreign key (carried_from, user_id) references public.tasks (id, user_id) on delete set null (carried_from);
create index tasks_carried_from_idx on public.tasks (carried_from);

-- Records the reflection and carries the chosen missions in one transaction,
-- so a double submit can't carry anything twice (the reflection's unique
-- (user_id, day) key fails first and rolls everything back).
--
-- Only server code (service role) may call this. It has already checked the
-- time window and that p_to is the day after p_day.
create function public.wrap_up_day(
  p_user uuid,
  p_day date,
  p_to date,
  p_notes text,
  p_carry uuid[]
)
returns public.reflections
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reflection public.reflections;
  v_task public.tasks;
  v_next integer;
  v_carried uuid[] := '{}';
begin
  select coalesce(max(t.sort_order), -1) + 1 into v_next
  from public.tasks t
  where t.user_id = p_user and t.planned_date = p_to;

  -- Only that day's unfinished top-level missions can be carried. Anything
  -- else in p_carry (another user's task, a finished one) is ignored.
  for v_task in
    select * from public.tasks t
    where t.user_id = p_user
      and t.id = any (coalesce(p_carry, '{}'))
      and t.planned_date = p_day
      and t.parent_id is null
      and t.status not in ('done', 'carried_over', 'dropped')
    order by t.sort_order, t.created_at
    for update
  loop
    insert into public.tasks
      (user_id, title, category, importance, difficulty, est_minutes, planned_date, sort_order, quest_id, carried_from)
    values
      (p_user, v_task.title, v_task.category, v_task.importance, v_task.difficulty, v_task.est_minutes,
       p_to, v_next, v_task.quest_id, v_task.id);
    update public.tasks set status = 'carried_over' where id = v_task.id;
    v_next := v_next + 1;
    v_carried := v_carried || v_task.id;
  end loop;

  insert into public.reflections (user_id, day, notes, carried_task_ids)
  values (p_user, p_day, nullif(btrim(p_notes), ''), v_carried)
  returning * into v_reflection;
  return v_reflection;
end;
$$;

revoke all on function public.wrap_up_day(uuid, date, date, text, uuid[]) from public, anon, authenticated;
grant execute on function public.wrap_up_day(uuid, date, date, text, uuid[]) to service_role;
