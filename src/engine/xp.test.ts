import { describe, expect, it } from "vitest";
import {
  adjustedXpTarget,
  applyFocusCap,
  dailyXpTarget,
  focusSessionXp,
  qualifyingDailyBonuses,
  targetAfterCheckin,
  taskXp,
  type DayProgress,
} from "./xp";
import type { MissionInput } from "./types";

const mission = (m: Partial<MissionInput> = {}): MissionInput => ({
  difficulty: "easy",
  importance: "normal",
  estimatedMinutes: 30,
  ...m,
});

describe("taskXp", () => {
  it("matches the design-doc range: 16 (easy/optional) to 52 (hard/critical)", () => {
    expect(taskXp(mission({ importance: "optional" }), "completed")).toBe(16);
    expect(taskXp(mission({ difficulty: "hard", importance: "critical" }), "completed")).toBe(52);
  });

  it("computes the typical-day missions from §5.4", () => {
    expect(taskXp(mission({ difficulty: "medium", importance: "important" }), "completed")).toBe(35);
    expect(taskXp(mission({ difficulty: "medium" }), "completed")).toBe(30);
    expect(taskXp(mission(), "completed")).toBe(20);
  });

  it("halves partial completion and gives nothing for abandoned", () => {
    const hard = mission({ difficulty: "hard", importance: "critical" });
    expect(taskXp(hard, "partial")).toBe(26);
    expect(taskXp(hard, "abandoned")).toBe(0);
  });

  it("halves quick tasks under 15 minutes, so five 5-min tasks earn 50", () => {
    const quick = mission({ estimatedMinutes: 5 });
    expect(taskXp(quick, "completed")).toBe(10);
    expect(5 * taskXp(quick, "completed")).toBe(50);
    expect(taskXp(mission({ estimatedMinutes: 15 }), "completed")).toBe(20);
  });
});

describe("focusSessionXp", () => {
  const linked = { taskId: "t1" };

  it("awards 10 per completed 25 min and 20 per completed 50 min", () => {
    expect(focusSessionXp({ ...linked, plannedMinutes: 25, focusedMinutes: 25 })).toBe(10);
    expect(focusSessionXp({ ...linked, plannedMinutes: 50, focusedMinutes: 50 })).toBe(20);
  });

  it("awards custom sessions proportionally, only from 10 minutes", () => {
    expect(focusSessionXp({ ...linked, plannedMinutes: 10, focusedMinutes: 10 })).toBe(4);
    expect(focusSessionXp({ ...linked, plannedMinutes: 9, focusedMinutes: 9 })).toBe(0);
    expect(focusSessionXp({ ...linked, plannedMinutes: 40, focusedMinutes: 40 })).toBe(16);
  });

  it("awards 5 for a session ended early with at least half elapsed", () => {
    expect(focusSessionXp({ ...linked, plannedMinutes: 25, focusedMinutes: 13 })).toBe(5);
    expect(focusSessionXp({ ...linked, plannedMinutes: 25, focusedMinutes: 12 })).toBe(0);
  });

  it("gives nothing to sessions not linked to a mission", () => {
    expect(focusSessionXp({ taskId: null, plannedMinutes: 25, focusedMinutes: 25 })).toBe(0);
  });

  it("makes a 2-hour hard critical task out-earn five quick tasks (principle 2)", () => {
    const deep =
      taskXp(mission({ difficulty: "hard", importance: "critical", estimatedMinutes: 120 }), "completed") +
      4 * focusSessionXp({ ...linked, plannedMinutes: 25, focusedMinutes: 25 });
    const quick = 5 * taskXp(mission({ estimatedMinutes: 5 }), "completed");
    expect(deep).toBe(92);
    expect(deep).toBeGreaterThan(quick);
  });
});

describe("applyFocusCap", () => {
  it("caps the day's focus XP at 120", () => {
    expect(applyFocusCap(10, 0)).toBe(10);
    expect(applyFocusCap(20, 110)).toBe(10);
    expect(applyFocusCap(10, 120)).toBe(0);
    expect(applyFocusCap(10, 150)).toBe(0);
  });
});

describe("daily bonuses", () => {
  const base: DayProgress = {
    criticalPlanned: 1,
    criticalCompleted: 1,
    earnedXp: 160,
    xpTarget: 160,
    completedFocusSessions: 2,
    reflectionDone: true,
  };

  it("qualifies for all four when every condition is met", () => {
    expect(qualifyingDailyBonuses(base)).toEqual([
      "all_critical",
      "xp_target",
      "two_focus_sessions",
      "reflection",
    ]);
  });

  it("requires at least one critical mission for the critical bonus", () => {
    expect(qualifyingDailyBonuses({ ...base, criticalPlanned: 0, criticalCompleted: 0 })).not.toContain(
      "all_critical",
    );
    expect(qualifyingDailyBonuses({ ...base, criticalPlanned: 2 })).not.toContain("all_critical");
  });

  it("withholds the target bonus until the target is reached", () => {
    expect(qualifyingDailyBonuses({ ...base, earnedXp: 159 })).not.toContain("xp_target");
  });
});

describe("dailyXpTarget", () => {
  it("is 1 XP per recommended minute, rounded to the nearest 10", () => {
    expect(dailyXpTarget(163)).toBe(160);
    expect(dailyXpTarget(42)).toBe(40);
    expect(dailyXpTarget(2)).toBe(10);
  });

  it("can drop but never rise after a mid-day re-check-in", () => {
    expect(adjustedXpTarget(160, 110)).toBe(110);
    expect(adjustedXpTarget(160, 200)).toBe(160);
  });
});

describe("targetAfterCheckin", () => {
  it("sets the target from the first check-in", () => {
    expect(targetAfterCheckin(163)).toBe(160);
  });

  it("re-check-in: earned so far plus the rest of the day, never higher than before", () => {
    // Earned 70, now 1h left at low energy → 70 + 40.
    expect(targetAfterCheckin(42, { target: 160, earnedSoFar: 70 })).toBe(110);
    // Feeling better doesn't raise the bar.
    expect(targetAfterCheckin(300, { target: 160, earnedSoFar: 70 })).toBe(160);
  });
});
