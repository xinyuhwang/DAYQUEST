/** Validation for mission forms. Pure, so it's shared by tests and server actions. */
import type { Category, Difficulty, Importance } from "@/engine";
import { CATEGORIES, DIFFICULTIES, IMPORTANCES } from "@/lib/labels";

export type MissionDay = "today" | "tomorrow";

export interface MissionFields {
  title: string;
  category: Category;
  importance: Importance;
  difficulty: Difficulty;
  estMinutes: number;
  day: MissionDay;
}

export type FieldErrors = Partial<Record<keyof MissionFields, string>>;

export type ParseResult = { ok: true; value: MissionFields } | { ok: false; errors: FieldErrors };

const oneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (options as readonly string[]).includes(value);

export function parseMissionForm(form: FormData): ParseResult {
  const errors: FieldErrors = {};

  const title = String(form.get("title") ?? "").trim().replace(/\s+/g, " ");
  if (title.length === 0) errors.title = "Give the mission a name.";
  else if (title.length > 200) errors.title = "Keep the name under 200 characters.";

  const category = form.get("category");
  if (!oneOf(CATEGORIES, category)) errors.category = "Pick a category.";

  const importance = form.get("importance");
  if (!oneOf(IMPORTANCES, importance)) errors.importance = "Pick an importance.";

  const difficulty = form.get("difficulty");
  if (!oneOf(DIFFICULTIES, difficulty)) errors.difficulty = "Pick a difficulty.";

  const rawMinutes = String(form.get("estMinutes") ?? "").trim();
  const estMinutes = /^\d+$/.test(rawMinutes) ? Number(rawMinutes) : NaN;
  if (!Number.isInteger(estMinutes) || estMinutes < 1 || estMinutes > 600) {
    errors.estMinutes = "Use a duration from 1 to 600 minutes.";
  }

  const day = form.get("day") ?? "today";
  if (!oneOf(["today", "tomorrow"] as const, day)) errors.day = "Plan it for today or tomorrow.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      title,
      category: category as Category,
      importance: importance as Importance,
      difficulty: difficulty as Difficulty,
      estMinutes,
      day: day as MissionDay,
    },
  };
}
