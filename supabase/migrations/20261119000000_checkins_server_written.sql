-- Check-ins set the daily XP target, which unlocks the +20 target bonus, so
-- they're part of the game economy (DESIGN.md principle 4): the server computes
-- capacity with the engine and writes the snapshot. Users can read their own
-- check-ins and plans but not write or edit them. Snapshots are never
-- overwritten (§7.4).
revoke insert, update, delete on public.daily_checkins, public.daily_plans from authenticated;

create index if not exists daily_plans_checkin_idx on public.daily_plans (checkin_id);
