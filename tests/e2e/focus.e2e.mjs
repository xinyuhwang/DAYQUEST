// Focus timer: start, pause/resume, server-checked completion, breaks, early ends, XP and caps.
// Elapsed time is simulated by moving the open session's start back in the database.
import { suite } from "./lib.mjs";

await suite("focus", async (t) => {
  const { page, check, sql, APP } = t;
  const uid = () => t.uid();
  const open = () => sql(`select id from public.focus_sessions where user_id='${uid()}' and ended_at is null`);
  const backdate = (mins) => sql(`update public.focus_sessions set started_at = now() - interval '${mins} minutes' where ended_at is null and user_id='${uid()}'`);
  const focusXp = () => sql(`select coalesce(sum(amount),0) from public.xp_transactions where user_id='${uid()}' and source_type='focus_session'`);
  const bonus = (c) => sql(`select coalesce(sum(amount),0) from public.xp_transactions where user_id='${uid()}' and reason like 'bonus:${c}%'`);
  const timer = () => page.getByRole("timer").first().innerText();
  async function startFromToday(preset = "25/5") {
    await page.goto(APP);
    await page.getByRole("button", { name: /^Focus on Write thesis intro/ }).click();
    await page.getByRole("button", { name: preset }).click();
    await page.getByRole("button", { name: "Start focus" }).click();
    await page.waitForURL(/\/focus$/);
    await page.getByRole("timer").waitFor();
  }

  await t.signIn();
  await page.getByText("No missions yet").waitFor();
  await page.getByLabel("Mission").fill("Write thesis intro");
  await page.getByRole("button", { name: "60m", exact: true }).click();
  await page.getByRole("button", { name: "Critical", exact: true }).click();
  await page.getByRole("button", { name: "Hard", exact: true }).click();
  await page.getByRole("button", { name: "Add mission" }).click();
  await page.getByText("Write thesis intro").waitFor();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: /^Focus on/ }).click();
  await t.shot("1-picker");
  await page.getByRole("button", { name: "Cancel" }).click();

  await startFromToday();
  const t0 = await timer();
  await page.waitForTimeout(2200);
  const t1 = await timer();
  check("focus mode opens on the mission and counts down", t0.startsWith("2") && t1 < t0 && (await page.getByRole("heading", { name: "Write thesis intro" }).isVisible()), `${t0} → ${t1}`);
  await t.shot("2-running");

  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByText("Paused").waitFor();
  const tp = await timer();
  check("pause is recorded by the server", sql(`select paused_at is not null from public.focus_sessions where id='${open()}'`) === "t");
  await page.waitForTimeout(2500);
  await page.reload(); await page.getByRole("timer").waitFor();
  check("reload keeps the session paused at the same time", (await timer()) === tp && (await page.getByText("Paused").isVisible()), `${tp} → ${await timer()}`);
  await page.getByRole("button", { name: "Resume" }).click();
  await page.getByRole("button", { name: "Pause" }).waitFor();
  check("resume folds the pause into paused_ms", Number(sql(`select paused_ms from public.focus_sessions where id='${open()}'`)) >= 2500);

  await page.goto(APP);
  await page.getByText("Focus session running").waitFor();
  check("Today shows the running-session banner and hides Focus buttons",
    (await page.getByText("Focus session running").isVisible()) && (await page.getByRole("button", { name: /^Focus on/ }).count()) === 0);
  await t.shot("3-banner");
  await page.getByRole("button", { name: "Edit Write thesis intro" }).click();
  check("the focused mission can't be moved or deleted",
    (await page.getByText("Finish it to move or delete the mission.").isVisible()) &&
    (await page.getByRole("button", { name: "Delete" }).count()) === 0);
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("link", { name: /Return to focus/ }).click();
  await page.getByRole("timer").waitFor();

  backdate(25.2);
  await page.reload();
  await page.getByText("Session complete!").waitFor({ timeout: 10000 });
  check("time's up → completed, +10 XP", focusXp() === "10" && (await page.getByText("+10 XP").first().isVisible()), focusXp());
  await t.shot("4-complete");

  await page.getByRole("button", { name: "Take a 5-min break" }).click();
  check("break timer shows 5:00", (await timer()).startsWith("05:00") || (await timer()).startsWith("04:5"), await timer());
  await t.shot("5-break");
  await page.getByRole("button", { name: "Skip break" }).click();
  await page.getByText("Break's over").waitFor();
  await page.getByRole("button", { name: "Start 25 min" }).click();
  await page.getByRole("button", { name: "Pause" }).waitFor();
  const second = open();
  check("another session starts from the break screen", second.length === 36);

  backdate(14);
  await page.reload(); await page.getByRole("button", { name: "End early" }).waitFor();
  await page.getByRole("button", { name: "End early" }).click();
  const confirmText = await page.getByText(/half the session/).innerText();
  await t.shot("6-confirm");
  await page.getByRole("button", { name: "End session" }).click();
  await page.getByText("Good effort").waitFor();
  check("ending early after ≥50% → +5 XP", focusXp() === "15" && confirmText.includes("+5 XP"), `${focusXp()}; "${confirmText}"`);
  check("2-session bonus not yet (only 1 completed)", bonus("two_focus_sessions") === "0");

  await page.getByRole("button", { name: "Start another 25 min now" }).click();
  await page.getByRole("button", { name: "Pause" }).waitFor();
  backdate(25.2); await page.reload();
  await page.getByText("Session complete!").waitFor({ timeout: 10000 });
  check("2nd completed session → +10 and the +15 bonus", focusXp() === "25" && bonus("two_focus_sessions") === "15", `${focusXp()} / ${bonus("two_focus_sessions")}`);

  await page.getByRole("button", { name: "Start another 25 min now" }).click();
  await page.getByRole("button", { name: "End early" }).click();
  await page.getByRole("button", { name: "End session" }).click();
  await page.getByText("Session ended").waitFor();
  check("ending right away → no XP, kind message", focusXp() === "25" && (await page.getByText("No XP this time, and that's okay").isVisible()));
  await page.getByRole("button", { name: "Mark mission done" }).click();
  await page.getByText("Mission done ✓").waitFor();
  await page.waitForTimeout(2000);
  check("Mark mission done awards the mission XP and keeps the result screen",
    sql(`select coalesce(sum(amount),0) from public.xp_transactions where user_id='${uid()}' and source_type='task'`) === "52" &&
    (await page.getByText("Mission done ✓").isVisible()) && !(await page.getByText("No focus session running").isVisible()));

  // A device clock 2 minutes fast must not end the session early.
  await sql(`update public.tasks set status='planned', completed_at=null where user_id='${uid()}'`);
  const { context: fast, page: fp } = await t.withContext({});
  await fast.addInitScript(() => { const real = Date.now.bind(Date); Date.now = () => real() + 120_000; });
  await fp.goto(APP);
  await fp.getByRole("button", { name: /^Focus on Write thesis intro/ }).click();
  await fp.getByRole("button", { name: "Start focus" }).click();
  await fp.waitForURL(/\/focus$/); await fp.getByRole("timer").waitFor();
  sql(`update public.focus_sessions set started_at = now() - interval '24 minutes' where ended_at is null and user_id='${uid()}'`);
  await fp.reload(); await fp.getByRole("timer").waitFor();
  await fp.waitForTimeout(4000);
  const stillOpen = open().length === 36;
  const shown = await fp.getByRole("timer").innerText();
  check("fast device clock: server says not yet, session keeps running", stillOpen && shown > "00:30", `open=${stillOpen}, timer ${shown}`);
  await fast.close();

  const { page: mp } = await t.withContext({ viewport: { width: 390, height: 844 } });
  await mp.goto(`${APP}/focus`); await mp.getByRole("timer").waitFor();
  await t.shot("7-mobile", mp);
  // Sessions under 10 minutes earn no focus XP, so they don't count toward the
  // 2-session bonus either. A fresh user, so earlier sessions don't interfere.
  const other = t.email.replace("@", "-short@");
  const { page: sp } = await t.withContext({ storageState: undefined });
  await t.signIn(sp, other);
  await sp.getByLabel("Mission").fill("Quick review");
  await sp.getByRole("button", { name: "Add mission" }).click();
  await sp.getByText("Quick review").first().waitFor();
  const otherBackdate = () =>
    sql(`update public.focus_sessions set started_at = now() - interval '5.2 minutes' where ended_at is null and user_id='${t.uid(other)}'`);
  await sp.getByRole("button", { name: /^Focus on Quick review/ }).click();
  const picker = sp.getByRole("group", { name: /Focus session for Quick review/ });
  await picker.getByRole("button", { name: "Custom" }).click();
  await picker.getByRole("spinbutton").fill("5");
  await picker.getByRole("button", { name: "Start focus" }).click();
  await sp.getByRole("timer").waitFor();
  otherBackdate(); await sp.reload();
  await sp.getByText("Session complete!").waitFor({ timeout: 10000 });
  const shortMsg = await sp.getByText(/Sessions under 10 minutes don't earn XP/).isVisible();
  await sp.getByRole("button", { name: "Start another 5 min now" }).click();
  await sp.getByRole("button", { name: "Pause" }).waitFor();
  otherBackdate(); await sp.reload();
  await sp.getByText("Session complete!").waitFor({ timeout: 10000 });
  await sp.waitForTimeout(800);
  const otherBonus = sql(`select coalesce(sum(amount),0) from public.xp_transactions where user_id='${t.uid(other)}'`);
  check("two 5-minute sessions: no XP, no 2-session bonus, and the right message", otherBonus === "0" && shortMsg, `xp=${otherBonus}, msg=${shortMsg}`);

  check("no horizontal scroll at 390px", !(await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  check("no console/page errors", t.errors.length === 0, t.errors.join(" | "));
}, { ignoreConsole: ["AudioContext"] });
