/** Day boundaries (docs/DESIGN.md §3). */

export const DEFAULT_ROLLOVER_HOUR = 4;
export const MAX_ROLLOVER_HOUR = 6;
export const REFLECTION_PROMPT_HOUR = 20;

/**
 * The DAYQUEST day an instant belongs to, as "YYYY-MM-DD" in the user's time
 * zone. Times before the rollover hour count toward the previous day, so
 * late-night work belongs to the evening it started in.
 */
export function dayKey(
  instant: Date,
  timeZone: string,
  rolloverHour: number = DEFAULT_ROLLOVER_HOUR,
): string {
  if (!Number.isInteger(rolloverHour) || rolloverHour < 0 || rolloverHour > MAX_ROLLOVER_HOUR) {
    throw new RangeError(`rolloverHour must be an integer from 0 to ${MAX_ROLLOVER_HOUR}`);
  }
  const shifted = new Date(instant.getTime() - rolloverHour * 60 * 60 * 1000);
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

/** Calendar arithmetic on "YYYY-MM-DD" keys (time-zone independent). */
export function addDays(key: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) throw new RangeError(`invalid day key: ${key}`);
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return date.toISOString().slice(0, 10);
}
