/**
 * Shared harness for the browser tests (see tests/e2e/README.md).
 *
 * Each suite signs up throwaway users (`e2e-<suite>+…@example.test`) on the
 * local stack, reads sign-in codes from Mailpit, checks the database through
 * psql in the local Supabase container, and deletes its users when done.
 * Local only: never point this at a real project.
 */
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

export const APP = (process.env.E2E_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const DB_CONTAINER = process.env.E2E_DB_CONTAINER ?? "supabase_db_dayquest";
const SHOTS = new URL("./screenshots/", import.meta.url).pathname;

/** Runs SQL as postgres in the local database container; returns trimmed text output. */
export const sql = (q) =>
  execFileSync("docker", ["exec", DB_CONTAINER, "psql", "-U", "postgres", "-tA", "-c", q]).toString().trim();

const usedCodes = new Set();
/** The newest sign-in code sent to `to` that hasn't been used yet. */
export async function signInCode(to) {
  for (let i = 0; i < 30; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages = [] } = await res.json();
    if (messages.length) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json();
      const code = (msg.Text || msg.HTML).match(/\b(\d{6})\b/)?.[1];
      if (code && !usedCodes.has(code)) {
        usedCodes.add(code);
        return code;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no sign-in email arrived for ${to}`);
}

/** Today's DAYQUEST day key in a time zone (default 04:00 rollover). */
export const dayIn = (tz, rolloverHour = 4) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(Date.now() - rolloverHour * 3600e3),
  );

export const addDays = (key, n) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/**
 * Runs one suite: launches Chrome, hands `body` a toolkit, reports checks,
 * cleans up its users and sets the exit code.
 */
export async function suite(name, body, { viewport = { width: 1280, height: 1000 }, timezoneId = "America/New_York", ignoreConsole = [] } = {}) {
  mkdirSync(SHOTS, { recursive: true });
  const prefix = `e2e-${name}+`;
  const email = `${prefix}${Date.now()}@example.test`;
  const browser = await chromium.launch({ channel: process.env.E2E_BROWSER ?? "chrome", headless: !process.env.HEADED });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, timezoneId });
  const page = await ctx.newPage();
  const errors = [];
  const watch = (p) => {
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error" && !ignoreConsole.some((s) => m.text().includes(s))) errors.push(m.text());
    });
    return p;
  };
  watch(page);

  let n = 0;
  let failures = 0;
  const t = {
    APP,
    browser,
    ctx,
    page,
    email,
    errors,
    sql,
    watch,
    /** The suite user's id. */
    uid: (who = email) => sql(`select id from auth.users where email='${who}'`),
    check(label, ok, detail = "") {
      n++;
      if (!ok) failures++;
      console.log(`${ok ? "✓" : "✗"} ${n}. ${label}${detail && !ok ? `  [${detail}]` : ""}`);
    },
    shot: (shotName, p = page) => p.screenshot({ path: `${SHOTS}${name}-${shotName}.png`, fullPage: true, caret: "initial" }),
    /** Signs in through the UI and waits until the app has left /sign-in. */
    async signIn(p = page, who = email) {
      if (!new URL(p.url()).pathname.startsWith("/sign-in")) await p.goto(APP);
      await p.getByLabel("Email").fill(who);
      await p.getByRole("button", { name: "Email me a code" }).click();
      await p.getByLabel("Sign-in code").fill(await signInCode(who));
      await p.getByRole("button", { name: "Continue" }).click();
      await p.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 15000 });
    },
    /** A second browser context sharing this session (e.g. a phone-sized one). */
    async withContext(options) {
      const c = await browser.newContext({ deviceScaleFactor: 2, timezoneId, storageState: await ctx.storageState(), ...options });
      return { context: c, page: watch(await c.newPage()) };
    },
  };

  console.log(`\n── ${name}`);
  try {
    await body(t);
  } catch (e) {
    failures++;
    console.log(`✗ crashed: ${e.message.split("\n")[0]}  (at ${page.url()})`);
    await t.shot("error").catch(() => {});
  } finally {
    try {
      sql(`delete from auth.users where email like '${prefix}%'`);
    } catch (e) {
      console.log(`! cleanup failed: ${e.message.split("\n")[0]}`);
    }
    await browser.close();
    console.log(failures ? `${failures} FAILED (${name})` : `all ${n} passed (${name})`);
    process.exitCode = failures ? 1 : 0;
  }
}
