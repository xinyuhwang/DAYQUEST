import { describe, expect, it } from "vitest";
import { formatDayLabel, formatMinutes } from "./format";

describe("formatDayLabel", () => {
  it("formats a day key without shifting the date", () => {
    expect(formatDayLabel("2026-11-18")).toBe("Wednesday, November 18");
    expect(formatDayLabel("2027-01-01")).toBe("Friday, January 1");
  });
});

describe("formatMinutes", () => {
  it("formats hours and minutes", () => {
    expect(formatMinutes(163)).toBe("2h 43m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(240)).toBe("4h");
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(-5)).toBe("0m");
  });
});
