-- Carrying missions to another day, shared by the evening wrap-up and by
-- "Move to tomorrow" on today's unfinished missions (DESIGN.md §4).
--
-- The original stays on its day as `carried_over` and a planned copy lands on
-- the target day. Moving an unfinished Critical mission away therefore can't
-- earn that day's "all critical done" bonus: the original still counts.

create function public.carry_tasks(p_user uuid, p_day date, p_to date, p_ids uuid[])
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.tasks;
  v_next integer;
  v_carried uuid[] := '{}';
begin
  select coalesce(max(t.sort_order), -1) + 1 into v_next
  from public.tasks t
  where t.user_id = p_user and t.planned_date = p_to;

  -- Only that day's unfinished top-level missions. Anything else in p_ids
  -- (another user's task, a finished one) is ignored.
  for v_task in
    select * from public.tasks t
    where t.user_id = p_user
      and t.id = any (coalesce(p_ids, '{}'))
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
  return v_carried;
end;
$$;

revoke all on function public.carry_tasks(uuid, date, date, uuid[]) from public, anon, authenticated;
grant execute on function public.carry_tasks(uuid, date, date, uuid[]) to service_role;

-- Same behavior as before, now built on carry_tasks.
create or replace function public.wrap_up_day(
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
begin
  insert into public.reflections (user_id, day, notes, carried_task_ids)
  values (p_user, p_day, nullif(btrim(p_notes), ''),
          public.carry_tasks(p_user, p_day, p_to, p_carry))
  returning * into v_reflection;
  return v_reflection;
end;
$$;

-- Moving a carried copy back to the day it came from undoes the carry: the
-- original is restored and the copy removed. Returns false when p_copy isn't
-- such a copy (the caller then moves it normally). A copy on a future day
-- can't have focus sessions, so nothing is lost.
create function public.uncarry_task(p_user uuid, p_copy uuid, p_day date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_original uuid;
begin
  select o.id into v_original
  from public.tasks c
  join public.tasks o on o.id = c.carried_from and o.user_id = c.user_id
  where c.id = p_copy and c.user_id = p_user and c.status <> 'done'
    and o.planned_date = p_day and o.status = 'carried_over'
  for update of c, o;
  if v_original is null then
    return false;
  end if;

  update public.tasks set status = 'planned' where id = v_original;
  delete from public.tasks where id = p_copy;
  return true;
end;
$$;

revoke all on function public.uncarry_task(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.uncarry_task(uuid, uuid, date) to service_role;
