"use server";

import { redirect } from "next/navigation";
import { CUSTOM_FOCUS_RANGE, remainingMs } from "@/engine";
import { getDayContext } from "@/lib/missions/server";
import { toClock } from "@/lib/focus/server";
import { syncDailyBonuses, syncFocusXp } from "@/lib/xp/sync";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Finish this long after the planned time so the database clock agrees it's complete. */
const FINISH_GRACE_MS = 1000;

const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export type FocusClockState = ReturnType<typeof toClock>;

export interface FocusResult {
  outcome: "completed" | "ended_early" | "abandoned";
  xp: number;
  focusedMinutes: number;
}

/** Starts a session on one of today's missions and opens focus mode. */
export async function startFocus(taskId: string, minutes: number): Promise<{ error: string } | void> {
  if (!isUuid(taskId)) return { error: "That mission doesn't exist." };
  if (!Number.isInteger(minutes) || minutes < CUSTOM_FOCUS_RANGE.min || minutes > CUSTOM_FOCUS_RANGE.max) {
    return { error: `Choose ${CUSTOM_FOCUS_RANGE.min} to ${CUSTOM_FOCUS_RANGE.max} minutes.` };
  }
  const ctx = await getDayContext();
  const { data: task } = await ctx.supabase.from("tasks").select("planned_date, status").eq("id", taskId).maybeSingle();
  if (!task) return { error: "That mission doesn't exist." };
  if (task.planned_date !== ctx.today) return { error: "Focus sessions are for today's missions." };
  if (task.status === "done") return { error: "This mission is already done." };

  const { error } = await ctx.supabase.rpc("start_focus_session", { p_task_id: taskId, p_planned_min: minutes });
  // 23505: a session is already running. Take the user back to it.
  if (error && error.code !== "23505") return { error: "Couldn't start the session. Please try again." };
  redirect("/focus");
}

export async function pauseFocus(sessionId: string): Promise<FocusClockState | null> {
  if (!isUuid(sessionId)) return null;
  const ctx = await getDayContext();
  const { data, error } = await ctx.supabase.rpc("pause_focus_session", { p_session_id: sessionId });
  return error || !data ? null : toClock(data);
}

export async function resumeFocus(sessionId: string): Promise<FocusClockState | null> {
  if (!isUuid(sessionId)) return null;
  const ctx = await getDayContext();
  const { data, error } = await ctx.supabase.rpc("resume_focus_session", { p_session_id: sessionId });
  return error || !data ? null : toClock(data);
}

/**
 * Ends the session. The server's clock decides the outcome (§8.1), then focus
 * XP and the day's bonuses (2 sessions, XP target) are brought up to date.
 */
export async function endFocus(
  sessionId: string,
  early: boolean,
): Promise<FocusResult | { notYetMs: number } | { error: string }> {
  if (!isUuid(sessionId)) return { error: "That session doesn't exist." };
  const ctx = await getDayContext();

  if (!early) {
    // "Time's up" from the browser: check with the server clock first, so a
    // fast device clock can't turn a full session into an early end.
    const { data: open } = await ctx.supabase
      .from("focus_sessions")
      .select("id, task_id, planned_min, started_at, paused_ms, paused_at")
      .eq("id", sessionId)
      .is("ended_at", null)
      .maybeSingle();
    if (open) {
      const left = remainingMs(toClock(open), Date.now() - FINISH_GRACE_MS);
      if (left > 0) return { notYetMs: left + FINISH_GRACE_MS };
    }
  }
  const { data: ended, error } = await ctx.supabase.rpc("end_focus_session", { p_session_id: sessionId });

  let row = ended;
  if (error) {
    // Already ended (e.g. a second tab or a double tap): report what happened.
    const { data } = await ctx.supabase
      .from("focus_sessions")
      .select("*")
      .eq("id", sessionId)
      .not("ended_at", "is", null)
      .maybeSingle();
    if (!data) return { error: "Couldn't end the session. Please try again." };
    row = data;
  }
  if (!row?.ended_at || !row.outcome) return { error: "Couldn't end the session. Please try again." };

  let xp = 0;
  try {
    const award = await syncFocusXp(ctx, sessionId);
    xp = award.xp;
    await syncDailyBonuses(ctx, award.day);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
  }
  const focusedMinutes = (Date.parse(row.ended_at) - Date.parse(row.started_at) - Number(row.paused_ms)) / 60_000;
  return { outcome: row.outcome, xp, focusedMinutes: Math.max(0, Math.floor(focusedMinutes)) };
}
