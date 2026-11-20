import { describe, expect, it } from "vitest";
import { parseMissionForm } from "./validate";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

const valid = {
  title: "  Finish   PhD application revisions ",
  category: "deep_work",
  importance: "critical",
  difficulty: "hard",
  estMinutes: "90",
  day: "today",
};

describe("parseMissionForm", () => {
  it("accepts a valid mission and tidies the title", () => {
    expect(parseMissionForm(form(valid))).toEqual({
      ok: true,
      value: {
        title: "Finish PhD application revisions",
        category: "deep_work",
        importance: "critical",
        difficulty: "hard",
        estMinutes: 90,
        day: "today",
      },
    });
  });

  it("defaults the day to today", () => {
    const rest: Record<string, string> = { ...valid };
    delete rest.day;
    const result = parseMissionForm(form(rest));
    expect(result.ok && result.value.day).toBe("today");
  });

  it("reports every invalid field at once", () => {
    const result = parseMissionForm(
      form({ title: "   ", category: "chores", importance: "urgent", difficulty: "epic", estMinutes: "0", day: "friday" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ["category", "day", "difficulty", "estMinutes", "importance", "title"].sort(),
      );
    }
  });

  it("rejects non-integer and out-of-range durations", () => {
    for (const estMinutes of ["601", "12.5", "-5", "abc", ""]) {
      const result = parseMissionForm(form({ ...valid, estMinutes }));
      expect(result.ok, estMinutes).toBe(false);
    }
    expect(parseMissionForm(form({ ...valid, estMinutes: "600" })).ok).toBe(true);
  });

  it("rejects overly long titles", () => {
    expect(parseMissionForm(form({ ...valid, title: "x".repeat(201) })).ok).toBe(false);
  });
});
