/** Shared domain types for the DAYQUEST engine (see docs/DESIGN.md §4–§7). */

export type Difficulty = "easy" | "medium" | "hard";

export type Importance = "optional" | "normal" | "important" | "critical";

/** How a mission ended. "abandoned" earns nothing and creates no transaction. */
export type Completion = "completed" | "partial" | "abandoned";

/** 1–5 self-rating used for energy and focus in the morning check-in. */
export type Rating = 1 | 2 | 3 | 4 | 5;

/** Optional check-in mood. Affects coach tone only, never capacity or XP. */
export type Mood = "great" | "calm" | "neutral" | "tired" | "anxious" | "low";

export type Category =
  | "deep_work"
  | "research"
  | "learning"
  | "writing"
  | "admin"
  | "wellness"
  | "other";

export interface MissionInput {
  difficulty: Difficulty;
  importance: Importance;
  /** Estimated duration in minutes, as entered by the user. */
  estimatedMinutes: number;
}
