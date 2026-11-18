import { describe, expect, it } from "vitest";
import { calculateCapacity, checkLoad } from "./capacity";

describe("calculateCapacity", () => {
  it("reproduces the §7.2 worked example (energy 3, focus 3, 4 h)", () => {
    expect(calculateCapacity({ availableMinutes: 240, energy: 3, focus: 3 })).toEqual({
      capacityMinutes: 204,
      recommendedMinutes: 163,
      deepWorkMinutes: 114,
      lightWorkMinutes: 49,
      bufferMinutes: 41,
      focusSessions: 6,
    });
  });

  it("never promises more time than is available (5/5 multiplies to 1.21)", () => {
    const result = calculateCapacity({ availableMinutes: 240, energy: 5, focus: 5 });
    expect(result.capacityMinutes).toBe(240);
    expect(result.recommendedMinutes).toBe(192);
  });

  it("shrinks deep work on a foggy day", () => {
    const foggy = calculateCapacity({ availableMinutes: 240, energy: 3, focus: 1 });
    const clear = calculateCapacity({ availableMinutes: 240, energy: 3, focus: 3 });
    expect(foggy.deepWorkMinutes / foggy.recommendedMinutes).toBeLessThan(
      clear.deepWorkMinutes / clear.recommendedMinutes,
    );
  });

  it("handles a low-energy short day", () => {
    const result = calculateCapacity({ availableMinutes: 120, energy: 1, focus: 1 });
    expect(result.capacityMinutes).toBe(53);
    expect(result.recommendedMinutes).toBe(42);
    expect(result.focusSessions).toBe(1);
  });

  it("treats negative availability as zero", () => {
    expect(calculateCapacity({ availableMinutes: -30, energy: 3, focus: 3 }).recommendedMinutes).toBe(0);
  });
});

describe("checkLoad", () => {
  it("flags plans above the recommendation", () => {
    expect(checkLoad(255, 163)).toEqual({ overloaded: true, overByMinutes: 92 });
    expect(checkLoad(163, 163)).toEqual({ overloaded: false, overByMinutes: 0 });
  });
});
