/** Parsing for the evening wrap-up form (DESIGN.md §3 step 8). */

export const NOTES_MAX = 5000;
const MAX_CARRY = 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Which day is being wrapped up: tonight, or a missed yesterday. */
export type WrapUpDay = "today" | "yesterday";

export interface WrapUpInput {
  day: WrapUpDay;
  notes: string;
  carry: string[];
}

export type WrapUpParse = { ok: true; value: WrapUpInput } | { ok: false; error: string };

export function parseWrapUpForm(form: FormData): WrapUpParse {
  const day = form.get("day");
  if (day !== "today" && day !== "yesterday") return { ok: false, error: "Something went wrong. Please reload." };

  const rawNotes = form.get("notes");
  const notes = typeof rawNotes === "string" ? rawNotes.trim() : "";
  if (notes.length > NOTES_MAX) return { ok: false, error: `Keep notes under ${NOTES_MAX} characters.` };

  const carry = [...new Set(form.getAll("carry"))];
  if (carry.length > MAX_CARRY || !carry.every((id) => typeof id === "string" && UUID_RE.test(id))) {
    return { ok: false, error: "Something went wrong. Please reload." };
  }
  return { ok: true, value: { day, notes, carry: carry as string[] } };
}
