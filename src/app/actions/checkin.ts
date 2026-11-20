"use server";

import { refresh } from "next/cache";
import { calculateCapacity, targetAfterCheckin } from "@/engine";
import { parseCheckinForm, type CheckinErrors } from "@/lib/checkin/validate";
import { getDayContext } from "@/lib/missions/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dayTarget, getDayXp, syncDailyBonuses } from "@/lib/xp/sync";

export interface CheckinFormState {
  savedCount: number;
  errors?: CheckinErrors;
  message?: string;
}

/**
 * Records a check-in snapshot for today and the plan it produces (§7).
 * Capacity and the XP target are computed here with the engine, never taken
 * from the client; the tables are read-only for users.
 */
export async function submitCheckin(prev: CheckinFormState, form: FormData): Promise<CheckinFormState> {
  const parsed = parseCheckinForm(form);
  if (!parsed.ok) return { ...prev, errors: parsed.errors, message: undefined };

  const ctx = await getDayContext();
  const { energy, focus, mood, availableMinutes } = parsed.value;
  const capacity = calculateCapacity({ availableMinutes, energy, focus });

  // A re-check-in can lower today's target but never raise it.
  const [currentTarget, xp] = await Promise.all([dayTarget(ctx, ctx.today), getDayXp(ctx, ctx.today)]);
  const xpTarget = targetAfterCheckin(
    capacity.recommendedMinutes,
    currentTarget > 0 ? { target: currentTarget, earnedSoFar: xp.earnedTowardTarget } : undefined,
  );

  const admin = createAdminClient();
  const { data: checkin, error } = await admin
    .from("daily_checkins")
    .insert({
      user_id: ctx.userId,
      day: ctx.today,
      energy,
      focus,
      mood,
      available_min: availableMinutes,
      capacity_min: capacity.capacityMinutes,
      recommended_min: capacity.recommendedMinutes,
    })
    .select("id")
    .single();
  if (error) {
    console.error(`Check-in write failed: ${error.message}`);
    return { ...prev, errors: undefined, message: "Couldn't save your check-in. Please try again." };
  }

  const { error: planError } = await admin
    .from("daily_plans")
    .insert({ user_id: ctx.userId, day: ctx.today, checkin_id: checkin.id, xp_target: xpTarget });
  if (planError) {
    // A check-in without its plan would leave the day with no XP target, and
    // the next re-check-in would set one fresh. Undo it and ask to retry.
    console.error(`Daily plan write failed: ${planError.message}`);
    await admin.from("daily_checkins").delete().eq("id", checkin.id);
    return { ...prev, errors: undefined, message: "Couldn't save your check-in. Please try again." };
  }

  // A lower target may complete the "target reached" bonus right away.
  try {
    await syncDailyBonuses(ctx, ctx.today);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
  }

  refresh();
  return { savedCount: prev.savedCount + 1 };
}
