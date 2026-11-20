-- Row-level security and game-economy integrity checks.
-- Run with: pnpm db:test
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

-- Two users, created the way Supabase Auth would (fires the signup trigger).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test');

select ok(exists (select 1 from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'signup creates a profile');
select ok(exists (select 1 from public.companions where user_id = '00000000-0000-0000-0000-00000000000a'),
  'signup creates a companion');
select is((select day_rollover_hour from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  4::smallint, 'default rollover hour is 4');

-- Server-side setup: one task for each user, and some XP for A.
insert into public.tasks (id, user_id, title, est_minutes, planned_date) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'A task', 30, '2026-11-18'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'B task', 30, '2026-11-18');
insert into public.xp_transactions (user_id, amount, source_type, source_id, reason, day) values
  ('00000000-0000-0000-0000-00000000000a', 52, 'task', '10000000-0000-0000-0000-00000000000a', 'task_completed#1', '2026-11-18'),
  ('00000000-0000-0000-0000-00000000000b', 20, 'task', '10000000-0000-0000-0000-00000000000b', 'task_completed#1', '2026-11-18');

insert into public.daily_checkins (user_id, day, energy, focus, available_min, capacity_min, recommended_min) values
  ('00000000-0000-0000-0000-00000000000a', '2026-11-18', 3, 3, 240, 204, 163),
  ('00000000-0000-0000-0000-00000000000b', '2026-11-18', 4, 4, 120, 120, 96);

insert into public.focus_sessions (id, user_id, task_id, planned_min) values
  ('20000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', '10000000-0000-0000-0000-00000000000b', 25);

select throws_ok(
  $$ insert into public.xp_transactions (user_id, amount, source_type, source_id, reason, day) values
     ('00000000-0000-0000-0000-00000000000a', 52, 'task', '10000000-0000-0000-0000-00000000000a', 'task_completed#1', '2026-11-18') $$,
  '23505', null, 'the same XP award cannot be claimed twice');

-- ---------------------------------------------------------------- act as A
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

select is((select count(*) from public.tasks), 1::bigint, 'A sees only their own tasks');
select is((select title from public.tasks), 'A task', 'A sees their task');

select lives_ok(
  $$ insert into public.tasks (title, est_minutes, planned_date) values ('A new task', 15, '2026-11-18') $$,
  'A can create a task (user_id defaults to auth.uid())');

select throws_ok(
  $$ insert into public.tasks (user_id, title, est_minutes, planned_date)
     values ('00000000-0000-0000-0000-00000000000b', 'sneaky', 15, '2026-11-18') $$,
  '42501', null, 'A cannot create a task owned by B');

update public.tasks set title = 'hijacked' where id = '10000000-0000-0000-0000-00000000000b';
delete from public.tasks where id = '10000000-0000-0000-0000-00000000000b';

select throws_ok(
  $$ insert into public.tasks (title, est_minutes, planned_date, parent_id)
     values ('child', 15, '2026-11-18', '10000000-0000-0000-0000-00000000000b') $$,
  '23503', null, 'A cannot attach a subtask to B''s task');

select is((select total_xp from public.user_xp), 52, 'A sees only their own XP total');

select throws_ok(
  $$ insert into public.xp_transactions (user_id, amount, source_type, source_id, reason, day)
     values ('00000000-0000-0000-0000-00000000000a', 9999, 'adjustment', 'x', 'cheat', '2026-11-18') $$,
  '42501', null, 'A cannot award themselves XP');

select throws_ok(
  $$ insert into public.user_unlocks (user_id, unlock_code)
     values ('00000000-0000-0000-0000-00000000000a', 'accent:sage') $$,
  '42501', null, 'A cannot grant themselves unlocks');

select throws_ok(
  $$ insert into public.focus_sessions (user_id, task_id, planned_min, started_at)
     values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 25, now() - interval '1 hour') $$,
  '42501', null, 'A cannot insert backdated focus sessions directly');

select lives_ok(
  $$ select public.start_focus_session('10000000-0000-0000-0000-00000000000a', 25) $$,
  'A can start a focus session on their own mission');

select throws_ok(
  $$ select public.start_focus_session('10000000-0000-0000-0000-00000000000b', 25) $$,
  'P0002', null, 'A cannot start a session on B''s mission');

select is(
  (select (public.end_focus_session(id)).outcome from public.focus_sessions where ended_at is null),
  'abandoned'::public.focus_outcome,
  'ending a session right away is judged by the server clock (abandoned)');

select lives_ok(
  $$ select public.start_focus_session('10000000-0000-0000-0000-00000000000a', 25) $$,
  'A starts another session after ending the first');

select throws_ok(
  $$ select public.start_focus_session('10000000-0000-0000-0000-00000000000a', 25) $$,
  '23505', null, 'only one focus session can be open at a time');

select lives_ok(
  $$ select public.pause_focus_session(id) from public.focus_sessions where ended_at is null $$,
  'A can pause their open session');

select ok(
  (select paused_at is not null from public.focus_sessions where ended_at is null),
  'the pause start is recorded by the server');

select is(
  (select (public.end_focus_session(id)).paused_at from public.focus_sessions where ended_at is null),
  null, 'ending a paused session folds the pause into paused_ms');

select throws_ok(
  $$ select public.pause_focus_session('20000000-0000-0000-0000-00000000000b') $$,
  'P0002', null, 'A cannot pause B''s session');

select lives_ok(
  $$ update public.companions set name = 'Ember' $$,
  'A can name their companion');

select throws_ok(
  $$ update public.companions set marking_category = 'research' $$,
  '42501', null, 'A cannot set their companion''s markings');

select throws_ok(
  $$ update public.profiles set id = '00000000-0000-0000-0000-00000000000b' $$,
  '42501', null, 'A cannot change their profile id');

select throws_ok(
  $$ insert into public.daily_checkins (day, energy, focus, available_min, capacity_min, recommended_min)
     values ('2026-11-18', 5, 5, 600, 600, 10) $$,
  '42501', null, 'A cannot write a check-in directly (it sets the XP target)');

select throws_ok(
  $$ insert into public.daily_plans (day, xp_target) values ('2026-11-18', 10) $$,
  '42501', null, 'A cannot set their own daily XP target');

select is((select count(*) from public.daily_checkins), 1::bigint, 'A sees only their own check-ins');

select throws_ok(
  $$ insert into public.reflections (day) values ('2026-11-18') $$,
  '42501', null, 'A cannot write a reflection directly (it earns a bonus)');

select throws_ok(
  $$ select public.wrap_up_day('00000000-0000-0000-0000-00000000000a', '2026-11-18', '2026-11-19', null, '{}') $$,
  '42501', null, 'A cannot call wrap_up_day (server only)');

-- ---------------------------------------------------------------- act as B
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is((select name from public.companions), null, 'B does not see A''s companion name');

-- ---------------------------------------------------------------- owner view
reset role;
select is((select title from public.tasks where id = '10000000-0000-0000-0000-00000000000b'), 'B task',
  'A''s update and delete attempts left B''s task untouched');

-- ---------------------------------------------------------------- wrap-up (server)
set local role service_role;
select lives_ok(
  $$ select public.wrap_up_day('00000000-0000-0000-0000-00000000000a', '2026-11-18', '2026-11-19', '  good day ',
       array['10000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000b']::uuid[]) $$,
  'the server can wrap up A''s day');
reset role;

select is((select status::text from public.tasks where id = '10000000-0000-0000-0000-00000000000a'), 'carried_over',
  'the carried mission is marked carried_over on its day');
select is(
  (select count(*) from public.tasks where carried_from = '10000000-0000-0000-0000-00000000000a'
     and planned_date = '2026-11-19' and status = 'planned' and title = 'A task'),
  1::bigint, 'a planned copy lands on the next day');
select is((select status::text from public.tasks where id = '10000000-0000-0000-0000-00000000000b'), 'planned',
  'another user''s mission in the carry list is ignored');
select is(
  (select notes || ' ' || array_to_string(carried_task_ids, ',') from public.reflections
     where user_id = '00000000-0000-0000-0000-00000000000a'),
  'good day 10000000-0000-0000-0000-00000000000a', 'the reflection records trimmed notes and what was carried');

set local role service_role;
select throws_ok(
  $$ select public.wrap_up_day('00000000-0000-0000-0000-00000000000a', '2026-11-18', '2026-11-19', null,
       array['10000000-0000-0000-0000-00000000000a']::uuid[]) $$,
  '23505', null, 'a day can be wrapped up only once');
reset role;
select is((select count(*) from public.tasks where carried_from is not null), 1::bigint,
  'a repeated wrap-up carries nothing twice');

-- ---------------------------------------------------------------- anonymous
set local role anon;
select throws_ok($$ select * from public.tasks $$, '42501', null, 'anonymous visitors cannot read tasks');

select * from finish();
rollback;
