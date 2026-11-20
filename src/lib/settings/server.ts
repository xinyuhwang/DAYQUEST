import "server-only";
import type { DayContext } from "@/lib/missions/server";
import { nextChangeAt } from "./validate";

/** "Sat 3:15 PM" until the day settings can change again, or null if they can now. */
export async function daySettingsLockedUntil(ctx: DayContext): Promise<string | null> {
  const { data } = await ctx.supabase.from("profiles").select("day_settings_changed_at").eq("id", ctx.userId).single();
  const next = nextChangeAt(data?.day_settings_changed_at ?? null, Date.now());
  return next
    ? new Date(next).toLocaleString("en-US", { timeZone: ctx.timezone, weekday: "short", hour: "numeric", minute: "2-digit" })
    : null;
}
