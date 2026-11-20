import "server-only";
import { addDays, reflectionOpen } from "@/engine";
import { endedSessionsOn } from "@/lib/focus/server";
import { formatDayLabel } from "@/lib/format";
import { listMissions, type DayContext, type Mission } from "@/lib/missions/server";
import { getDayXp } from "@/lib/xp/sync";
import type { WrapUpDay } from "./validate";

export interface DaySummary {
  done: number;
  /** Missions still on the day (carried ones have moved on). */
  total: number;
  xp: number;
  focusMinutes: number;
  focusSessions: number;
}

export interface Reflection {
  notes: string | null;
  carried: number;
}

export interface WrapUp {
  day: WrapUpDay;
  /** "Wednesday, November 18" */
  dayLabel: string;
  summary: DaySummary;
  unfinished: Mission[];
  /** Minutes already planned on the day missions would carry into. */
  nextDayMinutes: number;
  reflection: Reflection | null;
}

export interface WrapUpState {
  /** Tonight's wrap-up, from 20:00 until rollover (or once done). Null otherwise. */
  tonight: WrapUp | null;
  /** A missed yesterday that left unfinished missions behind. */
  yesterday: WrapUp | null;
}

/** What the Today page needs for the evening reflection (§3 step 8). */
export async function getWrapUpState(ctx: DayContext): Promise<WrapUpState> {
  const yesterday = addDays(ctx.today, -1);
  const { data: rows } = await ctx.supabase
    .from("reflections")
    .select("day, notes, carried_task_ids")
    .in("day", [ctx.today, yesterday]);
  const reflectionOn = (day: string): Reflection | null => {
    const r = rows?.find((row) => row.day === day);
    return r ? { notes: r.notes, carried: r.carried_task_ids.length } : null;
  };

  const todayReflection = reflectionOn(ctx.today);
  const open = reflectionOpen(new Date(), ctx.timezone, ctx.rolloverHour);

  const [tonight, missed] = await Promise.all([
    todayReflection || open ? loadWrapUp(ctx, "today", ctx.today, ctx.tomorrow, todayReflection) : null,
    reflectionOn(yesterday) ? null : loadWrapUp(ctx, "yesterday", yesterday, ctx.today, null),
  ]);
  return { tonight, yesterday: missed && missed.unfinished.length > 0 ? missed : null };
}

async function loadWrapUp(
  ctx: DayContext,
  kind: WrapUpDay,
  day: string,
  nextDay: string,
  reflection: Reflection | null,
): Promise<WrapUp> {
  const [missions, next, xp, sessions] = await Promise.all([
    listMissions(ctx, day),
    listMissions(ctx, nextDay),
    getDayXp(ctx, day),
    endedSessionsOn(ctx, day),
  ]);
  const focusMs = sessions.reduce((sum, s) => sum + s.focusedMs, 0);
  return {
    day: kind,
    dayLabel: formatDayLabel(day),
    summary: {
      done: missions.filter((m) => m.status === "done").length,
      total: missions.length,
      xp: xp.total,
      focusMinutes: Math.floor(focusMs / 60_000),
      focusSessions: sessions.filter((s) => s.outcome === "completed").length,
    },
    unfinished: missions.filter((m) => m.status !== "done" && m.status !== "dropped"),
    nextDayMinutes: next.reduce((sum, m) => sum + m.estimatedMinutes, 0),
    reflection,
  };
}
