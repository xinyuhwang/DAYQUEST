/**
 * Daily capacity (docs/DESIGN.md §7). Energy and focus change how much work is
 * recommended, never how much XP finished work earns.
 *
 * The multipliers are product heuristics, to be calibrated with real data.
 */
import type { Rating } from "./types";

export const ENERGY_MULTIPLIER: Record<Rating, number> = {
  1: 0.55,
  2: 0.7,
  3: 0.85,
  4: 1.0,
  5: 1.1,
};

export const FOCUS_MULTIPLIER: Record<Rating, number> = {
  1: 0.8,
  2: 0.9,
  3: 1.0,
  4: 1.05,
  5: 1.1,
};

/** Share of the recommended workload suited to deep work, by focus rating. */
export const DEEP_WORK_SHARE: Record<Rating, number> = {
  1: 0.4,
  2: 0.55,
  3: 0.7,
  4: 0.75,
  5: 0.8,
};

/** Recommended workload is this fraction of capacity; the rest is buffer. */
export const RECOMMENDED_FRACTION = 0.8;

/** Standard focus-session length used to express workload in sessions. */
export const SESSION_MINUTES = 25;

export interface CapacityInput {
  /** Focus minutes the user says they have available. */
  availableMinutes: number;
  energy: Rating;
  focus: Rating;
}

export interface CapacityResult {
  /** min(T, T × E × F) */
  capacityMinutes: number;
  /** capacity × 0.8 */
  recommendedMinutes: number;
  deepWorkMinutes: number;
  lightWorkMinutes: number;
  bufferMinutes: number;
  /**
   * Available time not counted as capacity because energy or focus is below
   * par (available − capacity). With it, deep + light + buffer + set aside = available.
   */
  setAsideMinutes: number;
  /** Whole 25-minute sessions that fit in the recommended workload. */
  focusSessions: number;
}

export function calculateCapacity({ availableMinutes, energy, focus }: CapacityInput): CapacityResult {
  const t = Math.max(0, availableMinutes);
  const capacityMinutes = Math.round(
    Math.min(t, t * ENERGY_MULTIPLIER[energy] * FOCUS_MULTIPLIER[focus]),
  );
  const recommendedMinutes = Math.round(capacityMinutes * RECOMMENDED_FRACTION);
  const deepWorkMinutes = Math.round(recommendedMinutes * DEEP_WORK_SHARE[focus]);
  return {
    capacityMinutes,
    recommendedMinutes,
    deepWorkMinutes,
    lightWorkMinutes: recommendedMinutes - deepWorkMinutes,
    bufferMinutes: capacityMinutes - recommendedMinutes,
    setAsideMinutes: t - capacityMinutes,
    focusSessions: Math.floor(recommendedMinutes / SESSION_MINUTES),
  };
}

/** The ratings that lower capacity below the time available (multiplier under 1). */
export function capacityLimiters(energy: Rating, focus: Rating): ("energy" | "focus")[] {
  const limits: ("energy" | "focus")[] = [];
  if (ENERGY_MULTIPLIER[energy] < 1) limits.push("energy");
  if (FOCUS_MULTIPLIER[focus] < 1) limits.push("focus");
  return limits;
}

export interface LoadCheck {
  overloaded: boolean;
  /** Planned minutes beyond the recommendation (0 when not overloaded). */
  overByMinutes: number;
}

export function checkLoad(plannedMinutes: number, recommendedMinutes: number): LoadCheck {
  const over = Math.max(0, plannedMinutes - recommendedMinutes);
  return { overloaded: over > 0, overByMinutes: over };
}
