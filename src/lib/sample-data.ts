/**
 * Sample data for the Phase 0 Today prototype. Replaced by real persistence
 * in Phase 1; nothing here is saved.
 */
import type { Category, Difficulty, Importance, Rating } from "@/engine";

export interface Mission {
  id: string;
  title: string;
  category: Category;
  importance: Importance;
  difficulty: Difficulty;
  estimatedMinutes: number;
}

export const SAMPLE_MISSIONS: Mission[] = [
  {
    id: "m1",
    title: "Finish PhD application revisions",
    category: "deep_work",
    importance: "critical",
    difficulty: "hard",
    estimatedMinutes: 90,
  },
  {
    id: "m2",
    title: "Review liver tumor segmentation paper",
    category: "research",
    importance: "important",
    difficulty: "medium",
    estimatedMinutes: 60,
  },
  {
    id: "m3",
    title: "Practice machine learning concepts",
    category: "learning",
    importance: "normal",
    difficulty: "medium",
    estimatedMinutes: 45,
  },
  {
    id: "m4",
    title: "Exercise or take a walk",
    category: "wellness",
    importance: "optional",
    difficulty: "easy",
    estimatedMinutes: 30,
  },
  {
    id: "m5",
    title: "Read one research paper",
    category: "learning",
    importance: "normal",
    difficulty: "easy",
    estimatedMinutes: 30,
  },
  {
    id: "m6",
    title: "Reply to advisor's email",
    category: "admin",
    importance: "normal",
    difficulty: "easy",
    estimatedMinutes: 10,
  },
];

export const SAMPLE_CHECKIN: { availableMinutes: number; energy: Rating; focus: Rating } = {
  availableMinutes: 240,
  energy: 3,
  focus: 3,
};

/** Lifetime XP before today, so the level bar has something to show. */
export const SAMPLE_PRIOR_XP = 140;

/** Focus sessions already completed today (25 min each, linked to missions). */
export const SAMPLE_FOCUS_SESSIONS_DONE = 2;

export const CATEGORY_LABEL: Record<Category, string> = {
  deep_work: "Deep Work",
  research: "Research",
  learning: "Learning",
  writing: "Writing",
  admin: "Admin",
  wellness: "Wellness",
  other: "Other",
};
