/**
 * XP rules (docs/DESIGN.md §5). Pure functions only: callers decide when to
 * record the resulting amounts as `xp_transactions`.
 */
import type { Completion, Difficulty, Importance, MissionInput } from "./types";

export const BASE_TASK_XP = 20;

export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 1.0,
  medium: 1.5,
  hard: 2.0,
};

export const IMPORTANCE_MULTIPLIER: Record<Importance, number> = {
  optional: 0.8,
  normal: 1.0,
  important: 1.15,
  critical: 1.3,
};

export const COMPLETION_MULTIPLIER: Record<Completion, number> = {
  completed: 1.0,
  partial: 0.5,
  abandoned: 0,
};

/** Missions estimated under this many minutes earn half task XP. */
export const QUICK_TASK_THRESHOLD_MIN = 15;
export const QUICK_TASK_MULTIPLIER = 0.5;

/** XP_task = B × D × I × C × Q, rounded to the nearest integer. */
export function taskXp(mission: MissionInput, completion: Completion): number {
  const quick =
    mission.estimatedMinutes < QUICK_TASK_THRESHOLD_MIN ? QUICK_TASK_MULTIPLIER : 1;
  return Math.round(
    BASE_TASK_XP *
      DIFFICULTY_MULTIPLIER[mission.difficulty] *
      IMPORTANCE_MULTIPLIER[mission.importance] *
      COMPLETION_MULTIPLIER[completion] *
      quick,
  );
}

// ---------------------------------------------------------------------------
// Focus XP (§5.2)
// ---------------------------------------------------------------------------

/** 10 XP per 25 focused minutes. */
export const FOCUS_XP_PER_MINUTE = 10 / 25;
export const FOCUS_MIN_SESSION_MIN = 10;
export const FOCUS_EARLY_END_XP = 5;
export const FOCUS_EARLY_END_MIN_FRACTION = 0.5;
export const FOCUS_DAILY_CAP = 120;

export interface FocusSessionInput {
  /** Mission the session was linked to. Unlinked sessions earn nothing. */
  taskId: string | null;
  /** Session length the user chose (25, 50 or custom). */
  plannedMinutes: number;
  /** Focused minutes actually elapsed, excluding pauses, as verified by the server. */
  focusedMinutes: number;
}

/** XP for one focus session, before the daily cap is applied. */
export function focusSessionXp(session: FocusSessionInput): number {
  const { taskId, plannedMinutes, focusedMinutes } = session;
  if (!taskId || plannedMinutes < FOCUS_MIN_SESSION_MIN) return 0;

  if (focusedMinutes >= plannedMinutes) {
    return Math.round(plannedMinutes * FOCUS_XP_PER_MINUTE);
  }
  if (focusedMinutes >= plannedMinutes * FOCUS_EARLY_END_MIN_FRACTION) {
    return FOCUS_EARLY_END_XP;
  }
  return 0;
}

/** Trims an award so the day's focus XP never exceeds the daily cap. */
export function applyFocusCap(award: number, focusXpEarnedToday: number): number {
  const room = Math.max(0, FOCUS_DAILY_CAP - focusXpEarnedToday);
  return Math.min(Math.max(0, award), room);
}

// ---------------------------------------------------------------------------
// Bonus XP (§5.3)
// ---------------------------------------------------------------------------

export type DailyBonusCode =
  | "all_critical"
  | "xp_target"
  | "two_focus_sessions"
  | "reflection";

export const DAILY_BONUS_XP: Record<DailyBonusCode, number> = {
  all_critical: 30,
  xp_target: 20,
  two_focus_sessions: 15,
  reflection: 10,
};

/** Awarded once per milestone, not per day. */
export const MILESTONE_BONUS_XP = 50;

export interface DayProgress {
  criticalPlanned: number;
  criticalCompleted: number;
  /** Task XP + focus XP earned today. Bonuses are excluded to avoid circularity. */
  earnedXp: number;
  xpTarget: number;
  completedFocusSessions: number;
  reflectionDone: boolean;
}

/**
 * Daily bonuses the day currently qualifies for. Each code can be claimed once
 * per day; the uniqueness constraint on xp_transactions enforces that.
 */
export function qualifyingDailyBonuses(day: DayProgress): DailyBonusCode[] {
  const codes: DailyBonusCode[] = [];
  if (day.criticalPlanned >= 1 && day.criticalCompleted >= day.criticalPlanned) {
    codes.push("all_critical");
  }
  if (day.xpTarget > 0 && day.earnedXp >= day.xpTarget) codes.push("xp_target");
  if (day.completedFocusSessions >= 2) codes.push("two_focus_sessions");
  if (day.reflectionDone) codes.push("reflection");
  return codes;
}

/** Daily XP target: 1 XP per recommended minute, rounded to the nearest 10. */
export function dailyXpTarget(recommendedMinutes: number): number {
  return Math.max(10, Math.round(recommendedMinutes / 10) * 10);
}

/** After a mid-day re-check-in the target may drop, never rise. */
export function adjustedXpTarget(currentTarget: number, recalculated: number): number {
  return Math.min(currentTarget, recalculated);
}

/**
 * The day's XP target after a check-in (§7.4). The first check-in sets it from
 * the recommended workload. A re-check-in recalculates from the time left, so
 * the new target is what's already earned plus the target for the rest of the
 * day, and it can only lower the current target.
 */
export function targetAfterCheckin(
  recommendedMinutes: number,
  previous?: { target: number; earnedSoFar: number },
): number {
  const fresh = dailyXpTarget(recommendedMinutes);
  if (!previous) return fresh;
  return adjustedXpTarget(previous.target, previous.earnedSoFar + fresh);
}
