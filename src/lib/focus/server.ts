import "server-only";
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

/** Completed sessions today, for the long break after every 4th. */
export async function completedSessionsToday(ctx: DayContext): Promise<number> {
  const { count } = await ctx.supabase
    .from("focus_sessions")
    .select("id, tasks!inner(planned_date)", { count: "exact", head: true })
    .eq("outcome", "completed")
    .eq("tasks.planned_date", ctx.today);
  return count ?? 0;
}
