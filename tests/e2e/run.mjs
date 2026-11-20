/**
 * Runs the browser suites one after another: `pnpm test:e2e [suite…]`.
 * Needs the dev server (E2E_URL, default http://localhost:3000) and the local
 * Supabase stack (`pnpm db:start`) running. See tests/e2e/README.md.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { APP, MAILPIT, sql } from "./lib.mjs";

const dir = new URL(".", import.meta.url).pathname;
const ORDER = ["auth", "missions", "xp", "checkin", "focus", "wrapup", "settings"];
const available = readdirSync(dir).filter((f) => f.endsWith(".e2e.mjs")).map((f) => f.replace(".e2e.mjs", ""));
const wanted = process.argv.slice(2);
const unknown = wanted.filter((w) => !available.includes(w));
if (unknown.length) {
  console.error(`Unknown suite(s): ${unknown.join(", ")}. Available: ${available.join(", ")}`);
  process.exit(2);
}
const suites = (wanted.length ? wanted : [...ORDER, ...available.filter((a) => !ORDER.includes(a))]).filter((s) =>
  available.includes(s),
);

async function preflight() {
  const problems = [];
  await fetch(APP, { redirect: "manual" }).catch(() => problems.push(`app not reachable at ${APP} (start it with \`pnpm dev\`, or set E2E_URL)`));
  await fetch(`${MAILPIT}/api/v1/messages?limit=1`).catch(() => problems.push(`Mailpit not reachable at ${MAILPIT} (run \`pnpm db:start\`)`));
  try {
    sql("select 1");
  } catch {
    problems.push("can't reach the local database container (run `pnpm db:start`; Docker must be running)");
  }
  return problems;
}

const problems = await preflight();
if (problems.length) {
  console.error(`Can't run the browser tests:\n${problems.map((p) => `  • ${p}`).join("\n")}`);
  process.exit(2);
}

const failed = [];
for (const s of suites) {
  const { status } = spawnSync(process.execPath, [`${dir}${s}.e2e.mjs`], { stdio: "inherit" });
  if (status !== 0) failed.push(s);
}
console.log(`\n${failed.length ? `✗ ${failed.length} of ${suites.length} suites failed: ${failed.join(", ")}` : `✓ all ${suites.length} suites passed`}`);
process.exit(failed.length ? 1 : 0);
