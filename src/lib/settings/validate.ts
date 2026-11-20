/** Parsing and rules for the day settings form (DESIGN.md §3). */
import { MAX_ROLLOVER_HOUR } from "@/engine";
import { isValidTimeZone } from "@/lib/auth";

/** Time zone and rollover decide which day XP lands on, so they change at most once a day. */
export const DAY_SETTINGS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface DaySettings {
  timezone: string;
  rolloverHour: number;
}

export type DaySettingsParse = { ok: true; value: DaySettings } | { ok: false; error: string };

export function parseDaySettings(form: FormData): DaySettingsParse {
  const timezone = form.get("timezone");
  if (!isValidTimeZone(timezone)) return { ok: false, error: "Choose a time zone from the list." };
  const raw = form.get("rolloverHour");
  const rolloverHour = typeof raw === "string" && /^\d$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(rolloverHour) || rolloverHour < 0 || rolloverHour > MAX_ROLLOVER_HOUR) {
    return { ok: false, error: `Choose an hour from midnight to ${MAX_ROLLOVER_HOUR} AM.` };
  }
  return { ok: true, value: { timezone, rolloverHour } };
}

/** When the day settings can next change, or null if they can change now. */
export function nextChangeAt(changedAt: string | null, now: number): number | null {
  if (!changedAt) return null;
  const next = Date.parse(changedAt) + DAY_SETTINGS_COOLDOWN_MS;
  return next > now ? next : null;
}

/** "Midnight", "1 AM" … "6 AM". */
export function rolloverLabel(hour: number): string {
  return hour === 0 ? "Midnight" : `${hour} AM`;
}
