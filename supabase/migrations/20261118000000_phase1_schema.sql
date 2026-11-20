-- DAYQUEST Phase 1 schema (docs/DESIGN.md §14).
--
-- Security model:
--   * Every user-owned row carries user_id and is protected by row-level security.
--   * Game-economy tables (xp_transactions, user_unlocks, user_achievements) are
--     read-only for users. Only server code using the service role writes them,
--     so neither the browser nor the AI coach can award progress (principle 4).
--   * Focus sessions start and end through functions that stamp the database
--     clock, so the timestamps that focus XP depends on can't be forged.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.difficulty as enum ('easy', 'medium', 'hard');
create type public.importance as enum ('optional', 'normal', 'important', 'critical');
create type public.category as enum (
  'deep_work', 'research', 'learning', 'writing', 'admin', 'wellness', 'other'
);
create type public.task_status as enum (
  'planned', 'active', 'done', 'partial', 'carried_over', 'dropped'
);
create type public.mood as enum ('great', 'calm', 'neutral', 'tired', 'anxious', 'low');
create type public.focus_outcome as enum ('completed', 'ended_early', 'abandoned');
create type public.quest_status as enum ('active', 'done', 'archived');
create type public.xp_source as enum (
  'task', 'focus_session', 'daily_bonus', 'milestone', 'adjustment'
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  timezone text not null default 'UTC',
  day_rollover_hour smallint not null default 4 check (day_rollover_hour between 0 and 6),
  theme text not null default 'minimal' check (theme in ('minimal')),
  -- Equipped unlockable variants, e.g. {"accent": "sage", "timer": "ring"}.
  theme_variants jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Quests and milestones
-- ---------------------------------------------------------------------------

create table public.quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  is_boss boolean not null default false,
  status public.quest_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index quests_user_idx on public.quests (user_id);

-- Composite foreign keys (child_id, user_id) below ensure rows can only point
-- at the same user's rows, even if another user's id were known.
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  quest_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  done_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (quest_id, user_id) references public.quests (id, user_id) on delete cascade
);

create index milestones_quest_idx on public.milestones (quest_id);

-- ---------------------------------------------------------------------------
-- Tasks (missions)
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  category public.category not null default 'other',
  importance public.importance not null default 'normal',
  difficulty public.difficulty not null default 'medium',
  est_minutes integer not null check (est_minutes between 1 and 600),
  -- The DAYQUEST day (after rollover) the mission is planned for.
  planned_date date not null,
  status public.task_status not null default 'planned',
  sort_order integer not null default 0,
  parent_id uuid,
  quest_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (parent_id is null or parent_id <> id),
  foreign key (parent_id, user_id) references public.tasks (id, user_id) on delete cascade,
  foreign key (quest_id, user_id) references public.quests (id, user_id) on delete set null (quest_id)
);

create index tasks_user_day_idx on public.tasks (user_id, planned_date);
create index tasks_parent_idx on public.tasks (parent_id);

create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Check-ins and plans (snapshots: many per day, never overwritten)
-- ---------------------------------------------------------------------------

create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  energy smallint not null check (energy between 1 and 5),
  focus smallint not null check (focus between 1 and 5),
  mood public.mood, -- optional
  available_min integer not null check (available_min between 0 and 1440),
  capacity_min integer not null check (capacity_min >= 0),
  recommended_min integer not null check (recommended_min >= 0),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index daily_checkins_user_day_idx on public.daily_checkins (user_id, day, created_at desc);

create table public.daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  checkin_id uuid,
  xp_target integer not null check (xp_target >= 0),
  ordered_task_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (checkin_id, user_id) references public.daily_checkins (id, user_id)
    on delete set null (checkin_id)
);

create index daily_plans_user_day_idx on public.daily_plans (user_id, day, created_at desc);

-- ---------------------------------------------------------------------------
-- Focus sessions
-- ---------------------------------------------------------------------------

create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  planned_min integer not null check (planned_min between 1 and 180),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  paused_ms bigint not null default 0 check (paused_ms >= 0),
  outcome public.focus_outcome,
  check (ended_at is null or ended_at >= started_at)
);

create index focus_sessions_user_started_idx on public.focus_sessions (user_id, started_at desc);

-- Starts a session for one of the caller's own missions, stamped with the DB clock.
create function public.start_focus_session(p_task_id uuid, p_planned_min integer)
returns public.focus_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.focus_sessions;
begin
  if not exists (
    select 1 from public.tasks t where t.id = p_task_id and t.user_id = auth.uid()
  ) then
    raise exception 'mission not found' using errcode = 'P0002';
  end if;

  insert into public.focus_sessions (user_id, task_id, planned_min)
  values (auth.uid(), p_task_id, p_planned_min)
  returning * into v_session;
  return v_session;
end;
$$;

-- Ends one of the caller's open sessions. The outcome is derived from the
-- server-measured focused time, never supplied by the client.
create function public.end_focus_session(p_session_id uuid, p_paused_ms bigint default 0)
returns public.focus_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.focus_sessions;
  v_focused_min numeric;
begin
  select * into v_session
  from public.focus_sessions s
  where s.id = p_session_id and s.user_id = auth.uid() and s.ended_at is null
  for update;

  if not found then
    raise exception 'open session not found' using errcode = 'P0002';
  end if;

  v_focused_min :=
    (extract(epoch from (now() - v_session.started_at)) * 1000 - greatest(p_paused_ms, 0)) / 60000;

  update public.focus_sessions s
  set ended_at = now(),
      paused_ms = greatest(p_paused_ms, 0),
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

revoke all on function public.start_focus_session(uuid, integer) from public, anon;
revoke all on function public.end_focus_session(uuid, bigint) from public, anon;
grant execute on function public.start_focus_session(uuid, integer) to authenticated;
grant execute on function public.end_focus_session(uuid, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- XP ledger (append-only; written by server code only)
-- ---------------------------------------------------------------------------

create table public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount <> 0),
  source_type public.xp_source not null,
  -- The task/session/milestone id, or the day ("2026-11-18") for daily bonuses.
  source_id text not null,
  -- e.g. "task_completed#1", "task_completed#1:reversal", "bonus:all_critical".
  -- Re-completing a task after un-checking it uses the next sequence number.
  reason text not null,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id, reason)
);

create index xp_transactions_user_idx on public.xp_transactions (user_id, created_at);

-- Total XP per user. Level and evolution stage are derived from this in the engine.
create view public.user_xp
with (security_invoker = true)
as
select user_id, coalesce(sum(amount), 0)::integer as total_xp
from public.xp_transactions
group by user_id;

-- ---------------------------------------------------------------------------
-- Reflections
-- ---------------------------------------------------------------------------

create table public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  notes text check (char_length(notes) <= 5000),
  carried_task_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

-- ---------------------------------------------------------------------------
-- Achievements and unlocks
-- ---------------------------------------------------------------------------

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null default ''
);

create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

create table public.user_unlocks (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- e.g. "accent:sage", "timer:flip", "sound:cafe"
  unlock_code text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, unlock_code)
);

-- ---------------------------------------------------------------------------
-- Companion (level, stage and expression are derived, never stored)
-- ---------------------------------------------------------------------------

create table public.companions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text check (char_length(name) between 1 and 40), -- named at hatching
  hatched_at timestamptz,
  marking_category public.category, -- set once when the companion reaches stage 3
  equipped_cosmetics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- AI suggestions (written by the server-side coach; users record acceptance)
-- ---------------------------------------------------------------------------

create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  accepted boolean,
  created_at timestamptz not null default now()
);

create index ai_suggestions_user_idx on public.ai_suggestions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- New-user bootstrap
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.companions (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.quests enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.daily_plans enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.reflections enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.user_unlocks enable row level security;
alter table public.companions enable row level security;
alter table public.ai_suggestions enable row level security;

-- Start from no table access for API roles, then grant exactly what's needed.
revoke all on all tables in schema public from anon, authenticated;

-- Fully user-owned tables: the owner can read and write their own rows.
grant select, insert, update, delete on
  public.quests, public.milestones, public.tasks,
  public.daily_checkins, public.daily_plans, public.reflections
to authenticated;

create policy "own quests" on public.quests for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own milestones" on public.milestones for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own tasks" on public.tasks for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own check-ins" on public.daily_checkins for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own plans" on public.daily_plans for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own reflections" on public.reflections for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Profiles: read and update your own settings (created by the signup trigger).
grant select on public.profiles to authenticated;
grant update (timezone, day_rollover_hour, theme, theme_variants) on public.profiles to authenticated;
create policy "read own profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Companion: read it; rename it and change cosmetics. Hatching and markings are server-set.
grant select on public.companions to authenticated;
grant update (name, equipped_cosmetics) on public.companions to authenticated;
create policy "read own companion" on public.companions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "update own companion" on public.companions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Focus sessions: read-only; writes go through start/end_focus_session().
grant select on public.focus_sessions to authenticated;
create policy "read own focus sessions" on public.focus_sessions for select to authenticated
  using (user_id = (select auth.uid()));

-- Game economy: read-only for users.
grant select on public.xp_transactions, public.user_xp, public.user_achievements, public.user_unlocks
  to authenticated;
create policy "read own xp" on public.xp_transactions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "read own achievements" on public.user_achievements for select to authenticated
  using (user_id = (select auth.uid()));
create policy "read own unlocks" on public.user_unlocks for select to authenticated
  using (user_id = (select auth.uid()));

-- Achievement catalog: readable by any signed-in user.
grant select on public.achievements to authenticated;
create policy "read achievement catalog" on public.achievements for select to authenticated
  using (true);

-- AI suggestions: read them and record whether you accepted.
grant select on public.ai_suggestions to authenticated;
grant update (accepted) on public.ai_suggestions to authenticated;
create policy "read own suggestions" on public.ai_suggestions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "answer own suggestions" on public.ai_suggestions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
