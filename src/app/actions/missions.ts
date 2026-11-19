"use server";

import { refresh } from "next/cache";
import { setTaskDone } from "@/lib/missions/complete";
import { getDayContext, type DayContext } from "@/lib/missions/server";
import { parseMissionForm, type FieldErrors, type MissionDay } from "@/lib/missions/validate";
import { syncDailyBonuses, syncTaskXp } from "@/lib/xp/sync";

export interface MissionFormState {
  /** Increments on each success so the client can reset or close the form. */
  savedCount: number;
  errors?: FieldErrors;
  message?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/**
 * Today's bonuses depend on today's missions (e.g. "all critical done"), so
 * any change to them re-checks the bonuses. XP failures are logged, not
 * shown: the sync is idempotent and the next change repairs the ledger.
 */
async function resyncXp(ctx: DayContext, taskId?: string) {
  try {
    if (taskId) await syncTaskXp(ctx, taskId);
    await syncDailyBonuses(ctx, ctx.today);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
  }
}

export async function createMission(prev: MissionFormState, form: FormData): Promise<MissionFormState> {
  const parsed = parseMissionForm(form);
  if (!parsed.ok) return { ...prev, errors: parsed.errors };

  const ctx = await getDayContext();
  const { title, category, importance, difficulty, estMinutes, day } = parsed.value;
  const plannedDate = day === "today" ? ctx.today : ctx.tomorrow;

  // New missions go to the end of the day's list.
  const { data: last } = await ctx.supabase
    .from("tasks")
    .select("sort_order")
    .eq("planned_date", plannedDate)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await ctx.supabase.from("tasks").insert({
    title,
    category,
    importance,
    difficulty,
    est_minutes: estMinutes,
    planned_date: plannedDate,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) return { ...prev, errors: undefined, message: "Couldn't save the mission. Please try again." };

  if (plannedDate === ctx.today) await resyncXp(ctx);
  refresh();
  return { savedCount: prev.savedCount + 1 };
}

export async function updateMission(prev: MissionFormState, form: FormData): Promise<MissionFormState> {
  const id = form.get("id");
  if (!isUuid(id)) return { ...prev, message: "That mission no longer exists." };
  const parsed = parseMissionForm(form);
  if (!parsed.ok) return { ...prev, errors: parsed.errors };

  const ctx = await getDayContext();
  const { title, category, importance, difficulty, estMinutes } = parsed.value;
  const { error } = await ctx.supabase
    .from("tasks")
    .update({ title, category, importance, difficulty, est_minutes: estMinutes })
    .eq("id", id);
  if (error) return { ...prev, errors: undefined, message: "Couldn't save your changes. Please try again." };

  // A finished mission keeps the XP it earned; editing only matters for bonuses.
  await resyncXp(ctx);
  refresh();
  return { savedCount: prev.savedCount + 1 };
}

/** Check or un-check one of today's missions, then award or reverse its XP. */
export async function setMissionDone(id: string, done: boolean): Promise<{ ok: boolean }> {
  if (!isUuid(id)) return { ok: false };
  const ok = await setTaskDone(await getDayContext(), id, done);
  refresh();
  return { ok };
}

export async function moveMission(id: string, to: MissionDay): Promise<{ ok: boolean }> {
  if (!isUuid(id) || (to !== "today" && to !== "tomorrow")) return { ok: false };
  const ctx = await getDayContext();
  const { error } = await ctx.supabase
    .from("tasks")
    .update({ planned_date: to === "today" ? ctx.today : ctx.tomorrow, status: "planned", completed_at: null })
    .eq("id", id)
    .neq("status", "done"); // finished missions stay where they were finished
  if (!error) await resyncXp(ctx);
  refresh();
  return { ok: !error };
}

/** Deleting a finished mission takes its XP back, so delete-and-redo can't farm XP. */
export async function deleteMission(id: string): Promise<{ ok: boolean }> {
  if (!isUuid(id)) return { ok: false };
  const ctx = await getDayContext();
  const { error } = await ctx.supabase.from("tasks").delete().eq("id", id);
  if (!error) await resyncXp(ctx, id);
  refresh();
  return { ok: !error };
}
