import { describe, expect, it } from "vitest";
import { dayKey } from "./day";

const NY = "America/New_York";

describe("dayKey", () => {
  it("counts time before the 04:00 rollover toward the previous day", () => {
    // 03:30 in New York (EST, UTC−5)
    expect(dayKey(new Date("2026-11-18T08:30:00Z"), NY)).toBe("2026-11-17");
    // 04:30 in New York
    expect(dayKey(new Date("2026-11-18T09:30:00Z"), NY)).toBe("2026-11-18");
  });

  it("uses plain midnight when the rollover hour is 0", () => {
    expect(dayKey(new Date("2026-11-18T08:30:00Z"), NY, 0)).toBe("2026-11-18");
  });

  it("depends on the user's time zone", () => {
    const instant = new Date("2026-11-18T12:00:00Z");
    expect(dayKey(instant, "Asia/Tokyo")).toBe("2026-11-18"); // 21:00
    expect(dayKey(instant, "Pacific/Honolulu")).toBe("2026-11-17"); // 02:00, before rollover
    expect(dayKey(new Date("2026-11-18T14:00:00Z"), "Pacific/Honolulu")).toBe("2026-11-18"); // 04:00
  });

  it("rejects rollover hours outside 0–6", () => {
    expect(() => dayKey(new Date(), NY, 7)).toThrow(RangeError);
    expect(() => dayKey(new Date(), NY, -1)).toThrow(RangeError);
  });
});
