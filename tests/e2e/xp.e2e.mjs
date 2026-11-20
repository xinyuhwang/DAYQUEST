// XP awards, reversals, bonuses, level-ups, and ledger consistency under rapid clicks.
import { suite } from "./lib.mjs";

await suite("xp", async (t) => {
  const { page, check, sql } = t;
  const ledger = () => sql(`select reason || ' ' || amount from public.xp_transactions where user_id='${t.uid()}' order by created_at, reason`);
  const ledgerSum = () => Number(sql(`select coalesce(sum(amount),0) from public.xp_transactions where user_id='${t.uid()}'`));
  const taskXp = (title) =>
    Number(sql(`select coalesce(sum(amount),0) from public.xp_transactions where user_id='${t.uid()}' and source_type='task'
      and source_id=(select id::text from public.tasks where title='${title}' and user_id='${t.uid()}')`));
  const xpToday = async () => Number((await page.locator("h2:has-text('XP today') + span").innerText()).replace(/\D/g, ""));
  const levelText = () => page.locator("text=/^Level \\d+ ·/").first().innerText();
  const waitXp = (n) =>
    page.waitForFunction(
      (n) => [...document.querySelectorAll("h2")].find((h) => h.textContent === "XP today")?.nextElementSibling?.textContent === `${n} XP`,
      n,
      { timeout: 10000 },
    );
  const tick = (title) => page.getByRole("checkbox", { name: new RegExp(title) }).click();
  async function add(title, { minutes, importance, difficulty }) {
    if (!(await page.getByLabel("Mission").count())) await page.getByRole("button", { name: "+ Add a mission" }).click();
    await page.getByLabel("Mission").fill(title);
    if (minutes === 10) {
      await page.getByRole("button", { name: "Custom" }).click();
      await page.getByLabel("Minutes").fill("10");
    } else await page.getByRole("button", { name: `${minutes}m`, exact: true }).click();
    await page.getByRole("button", { name: importance, exact: true }).click();
    await page.getByRole("button", { name: difficulty, exact: true }).click();
    await page.getByRole("button", { name: "Add mission" }).click();
    await page.getByText(title).waitFor();
  }

  await t.signIn();
  await page.getByText("No missions yet").waitFor();
  await add("Finish PhD application revisions", { minutes: 90, importance: "Critical", difficulty: "Hard" });
  await add("Practice ML concepts", { minutes: 30, importance: "Normal", difficulty: "Medium" });
  await add("Reply to advisor", { minutes: 10, importance: "Normal", difficulty: "Easy" });
  check("fresh account starts with 0 XP", (await xpToday()) === 0);

  await tick("Finish PhD");
  await waitXp(82);
  check("critical mission earns 52 + 30 all-critical bonus", await page.getByText("+30 · All critical missions done").isVisible());

  await tick("Practice ML");
  await waitXp(112);
  await page.getByRole("status").filter({ hasText: "Level 2!" }).waitFor({ timeout: 5000 });
  check("112 XP reaches level 2 with a level-up toast", (await levelText()).startsWith("Level 2"));
  await t.shot("1-levelup");

  await tick("Finish PhD");
  await waitXp(30);
  check("un-checking reverses the 52 and the bonus", (await levelText()).startsWith("Level 1"));
  await tick("Finish PhD");
  await waitXp(112);
  check("re-checking awards again as award #2", ledger().includes("task_completed#2 52"));

  const quick = page.getByRole("checkbox", { name: /Reply to advisor/ });
  await quick.click();
  await quick.click({ delay: 0 });
  await page.waitForTimeout(2500);
  await page.reload();
  await page.getByText("Today's missions").waitFor();
  const quickDone = (await page.getByRole("checkbox", { name: /Reply to advisor/ }).getAttribute("aria-checked")) === "true";
  check("double-click leaves the quick task's XP matching its state", (quickDone ? 10 : 0) === taskXp("Reply to advisor"));
  if (quickDone) {
    await tick("Reply to advisor");
    await waitXp(112);
  }

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Edit Practice ML concepts" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await waitXp(82);
  check("deleting a finished mission takes its 30 XP back", true);

  await add("Submit recommendation request", { minutes: 15, importance: "Critical", difficulty: "Easy" });
  await waitXp(52);
  check("an unfinished critical mission revokes the all-critical bonus", true);

  // Bursts of 9 clicks: the ledger must still match the final state.
  let consistent = true;
  for (let round = 0; round < 3; round++) {
    const box = page.getByRole("checkbox", { name: /Submit recommendation/ });
    for (let i = 0; i < 9; i++) await box.click({ delay: 0 });
    await page.waitForTimeout(4000);
    const done = sql(`select status from public.tasks where title='Submit recommendation request' and user_id='${t.uid()}'`) === "done";
    if ((done ? 26 : 0) !== taskXp("Submit recommendation request")) consistent = false;
  }
  check("rapid click bursts keep the ledger consistent", consistent);

  await page.reload();
  await page.getByText("Today's missions").waitFor();
  check("page XP equals the ledger sum after reload", (await xpToday()) === ledgerSum());
  const dupes = Number(sql(`select count(*) - count(distinct (source_type, source_id, reason)) from public.xp_transactions where user_id='${t.uid()}'`));
  check("no duplicate ledger entries", dupes === 0);
  await t.shot("2-final");
  check("no console or page errors", t.errors.length === 0, t.errors.join(" | "));
});
