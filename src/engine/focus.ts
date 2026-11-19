/** Focus timer rules (docs/DESIGN.md §8.1). Pure, so client and server agree. */

/** Session length → short break, for the two presets. */
export const FOCUS_PRESETS = [
  { focusMinutes: 25, breakMinutes: 5 },
  { focusMinutes: 50, breakMinutes: 10 },
] as const;

export const CUSTOM_FOCUS_RANGE = { min: 5, max: 180 } as const;
export const LONG_BREAK_EVERY = 4;
export const LONG_BREAK_MINUTES = 15;

/**
 * Break after a session. Every 4th completed session today earns a long
 * break. Custom lengths get a fifth of the session, between 5 and 15 minutes.
 */
export function breakMinutes(focusMinutes: number, completedToday: number): number {
  if (completedToday > 0 && completedToday % LONG_BREAK_EVERY === 0) {
    return Math.max(LONG_BREAK_MINUTES, breakMinutes(focusMinutes, 0));
  }
  const preset = FOCUS_PRESETS.find((p) => p.focusMinutes === focusMinutes);
  if (preset) return preset.breakMinutes;
  return Math.min(15, Math.max(5, Math.round(focusMinutes / 5)));
}

export interface FocusClock {
  plannedMinutes: number;
  startedAt: number;
  /** Finished pauses, in ms. */
  pausedMs: number;
  /** Start of the pause in progress, if any. */
  pausedAt: number | null;
}

/** Focused time so far, excluding pauses. */
export function focusedMs(clock: FocusClock, now: number): number {
  const paused = clock.pausedMs + (clock.pausedAt === null ? 0 : Math.max(0, now - clock.pausedAt));
  return Math.max(0, now - clock.startedAt - paused);
}

export function remainingMs(clock: FocusClock, now: number): number {
  return Math.max(0, clock.plannedMinutes * 60_000 - focusedMs(clock, now));
}
