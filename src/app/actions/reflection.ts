"use server";

import { refresh } from "next/cache";
import { addDays, reflectionOpen } from "@/engine";
import { getDayContext } from "@/lib/missions/server";
import { parseWrapUpForm } from "@/lib/reflection/validate";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncDailyBonuses } from "@/lib/xp/sync";

export interface WrapUpFormState {
  savedCount: number;
  message?: string;
}

/**
 * Wraps up a day (§3 step 8): records the reflection, which earns the +10
 * bonus, and carries the missions the user chose into the next day. Tonight's
 * wrap-up opens at 20:00; a missed yesterday can be wrapped up the next day,
 * carrying into today.
 */
export async function wrapUpDay(prev: WrapUpFormState, form: FormData): Promise<WrapUpFormState> {
  const parsed = parseWrapUpForm(form);
  if (!parsed.ok) return { ...prev, message: parsed.error };
  const { day: which, notes, carry } = parsed.value;

  const ctx = await getDayContext();
  if (which === "today" && !reflectionOpen(new Date(), ctx.timezone, ctx.rolloverHour)) {
    return { ...prev, message: "The evening reflection opens at 8 PM." };
  }
  const day = which === "today" ? ctx.today : addDays(ctx.today, -1);
  const to = which === "today" ? ctx.tomorrow : ctx.today;

  if (carry.length > 0) {
    const { data: running } = await ctx.supabase
      .from("focus_sessions")
      .select("id")
      .is("ended_at", null)
      .in("task_id", carry)
      .maybeSingle();
    if (running) return { ...prev, message: "Finish your focus session before carrying that mission." };
  }

  const { error } = await createAdminClient().rpc("wrap_up_day", {
    p_user: ctx.userId,
    p_day: day,
    p_to: to,
    p_notes: notes,
    p_carry: carry,
  });
  // 23505: already wrapped up (a double submit or another tab). Nothing was carried twice.
  if (error && error.code !== "23505") {
    console.error(error.message);
    return { ...prev, message: "Couldn't save your reflection. Please try again." };
  }

  try {
    await syncDailyBonuses(ctx, day);
    // Missions carried into today can change today's bonuses (e.g. a new critical one).
    if (to === ctx.today) await syncDailyBonuses(ctx, ctx.today);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
  }
  refresh();
  return { savedCount: prev.savedCount + 1 };
}
