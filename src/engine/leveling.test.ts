import { describe, expect, it } from "vitest";
import { evolutionStage, levelFromTotalXp, totalXpForLevel, xpToNextLevel } from "./leveling";

describe("xpToNextLevel", () => {
  it("matches the §6.1 table", () => {
    expect([1, 2, 3, 5, 10, 15, 20, 30].map(xpToNextLevel)).toEqual([
      100, 128, 162, 248, 568, 1038, 1658, 3348,
    ]);
  });
});

describe("totalXpForLevel", () => {
  it("matches the §6.1 table", () => {
    expect([1, 2, 3, 5, 10, 15, 20, 30].map(totalXpForLevel)).toEqual([
      0, 100, 228, 592, 2412, 6132, 12502, 36192,
    ]);
  });

  it("agrees with summing xpToNextLevel", () => {
    let sum = 0;
    for (let level = 1; level <= 60; level++) {
      expect(totalXpForLevel(level)).toBe(sum);
      sum += xpToNextLevel(level);
    }
  });
});

describe("levelFromTotalXp", () => {
  it("starts at level 1 with no XP", () => {
    expect(levelFromTotalXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100, progress: 0 });
  });

  it("levels up exactly at each threshold", () => {
    expect(levelFromTotalXp(99).level).toBe(1);
    expect(levelFromTotalXp(100).level).toBe(2);
    expect(levelFromTotalXp(591).level).toBe(4);
    expect(levelFromTotalXp(592).level).toBe(5);
    expect(levelFromTotalXp(36192).level).toBe(30);
  });

  it("reports progress within the current level", () => {
    const state = levelFromTotalXp(164);
    expect(state.level).toBe(2);
    expect(state.xpIntoLevel).toBe(64);
    expect(state.xpForNextLevel).toBe(128);
    expect(state.progress).toBe(0.5);
  });

  it("treats negative totals as zero", () => {
    expect(levelFromTotalXp(-50).level).toBe(1);
  });
});

describe("evolutionStage", () => {
  it("evolves at levels 1 / 5 / 15 / 30", () => {
    expect([1, 4, 5, 14, 15, 29, 30, 80].map(evolutionStage)).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });
});
