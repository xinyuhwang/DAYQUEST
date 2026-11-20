"use server";

import { refresh } from "next/cache";
import { getDayContext } from "@/lib/missions/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextChangeAt, parseDaySettings } from "@/lib/settings/validate";

export interface DaySettingsState {
  savedCount: number;
  message?: string;
}

/**
 * Updates the time zone and rollover hour (§3). They decide which day XP and
 * bonuses land on, so they're server-owned and can change once every 24 hours.
 */
export async function updateDaySettings(prev: DaySettingsState, form: FormData): Promise<DaySettingsState> {
  const parsed = parseDaySettings(form);
  if (!parsed.ok) return { ...prev, message: parsed.error };
  const { timezone, rolloverHour } = parsed.value;

  const ctx = await getDayContext();
  if (timezone === ctx.timezone && rolloverHour === ctx.rolloverHour) return { savedCount: prev.savedCount + 1 };

  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("day_settings_changed_at")
    .eq("id", ctx.userId)
    .single();
  if (nextChangeAt(profile?.day_settings_changed_at ?? null, Date.now())) {
    return { ...prev, message: "You've changed these in the last 24 hours. Try again later." };
  }

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ timezone, day_rollover_hour: rolloverHour, day_settings_changed_at: new Date().toISOString() })
    .eq("id", ctx.userId);
  if (error) {
    console.error(`Settings write failed: ${error.message}`);
    return { ...prev, message: "Couldn't save your settings. Please try again." };
  }
  refresh();
  return { savedCount: prev.savedCount + 1 };
}
