import "server-only";
import { addDays, dayKey } from "@/engine";
import type { DayContext } from "@/lib/missions/server";

export interface OpenSession {
  id: string;
  taskId: string;
  taskTitle: string;
  plannedMinutes: number;
  /** Epoch ms, from the server. */
  startedAt: number;
  pausedMs: number;
  pausedAt: number | null;
  /** Server time when this was read, so the browser can line its countdown up. */
  serverNow: number;
}

type SessionRow = {
  id: string;
  task_id: string;
  planned_min: number;
  started_at: string;
  paused_ms: number;
  paused_at: string | null;
};

export function toClock(row: SessionRow) {
  return {
    id: row.id,
    taskId: row.task_id,
    plannedMinutes: row.planned_min,
    startedAt: Date.parse(row.started_at),
    pausedMs: Number(row.paused_ms),
    pausedAt: row.paused_at ? Date.parse(row.paused_at) : null,
  };
}

/** The user's running session, if any (there's at most one). */
export async function getOpenSession(ctx: DayContext): Promise<OpenSession | null> {
  const { data, error } = await ctx.supabase
    .from("focus_sessions")
    .select("id, task_id, planned_min, started_at, paused_ms, paused_at, tasks(title)")
    .is("ended_at", null)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load your focus session: ${error.message}`);
  if (!data) return null;
  return { ...toClock(data), taskTitle: data.tasks?.title ?? "Mission", serverNow: Date.now() };
}

export interface EndedSession {
  plannedMinutes: number;
  outcome: "completed" | "ended_early" | "abandoned";
  focusedMs: number;
}

/**
 * Sessions that ended, belonging to `day` by when they *started*: the same rule
 * that dates their focus XP. A mission moved to another day afterwards doesn't
 * take its sessions with it.
 */
export async function endedSessionsOn(ctx: DayContext, day: string): Promise<EndedSession[]> {
  // Any time zone's day falls inside this UTC window; dayKey picks the exact ones.
  const { data, error } = await ctx.supabase
    .from("focus_sessions")
    .select("planned_min, started_at, ended_at, paused_ms, outcome")
    .not("ended_at", "is", null)
    .gte("started_at", `${addDays(day, -1)}T00:00:00Z`)
    .lt("started_at", `${addDays(day, 2)}T00:00:00Z`);
  if (error) throw new Error(`Couldn't load focus sessions: ${error.message}`);
  return data
    .filter((s) => dayKey(new Date(s.started_at), ctx.timezone, ctx.rolloverHour) === day)
    .map((s) => ({
      plannedMinutes: s.planned_min,
      outcome: s.outcome!,
      focusedMs: Math.max(0, Date.parse(s.ended_at!) - Date.parse(s.started_at) - Number(s.paused_ms)),
    }));
}

/** Completed sessions today, for the long break after every 4th. */
export async function completedSessionsToday(ctx: DayContext): Promise<number> {
  return (await endedSessionsOn(ctx, ctx.today)).filter((s) => s.outcome === "completed").length;
}
