"use server";

import { refresh } from "next/cache";
import { setTaskDone } from "@/lib/missions/complete";
import { createAdminClient } from "@/lib/supabase/admin";
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

/** True while a focus session is running on this mission. */
async function isBeingFocused(ctx: DayContext, id: string) {
  const { data } = await ctx.supabase.from("focus_sessions").select("id").eq("task_id", id).is("ended_at", null).maybeSingle();
  return Boolean(data);
}

const FOCUSING = "Finish the focus session on this mission first.";

/**
 * Moves an unfinished mission between Today and Tomorrow. Today → tomorrow is a
 * carry-over (§4): the original stays on today as carried_over, so moving an
 * unfinished Critical mission away can't earn "all critical done".
 */
export async function moveMission(id: string, to: MissionDay): Promise<{ ok: boolean; error?: string }> {
  if (!isUuid(id) || (to !== "today" && to !== "tomorrow")) return { ok: false };
  const ctx = await getDayContext();
  if (await isBeingFocused(ctx, id)) return { ok: false, error: FOCUSING };

  let ok: boolean;
  if (to === "tomorrow") {
    const { data, error } = await createAdminClient().rpc("carry_tasks", {
      p_user: ctx.userId,
      p_day: ctx.today,
      p_to: ctx.tomorrow,
      p_ids: [id],
    });
    ok = !error && (data ?? []).length === 1;
  } else {
    // A mission carried from today and moved back: undo the carry instead.
    const { data: undone } = await createAdminClient().rpc("uncarry_task", {
      p_user: ctx.userId,
      p_copy: id,
      p_day: ctx.today,
    });
    if (undone) {
      await resyncXp(ctx);
      refresh();
      return { ok: true };
    }
    const { data, error } = await createAdminClient()
      .from("tasks")
      .update({ planned_date: ctx.today, status: "planned", completed_at: null })
      .eq("id", id)
      .eq("user_id", ctx.userId)
      .eq("planned_date", ctx.tomorrow)
      .neq("status", "done")
      .select("id");
    ok = !error && data.length === 1;
  }
  if (ok) await resyncXp(ctx);
  refresh();
  return ok ? { ok } : { ok, error: "Couldn't move the mission. Please try again." };
}

/** Deleting a finished mission takes its XP back, so delete-and-redo can't farm XP. */
export async function deleteMission(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!isUuid(id)) return { ok: false };
  const ctx = await getDayContext();
  // Deleting would cascade to the running session and lose its focus time.
  if (await isBeingFocused(ctx, id)) return { ok: false, error: FOCUSING };
  const { error } = await createAdminClient().from("tasks").delete().eq("id", id).eq("user_id", ctx.userId);
  if (!error) await resyncXp(ctx, id);
  refresh();
  return { ok: !error };
}
