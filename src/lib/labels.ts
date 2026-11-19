import type { Category, Difficulty, Importance } from "@/engine";

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
