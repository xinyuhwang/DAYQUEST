/** Pure helpers for the sign-in flow (no framework or Supabase imports). */

export const SIGN_IN_PATH = "/sign-in";

/**
 * Where to send the user after signing in. Only same-site relative paths are
 * allowed, so a crafted `?next=https://evil.example` can't redirect off-site.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || next.length === 0 || next.length > 512) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next === SIGN_IN_PATH || next.startsWith(`${SIGN_IN_PATH}?`) || next.startsWith(`${SIGN_IN_PATH}/`)) {
    return "/";
  }
  return next;
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

/** The 6-digit code, tolerating spaces or dashes pasted from the email. */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}
