import { describe, expect, it } from "vitest";
import { addDays, dayKey, reflectionOpen } from "./day";

describe("addDays", () => {
  it("moves across month, year and leap-day boundaries", () => {
    expect(addDays("2026-11-18", 1)).toBe("2026-11-19");
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("rejects malformed keys", () => {
    expect(() => addDays("18/11/2026", 1)).toThrow(RangeError);
  });
});

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

describe("reflectionOpen", () => {
  // 2026-11-19 is EST (UTC−5).
  const at = (utc: string) => new Date(`2026-11-19T${utc}Z`);

  it("is closed during the day", () => {
    expect(reflectionOpen(at("14:00:00"), NY)).toBe(false); // 09:00
    expect(reflectionOpen(at("00:59:00"), NY)).toBe(false); // 19:59 (Nov 18)
  });

  it("opens at 20:00 local time", () => {
    expect(reflectionOpen(at("01:00:00"), NY)).toBe(true); // 20:00 (Nov 18)
    expect(reflectionOpen(at("04:30:00"), NY)).toBe(true); // 23:30
  });

  it("stays open past midnight until the rollover hour", () => {
    expect(reflectionOpen(at("08:59:00"), NY)).toBe(true); // 03:59
    expect(reflectionOpen(at("09:00:00"), NY)).toBe(false); // 04:00, a new day
    expect(reflectionOpen(at("06:30:00"), NY, 0)).toBe(false); // 01:30 with midnight rollover
  });
});
