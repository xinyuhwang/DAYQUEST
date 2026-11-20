import "server-only";
import {
  activeAwards,
  applyFocusCap,
  dayKey,
  focusSessionXp,
  DAILY_BONUS_XP,
  FOCUS_MIN_SESSION_MIN,
  planLedgerChange,
  qualifyingDailyBonuses,
  sumLedger,
  taskXp,
  type DailyBonusCode,
  type LedgerChange,
} from "@/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import type { DayContext } from "@/lib/missions/server";
import { endedSessionsOn } from "@/lib/focus/server";

type XpSource = Database["public"]["Enums"]["xp_source"];

const TASK_BASE = "task_completed";
const FOCUS_BASE = "focus_session";
const bonusBase = (code: DailyBonusCode) => `bonus:${code}`;
const BONUS_CODES = Object.keys(DAILY_BONUS_XP) as DailyBonusCode[];

/**
 * XP writes happen only here (principle 4). Facts are read through the user's
 * own RLS-scoped client, so a user can only trigger awards for their own data;
 * the privileged client then appends the engine's result to the ledger.
 */
async function append(ctx: DayContext, sourceType: XpSource, sourceId: string, changes: LedgerChange[]) {
  if (changes.length === 0) return;
  const { error } = await createAdminClient()
    .from("xp_transactions")
    .insert(
      changes.map((c) => ({
        user_id: ctx.userId,
        source_type: sourceType,
        source_id: sourceId,
        reason: c.reason,
        amount: c.amount,
        day: c.day,
      })),
    );
  // 23505: a concurrent request (e.g. a double click) already wrote it. That's the
  // unique key doing its job, and the ledger is correct either way.
  if (error && error.code !== "23505") throw new Error(`XP ledger write failed: ${error.message}`);
}

async function ledgerFor(ctx: DayContext, sourceType: XpSource, sourceId: string) {
  const { data, error } = await createAdminClient()
    .from("xp_transactions")
    .select("reason, amount, day")
    .eq("user_id", ctx.userId)
    .eq("source_type", sourceType)
    .eq("source_id", sourceId);
  if (error) throw new Error(`XP ledger read failed: ${error.message}`);
  return data;
}

/**
 * Makes a mission's XP match its state: done → awarded once; not done or
 * deleted → any award reversed. Safe to call any number of times.
 */
export async function syncTaskXp(ctx: DayContext, taskId: string) {
  // A rapid check/un-check can interleave two requests. If the mission's state
  // changed while we were writing, sync once more against the newer state.
  for (let attempt = 0; attempt < 3; attempt++) {
    const doneBefore = await isTaskDone(ctx, taskId);
    await syncTaskXpOnce(ctx, taskId);
    if ((await isTaskDone(ctx, taskId)) === doneBefore) return;
  }
}

async function isTaskDone(ctx: DayContext, taskId: string) {
  const { data } = await ctx.supabase.from("tasks").select("status").eq("id", taskId).maybeSingle();
  return data?.status === "done";
}

async function syncTaskXpOnce(ctx: DayContext, taskId: string) {
  const { data: task } = await ctx.supabase
    .from("tasks")
    .select("status, importance, difficulty, est_minutes, planned_date")
    .eq("id", taskId)
    .maybeSingle();

  const entries = await ledgerFor(ctx, "task", taskId);
  const done = task?.status === "done";
  const amount = task
    ? taskXp({ difficulty: task.difficulty, importance: task.importance, estimatedMinutes: task.est_minutes }, "completed")
    : 0;
  const changes = planLedgerChange(entries, TASK_BASE, done, amount, task?.planned_date ?? ctx.today);
  await append(ctx, "task", taskId, changes);
}

/** Why a session earned what it did. */
export type FocusAwardReason = "awarded" | "capped" | "none";

/**
 * Awards XP for an ended focus session (§5.2): measured focused time decides
 * the amount, and the day's 120 XP focus cap trims it. Sessions never change
 * after ending, so this writes at most once.
 */
export async function syncFocusXp(
  ctx: DayContext,
  sessionId: string,
): Promise<{ xp: number; day: string; reason: FocusAwardReason }> {
  const { data: s } = await ctx.supabase
    .from("focus_sessions")
    .select("task_id, planned_min, started_at, ended_at, paused_ms")
    .eq("id", sessionId)
    .not("ended_at", "is", null)
    .maybeSingle();
  if (!s?.ended_at) return { xp: 0, day: ctx.today, reason: "none" };

  const day = dayKey(new Date(s.started_at), ctx.timezone, ctx.rolloverHour);
  const focusedMinutes = (Date.parse(s.ended_at) - Date.parse(s.started_at) - Number(s.paused_ms)) / 60_000;
  const award = focusSessionXp({ taskId: s.task_id, plannedMinutes: s.planned_min, focusedMinutes });

  const entries = await ledgerFor(ctx, "focus_session", sessionId);
  if (entries.length > 0) return { xp: sumLedger(entries), day, reason: "awarded" };
  if (award === 0) return { xp: 0, day, reason: "none" };

  const { data: dayFocus, error } = await createAdminClient()
    .from("xp_transactions")
    .select("amount")
    .eq("user_id", ctx.userId)
    .eq("source_type", "focus_session")
    .eq("day", day);
  if (error) throw new Error(`XP ledger read failed: ${error.message}`);
  const earnedToday = (dayFocus ?? []).reduce((sum, r) => sum + r.amount, 0);

  const amount = applyFocusCap(award, earnedToday);
  await append(ctx, "focus_session", sessionId, planLedgerChange([], FOCUS_BASE, amount > 0, amount, day));
  return { xp: amount, day, reason: amount > 0 ? "awarded" : "capped" };
}

/**
 * Awards any recently ended sessions whose XP write failed (e.g. a dropped
 * connection while ending). Safe to call often: sessions that already have
 * ledger entries, or that earn nothing, are left alone.
 */
export async function repairFocusXp(ctx: DayContext) {
  const { data: recent } = await ctx.supabase
    .from("focus_sessions")
    .select("id")
    .not("ended_at", "is", null)
    .gte("ended_at", new Date(Date.now() - 48 * 3600e3).toISOString())
    .order("ended_at", { ascending: true });
  if (!recent?.length) return;
  const { data: awarded } = await createAdminClient()
    .from("xp_transactions")
    .select("source_id")
    .eq("user_id", ctx.userId)
    .eq("source_type", "focus_session")
    .in("source_id", recent.map((r) => r.id));
  const done = new Set((awarded ?? []).map((a) => a.source_id));
  const days = new Set<string>();
  for (const { id } of recent) {
    if (done.has(id)) continue;
    const r = await syncFocusXp(ctx, id);
    if (r.xp > 0) days.add(r.day);
  }
  for (const day of days) await syncDailyBonuses(ctx, day);
}

export interface DayXp {
  total: number;
  missions: number;
  focus: number;
  bonuses: number;
  /** Task + focus XP: what counts toward the daily target. */
  earnedTowardTarget: number;
  /** 0 until the user has checked in for the day. */
  target: number;
  activeBonuses: DailyBonusCode[];
}

/** Reads a day's XP through the user's own client (RLS), split by source. */
export async function getDayXp(ctx: DayContext, day: string): Promise<DayXp> {
  const [{ data: rows }, target] = await Promise.all([
    ctx.supabase.from("xp_transactions").select("source_type, reason, amount, day").eq("day", day),
    dayTarget(ctx, day),
  ]);
  const entries = rows ?? [];
  const bySource = (t: XpSource) => sumLedger(entries.filter((e) => e.source_type === t));
  const missions = bySource("task");
  const focus = bySource("focus_session");
  const bonuses = bySource("daily_bonus");
  const daily = entries.filter((e) => e.source_type === "daily_bonus");
  const activeBonuses = BONUS_CODES.filter((code) => activeAwards(daily, bonusBase(code)).length > 0);
  return {
    total: sumLedger(entries),
    missions,
    focus,
    bonuses,
    earnedTowardTarget: missions + focus,
    target,
    activeBonuses,
  };
}

/** The day's XP target from its latest plan (set by check-ins, §7.4). 0 before any check-in. */
export async function dayTarget(ctx: DayContext, day: string): Promise<number> {
  const { data } = await ctx.supabase
    .from("daily_plans")
    .select("xp_target")
    .eq("day", day)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.xp_target ?? 0;
}

/**
 * Awards or reverses the day's bonuses so they match what the day qualifies
 * for right now (§5.3). Call after anything that could change qualification.
 */
export async function syncDailyBonuses(ctx: DayContext, day: string = ctx.today) {
  const [{ data: tasks }, sessions, { data: reflection }, xp] = await Promise.all([
    ctx.supabase.from("tasks").select("importance, status").eq("planned_date", day).is("parent_id", null),
    endedSessionsOn(ctx, day),
    ctx.supabase.from("reflections").select("id").eq("day", day).maybeSingle(),
    getDayXp(ctx, day),
  ]);

  // Carried-away missions (status carried_over) still count on their day (§4).
  const critical = (tasks ?? []).filter((t) => t.importance === "critical");
  const qualifying = qualifyingDailyBonuses({
    criticalPlanned: critical.length,
    criticalCompleted: critical.filter((t) => t.status === "done").length,
    earnedXp: xp.earnedTowardTarget,
    xpTarget: xp.target,
    // Sessions too short to earn focus XP (§5.2) don't count toward the bonus either.
    completedFocusSessions: sessions.filter((s) => s.outcome === "completed" && s.plannedMinutes >= FOCUS_MIN_SESSION_MIN).length,
    reflectionDone: Boolean(reflection),
  });

  const entries = await ledgerFor(ctx, "daily_bonus", day);
  const changes = BONUS_CODES.flatMap((code) =>
    planLedgerChange(entries, bonusBase(code), qualifying.includes(code), DAILY_BONUS_XP[code], day),
  );
  await append(ctx, "daily_bonus", day, changes);
}
