-- State that drives XP is changed only by server code (DESIGN.md principle 4).
--
-- 1. Day settings. The time zone and rollover hour decide which day XP and
--    bonuses land on, so shifting them freely could claim a day's bonuses
--    twice. They're now changed through the Settings action, at most once a
--    day; first sign-in sets the time zone once.
-- 2. Mission status, day and deletion. Completing, un-completing, moving and
--    deleting all have XP consequences (reversals, "all critical done"), which
--    the server actions keep in step. Users still create missions and edit
--    their content directly (RLS keeps it to their own rows).

alter table public.profiles add column day_settings_changed_at timestamptz;

revoke update on public.profiles from authenticated;
grant update (theme, theme_variants) on public.profiles to authenticated;

revoke insert, update, delete on public.tasks from authenticated;
grant insert (title, category, importance, difficulty, est_minutes, planned_date, sort_order, parent_id, quest_id)
  on public.tasks to authenticated;
grant update (title, category, importance, difficulty, est_minutes, sort_order, parent_id, quest_id)
  on public.tasks to authenticated;
