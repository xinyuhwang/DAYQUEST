import { describe, expect, it } from "vitest";
import { parseCheckinForm } from "./validate";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("parseCheckinForm", () => {
  it("accepts a full check-in", () => {
    expect(parseCheckinForm(form({ energy: "3", focus: "4", mood: "calm", availableMinutes: "240" }))).toEqual({
      ok: true,
      value: { energy: 3, focus: 4, mood: "calm", availableMinutes: 240 },
    });
  });

  it("lets mood be skipped", () => {
    const r = parseCheckinForm(form({ energy: "1", focus: "1", mood: "", availableMinutes: "30" }));
    expect(r.ok && r.value.mood).toBeNull();
  });

  it("rejects out-of-range or made-up values", () => {
    const r = parseCheckinForm(form({ energy: "6", focus: "0", mood: "furious", availableMinutes: "601" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["availableMinutes", "energy", "focus", "mood"]);
  });

  it("requires energy, focus and time", () => {
    const r = parseCheckinForm(form({}));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["availableMinutes", "energy", "focus"]);
  });
});
