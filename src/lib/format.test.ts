import { describe, expect, it } from "vitest";
import { formatMinutes } from "./format";

describe("formatMinutes", () => {
  it("formats hours and minutes", () => {
    expect(formatMinutes(163)).toBe("2h 43m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(240)).toBe("4h");
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(-5)).toBe("0m");
  });
});
