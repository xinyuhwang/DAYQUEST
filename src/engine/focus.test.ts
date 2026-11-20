import { describe, expect, it } from "vitest";
import { breakMinutes, focusedMs, remainingMs } from "./focus";

describe("breakMinutes", () => {
  it("uses the preset pairs 25/5 and 50/10", () => {
    expect(breakMinutes(25, 1)).toBe(5);
    expect(breakMinutes(50, 2)).toBe(10);
  });

  it("gives a long break after every 4th completed session", () => {
    expect(breakMinutes(25, 4)).toBe(15);
    expect(breakMinutes(25, 8)).toBe(15);
    expect(breakMinutes(25, 0)).toBe(5);
  });

  it("scales custom sessions to a fifth, from 5 to 15 minutes", () => {
    expect(breakMinutes(15, 1)).toBe(5);
    expect(breakMinutes(40, 1)).toBe(8);
    expect(breakMinutes(120, 1)).toBe(15);
  });
});

describe("focus clock", () => {
  const start = 1_000_000;
  const clock = { plannedMinutes: 25, startedAt: start, pausedMs: 0, pausedAt: null };

  it("counts down from the planned length", () => {
    expect(remainingMs(clock, start)).toBe(25 * 60_000);
    expect(remainingMs(clock, start + 10 * 60_000)).toBe(15 * 60_000);
    expect(remainingMs(clock, start + 30 * 60_000)).toBe(0);
  });

  it("doesn't count finished or running pauses", () => {
    const paused = { ...clock, pausedMs: 2 * 60_000, pausedAt: start + 10 * 60_000 };
    // 15 min wall time: 2 min earlier pause + 5 min current pause → 8 min focused.
    expect(focusedMs(paused, start + 15 * 60_000)).toBe(8 * 60_000);
  });
});
