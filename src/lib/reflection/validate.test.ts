import { describe, expect, it } from "vitest";
import { NOTES_MAX, parseWrapUpForm } from "./validate";

const A = "10000000-0000-0000-0000-00000000000a";
const B = "10000000-0000-0000-0000-00000000000b";

function form(entries: [string, string][]) {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
}

describe("parseWrapUpForm", () => {
  it("accepts a day, trimmed notes and carried missions", () => {
    expect(parseWrapUpForm(form([["day", "today"], ["notes", "  good day  "], ["carry", A], ["carry", B]]))).toEqual({
      ok: true,
      value: { day: "today", notes: "good day", carry: [A, B] },
    });
  });

  it("allows no notes and nothing carried", () => {
    expect(parseWrapUpForm(form([["day", "yesterday"]]))).toEqual({
      ok: true,
      value: { day: "yesterday", notes: "", carry: [] },
    });
  });

  it("drops duplicate mission ids", () => {
    const r = parseWrapUpForm(form([["day", "today"], ["carry", A], ["carry", A]]));
    expect(r.ok && r.value.carry).toEqual([A]);
  });

  it("rejects an unknown day, bad ids and overlong notes", () => {
    expect(parseWrapUpForm(form([["day", "2026-11-18"]])).ok).toBe(false);
    expect(parseWrapUpForm(form([["day", "today"], ["carry", "not-a-uuid"]])).ok).toBe(false);
    expect(parseWrapUpForm(form([["day", "today"], ["notes", "x".repeat(NOTES_MAX + 1)]])).ok).toBe(false);
  });
});
