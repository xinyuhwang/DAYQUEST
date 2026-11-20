-- XP rows record the DAYQUEST day (after the user's rollover) they count toward,
-- so "XP today", the daily target and weekly reports are simple sums.
-- Reversals use the day of the award they cancel, so daily totals net out.
alter table public.xp_transactions add column day date not null;

create index xp_transactions_user_day_idx on public.xp_transactions (user_id, day);
