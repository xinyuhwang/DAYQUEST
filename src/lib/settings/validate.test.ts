import { describe, expect, it } from "vitest";
import { DAY_SETTINGS_COOLDOWN_MS, nextChangeAt, parseDaySettings, rolloverLabel } from "./validate";

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
};

describe("parseDaySettings", () => {
  it("accepts a real time zone and an hour from 0 to 6", () => {
    expect(parseDaySettings(form({ timezone: "Asia/Tokyo", rolloverHour: "0" }))).toEqual({
      ok: true,
      value: { timezone: "Asia/Tokyo", rolloverHour: 0 },
    });
    expect(parseDaySettings(form({ timezone: "America/New_York", rolloverHour: "6" })).ok).toBe(true);
  });

  it("rejects unknown zones and out-of-range hours", () => {
    expect(parseDaySettings(form({ timezone: "Mars/Olympus", rolloverHour: "4" })).ok).toBe(false);
    expect(parseDaySettings(form({ timezone: "UTC", rolloverHour: "7" })).ok).toBe(false);
    expect(parseDaySettings(form({ timezone: "UTC", rolloverHour: "-1" })).ok).toBe(false);
    expect(parseDaySettings(form({ timezone: "UTC", rolloverHour: "4.5" })).ok).toBe(false);
  });
});

describe("nextChangeAt", () => {
  const changed = "2026-11-20T10:00:00.000Z";
  const at = Date.parse(changed);

  it("is open when never changed or after the cooldown", () => {
    expect(nextChangeAt(null, at)).toBeNull();
    expect(nextChangeAt(changed, at + DAY_SETTINGS_COOLDOWN_MS)).toBeNull();
  });

  it("is closed for 24 hours after a change", () => {
    expect(nextChangeAt(changed, at + 60_000)).toBe(at + DAY_SETTINGS_COOLDOWN_MS);
  });
});

describe("rolloverLabel", () => {
  it("names the hours", () => {
    expect(rolloverLabel(0)).toBe("Midnight");
    expect(rolloverLabel(4)).toBe("4 AM");
  });
});
