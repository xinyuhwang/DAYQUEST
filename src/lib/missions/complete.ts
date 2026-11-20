import "server-only";
import { syncDailyBonuses, syncTaskXp } from "@/lib/xp/sync";
import type { DayContext } from "./server";

/**
 * Checks or un-checks one of today's missions and brings its XP and today's
 * bonuses up to date. XP failures are logged, not shown: the sync is
 * idempotent and the next change repairs the ledger.
 */
export async function setTaskDone(ctx: DayContext, id: string, done: boolean): Promise<boolean> {
  const { data, error } = await ctx.supabase
    .from("tasks")
    .update(done ? { status: "done", completed_at: new Date().toISOString() } : { status: "planned", completed_at: null })
    .eq("id", id)
    .eq("planned_date", ctx.today) // only today's missions can be completed
    .select("id");
  const ok = !error && data.length === 1;
  if (ok) {
    try {
      await syncTaskXp(ctx, id);
      await syncDailyBonuses(ctx, ctx.today);
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
    }
  }
  return ok;
}
