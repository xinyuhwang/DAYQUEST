/** Leveling curve and companion evolution (docs/DESIGN.md §6). */

/** XP needed to go from level L to L+1: 100 + 25(L−1) + 3(L−1)². */
export function xpToNextLevel(level: number): number {
  const n = level - 1;
  return 100 + 25 * n + 3 * n * n;
}

/** Total XP required to reach level L (level 1 = 0 XP). */
export function totalXpForLevel(level: number): number {
  const n = Math.max(0, level - 1);
  return 100 * n + 12.5 * n * (n - 1) + 0.5 * n * (n - 1) * (2 * n - 1);
}

export interface LevelState {
  level: number;
  /** XP earned since reaching the current level. */
  xpIntoLevel: number;
  /** XP needed for the next level, counted from the start of this one. */
  xpForNextLevel: number;
  /** 0–1 progress toward the next level. */
  progress: number;
}

/** Derives the level from total XP. Level is never stored as truth (§5.5). */
export function levelFromTotalXp(totalXp: number): LevelState {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (totalXpForLevel(level + 1) <= xp) level++;
  const xpIntoLevel = xp - totalXpForLevel(level);
  const xpForNextLevel = xpToNextLevel(level);
  return { level, xpIntoLevel, xpForNextLevel, progress: xpIntoLevel / xpForNextLevel };
}

export type EvolutionStage = 1 | 2 | 3 | 4;

export const EVOLUTION_LEVELS: Record<EvolutionStage, number> = {
  1: 1,
  2: 5,
  3: 15,
  4: 30,
};

export const EVOLUTION_NAMES: Record<EvolutionStage, string> = {
  1: "Hatchling",
  2: "Young",
  3: "Guardian",
  4: "Legendary",
};

export function evolutionStage(level: number): EvolutionStage {
  if (level >= EVOLUTION_LEVELS[4]) return 4;
  if (level >= EVOLUTION_LEVELS[3]) return 3;
  if (level >= EVOLUTION_LEVELS[2]) return 2;
  return 1;
}
