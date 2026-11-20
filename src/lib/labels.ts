import type { Category, Difficulty, Importance, Mood, Rating } from "@/engine";

export const CATEGORY_LABEL: Record<Category, string> = {
  deep_work: "Deep Work",
  research: "Research",
  learning: "Learning",
  writing: "Writing",
  admin: "Admin",
  wellness: "Wellness",
  other: "Other",
};

export const IMPORTANCE_LABEL: Record<Importance, string> = {
  optional: "Optional",
  normal: "Normal",
  important: "Important",
  critical: "Critical",
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];
export const IMPORTANCES = Object.keys(IMPORTANCE_LABEL) as Importance[];
export const DIFFICULTIES = Object.keys(DIFFICULTY_LABEL) as Difficulty[];

/** Duration presets from DESIGN.md §4; any 1–600 minute value is allowed. */
export const DURATION_PRESETS = [15, 30, 60, 90] as const;

export const ENERGY_LABEL: Record<Rating, string> = { 1: "Drained", 2: "Low", 3: "Okay", 4: "Good", 5: "Vibrant" };
export const FOCUS_LABEL: Record<Rating, string> = { 1: "Foggy", 2: "Scattered", 3: "Steady", 4: "Sharp", 5: "Clear" };
export const RATINGS = [1, 2, 3, 4, 5] as const satisfies readonly Rating[];

export const MOOD_LABEL: Record<Mood, string> = {
  great: "Great",
  calm: "Calm",
  neutral: "Neutral",
  tired: "Tired",
  anxious: "Anxious",
  low: "Low",
};
export const MOOD_EMOJI: Record<Mood, string> = {
  great: "😄",
  calm: "😌",
  neutral: "😐",
  tired: "🥱",
  anxious: "😟",
  low: "😔",
};
export const MOODS = Object.keys(MOOD_LABEL) as Mood[];

/** Available-time slider (§7.1): 30 min steps up to 10 h. */
export const AVAILABLE_MIN = { min: 30, max: 600, step: 30 } as const;
