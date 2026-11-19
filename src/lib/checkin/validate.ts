/** Validation for the check-in form. Pure, so it's shared by tests and server actions. */
import type { Mood, Rating } from "@/engine";
import { AVAILABLE_MIN, MOODS } from "@/lib/labels";

export interface CheckinFields {
  energy: Rating;
  focus: Rating;
  mood: Mood | null;
  availableMinutes: number;
}

export type CheckinErrors = Partial<Record<keyof CheckinFields, string>>;

export type CheckinParse = { ok: true; value: CheckinFields } | { ok: false; errors: CheckinErrors };

function rating(value: FormDataEntryValue | null): Rating | null {
  const s = String(value ?? "");
  return /^[1-5]$/.test(s) ? (Number(s) as Rating) : null;
}

export function parseCheckinForm(form: FormData): CheckinParse {
  const errors: CheckinErrors = {};

  const energy = rating(form.get("energy"));
  if (!energy) errors.energy = "Pick how your energy feels.";

  const focus = rating(form.get("focus"));
  if (!focus) errors.focus = "Pick how focused you feel.";

  // Mood is optional (§7.1).
  const rawMood = String(form.get("mood") ?? "");
  const mood = rawMood === "" ? null : (MOODS as string[]).includes(rawMood) ? (rawMood as Mood) : undefined;
  if (mood === undefined) errors.mood = "Pick a mood or skip it.";

  const raw = String(form.get("availableMinutes") ?? "");
  const availableMinutes = /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!(availableMinutes >= AVAILABLE_MIN.min && availableMinutes <= AVAILABLE_MIN.max)) {
    errors.availableMinutes = "Choose between 30 minutes and 10 hours.";
  }

  if (Object.keys(errors).length > 0 || !energy || !focus || mood === undefined) return { ok: false, errors };
  return { ok: true, value: { energy, focus, mood, availableMinutes } };
}
