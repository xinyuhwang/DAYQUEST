/** "Wednesday, November 18" for a "YYYY-MM-DD" day key, independent of the server's zone. */
export function formatDayLabel(key: string, locale = "en-US"): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** "2h 43m", "45m", "4h" */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}
