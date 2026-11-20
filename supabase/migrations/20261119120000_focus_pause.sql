-- Focus timer (DESIGN.md §8.1). Pauses are measured by the server, like the
-- start and end, so a reload keeps the pause and the client never reports
-- its own focused time. Only one session can be open at a time.

alter table public.focus_sessions add column paused_at timestamptz;

create unique index focus_sessions_one_open_idx on public.focus_sessions (user_id) where ended_at is null;

-- Pause time so far, including a pause that's still running.
create function public.focus_paused_ms(s public.focus_sessions)
returns bigint
language sql
stable
set search_path = ''
as $$
  select s.paused_ms + coalesce((extract(epoch from (now() - s.paused_at)) * 1000)::bigint, 0);
$$;

create function public.pause_focus_session(p_session_id uuid)
returns public.focus_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.focus_sessions;
begin
  update public.focus_sessions s
  set paused_at = coalesce(s.paused_at, now())
  where s.id = p_session_id and s.user_id = auth.uid() and s.ended_at is null
  returning * into v_session;
  if not found then
    raise exception 'open session not found' using errcode = 'P0002';
  end if;
  return v_session;
end;
$$;

create function public.resume_focus_session(p_session_id uuid)
returns public.focus_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.focus_sessions;
begin
  update public.focus_sessions s
  set paused_ms = public.focus_paused_ms(s), paused_at = null
  where s.id = p_session_id and s.user_id = auth.uid() and s.ended_at is null
  returning * into v_session;
  if not found then
    raise exception 'open session not found' using errcode = 'P0002';
  end if;
  return v_session;
end;
$$;

-- The client no longer reports pause time; the server already knows it.
drop function public.end_focus_session(uuid, bigint);

create function public.end_focus_session(p_session_id uuid)
returns public.focus_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.focus_sessions;
  v_paused_ms bigint;
  v_focused_min numeric;
begin
  select * into v_session
  from public.focus_sessions s
  where s.id = p_session_id and s.user_id = auth.uid() and s.ended_at is null
  for update;
  if not found then
    raise exception 'open session not found' using errcode = 'P0002';
  end if;

  v_paused_ms := public.focus_paused_ms(v_session);
  v_focused_min := (extract(epoch from (now() - v_session.started_at)) * 1000 - v_paused_ms) / 60000;

  update public.focus_sessions s
  set ended_at = now(),
      paused_ms = v_paused_ms,
      paused_at = null,
      outcome = case
        when v_focused_min >= v_session.planned_min then 'completed'::public.focus_outcome
        when v_focused_min >= v_session.planned_min * 0.5 then 'ended_early'::public.focus_outcome
        else 'abandoned'::public.focus_outcome
      end
  where s.id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;

revoke all on function public.focus_paused_ms(public.focus_sessions) from public, anon;
revoke all on function public.pause_focus_session(uuid) from public, anon;
revoke all on function public.resume_focus_session(uuid) from public, anon;
revoke all on function public.end_focus_session(uuid) from public, anon;
grant execute on function public.focus_paused_ms(public.focus_sessions) to authenticated;
grant execute on function public.pause_focus_session(uuid) to authenticated;
grant execute on function public.resume_focus_session(uuid) to authenticated;
grant execute on function public.end_focus_session(uuid) to authenticated;
