import "server-only";
import {
  activeAwards,
  DAILY_BONUS_XP,
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

type XpSource = Database["public"]["Enums"]["xp_source"];

const TASK_BASE = "task_completed";
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
  const [{ data: tasks }, { count: sessions }, { data: reflection }, xp] = await Promise.all([
    ctx.supabase.from("tasks").select("importance, status").eq("planned_date", day).is("parent_id", null),
    ctx.supabase
      .from("focus_sessions")
      .select("id, tasks!inner(planned_date)", { count: "exact", head: true })
      .eq("outcome", "completed")
      .eq("tasks.planned_date", day),
    ctx.supabase.from("reflections").select("id").eq("day", day).maybeSingle(),
    getDayXp(ctx, day),
  ]);

  const critical = (tasks ?? []).filter((t) => t.importance === "critical");
  const qualifying = qualifyingDailyBonuses({
    criticalPlanned: critical.length,
    criticalCompleted: critical.filter((t) => t.status === "done").length,
    earnedXp: xp.earnedTowardTarget,
    xpTarget: xp.target,
    completedFocusSessions: sessions ?? 0,
    reflectionDone: Boolean(reflection),
  });

  const entries = await ledgerFor(ctx, "daily_bonus", day);
  const changes = BONUS_CODES.flatMap((code) =>
    planLedgerChange(entries, bonusBase(code), qualifying.includes(code), DAILY_BONUS_XP[code], day),
  );
  await append(ctx, "daily_bonus", day, changes);
}
