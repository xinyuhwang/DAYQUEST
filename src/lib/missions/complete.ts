import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncDailyBonuses, syncTaskXp } from "@/lib/xp/sync";
import type { DayContext } from "./server";

/**
 * Checks or un-checks one of today's missions and brings its XP and today's
 * bonuses up to date. XP failures are logged, not shown: the sync is
 * idempotent and the next change repairs the ledger.
 */
export async function setTaskDone(
  ctx: DayContext,
  id: string,
  done: boolean,
  /** The day the mission must be planned for. Normally today. */
  day: string = ctx.today,
): Promise<boolean> {
  // Status is server-owned (it has XP consequences), so write it with the
  // privileged client, scoped to the signed-in user.
  const { data, error } = await createAdminClient()
    .from("tasks")
    .update(done ? { status: "done", completed_at: new Date().toISOString() } : { status: "planned", completed_at: null })
    .eq("id", id)
    .eq("user_id", ctx.userId)
    .eq("planned_date", day) // only today's missions can be completed
    .select("id");
  const ok = !error && data.length === 1;
  if (ok) {
    try {
      await syncTaskXp(ctx, id);
      await syncDailyBonuses(ctx, day);
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
    }
  }
  return ok;
}
