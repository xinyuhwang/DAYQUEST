// Morning check-in: validation, capacity wording, the report, overload, re-check-ins and the XP target.
import { suite } from "./lib.mjs";

await suite("checkin", async (t) => {
  const { page, check, sql } = t;
  const capacity = page.locator("section", { has: page.getByText("Today's capacity") });
  const preview = () => page.locator("p[aria-live=polite]").innerText();
  const target = () => sql(`select xp_target from public.daily_plans where user_id='${t.uid()}' order by created_at desc limit 1`);
  const bonus = () => sql(`select coalesce(sum(amount),0) from public.xp_transactions where user_id='${t.uid()}' and reason like 'bonus:xp_target%'`);
  const rate = async (energy, focus) => {
    await page.getByRole("button", { name: energy, exact: true }).first().click();
    await page.getByRole("button", { name: focus, exact: true }).first().click();
  };
  async function add(title, minutes, importance, difficulty) {
    if (!(await page.getByLabel("Mission").count())) await page.getByRole("button", { name: "+ Add a mission" }).click();
    await page.getByLabel("Mission").fill(title);
    await page.getByRole("button", { name: `${minutes}m`, exact: true }).click();
    await page.getByRole("button", { name: importance, exact: true }).click();
    await page.getByRole("button", { name: difficulty, exact: true }).click();
    await page.getByRole("button", { name: "Add mission" }).click();
    await page.getByText(title).waitFor();
  }
  async function checkIn({ energy, focus, mood, minutes, submit }) {
    await rate(energy, focus);
    if (mood) await page.getByRole("button", { name: new RegExp(mood) }).click();
    await page.locator("input[type=range]").fill(String(minutes));
    await page.getByRole("button", { name: submit }).click();
    await page.getByRole("button", { name: "Re-check in" }).waitFor();
    await page.waitForTimeout(500);
  }

  await t.signIn();
  await page.getByText("No missions yet").waitFor();
  await add("Finish PhD application revisions", 90, "Critical", "Hard");
  await add("Tidy reading notes", 60, "Optional", "Medium");
  await page.getByRole("button", { name: "Cancel" }).click();
  check("not checked in: prompt with Start check-in", await page.getByRole("button", { name: "Start check-in" }).isVisible());
  await t.shot("1-prompt");

  await page.getByRole("button", { name: "Start check-in" }).click();
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await page.locator("p[role=alert]").first().waitFor();
  check("submitting empty shows energy and focus errors", (await page.locator("p[role=alert]").count()) === 2);

  // The preview accounts for every minute of the time given (§7.3).
  await page.locator("input[type=range]").fill("240");
  await rate("Okay", "Steady");
  check("Okay/Steady, 4h: work + buffer + set aside, with the reason",
    (await preview()) === "Of your 4h: about 2h 43m of focused work (6 sessions), 41m of buffer for the unexpected, and 36m set aside because your energy is Okay.",
    await preview());
  await rate("Good", "Steady");
  check("Good/Steady: nothing set aside",
    (await preview()) === "Of your 4h: about 3h 12m of focused work (7 sessions) and 48m of buffer for the unexpected.", await preview());
  await rate("Low", "Foggy");
  check("Low/Foggy: both reasons named", (await preview()).endsWith("set aside because your energy is Low and focus is Foggy."), await preview());
  await t.shot("2-form");

  await checkIn({ energy: "Okay", focus: "Steady", mood: "Calm", minutes: 240, submit: "Check in" });
  const card = await capacity.innerText();
  check("report: 2h 43m, 6 sessions, balanced", card.includes("2h 43m") && card.includes("6 sessions") && card.includes("Balanced day"));
  check("report explains the set-aside time", card.includes("Set aside") && card.includes("36m of your 4h is set aside because your energy is Okay."));
  check("snapshot saved and target is 160",
    sql(`select capacity_min||'/'||recommended_min||'/'||mood from public.daily_checkins where user_id='${t.uid()}'`) === "204/163/calm" && target() === "160");
  check("XP card shows the target", (await page.getByText("0 / 160 XP").count()) === 1);
  await t.shot("3-report");

  await add("Write lab report", 60, "Normal", "Medium");
  await page.getByRole("button", { name: "Cancel" }).click();
  const over = await capacity.innerText();
  check("210m planned → over capacity, suggests the Optional mission",
    over.includes("Over capacity") && over.includes("Optional mission") && over.includes("47m more"));

  await page.getByRole("checkbox", { name: /Finish PhD/ }).click();
  await page.getByText("52 / 160 XP").waitFor();
  await page.getByRole("button", { name: "Re-check in" }).click();
  await checkIn({ energy: "Drained", focus: "Foggy", minutes: 60, submit: "Update my plan" });
  check("re-check-in lowers the target to 52 + 20 = 72", target() === "72", target());
  check("both snapshots kept", sql(`select count(*) from public.daily_checkins where user_id='${t.uid()}'`) === "2");
  await page.getByRole("checkbox", { name: /Tidy reading/ }).click();
  await page.getByText("76 / 72 XP").waitFor();
  await page.waitForTimeout(800);
  check("reaching the lowered target awards +20", bonus() === "20", bonus());
  await page.reload();
  await page.getByRole("button", { name: "Re-check in" }).click();
  await checkIn({ energy: "Vibrant", focus: "Clear", minutes: 600, submit: "Update my plan" });
  check("feeling better doesn't raise the target", target() === "72", target());
  await page.getByRole("checkbox", { name: /Tidy reading/ }).click();
  await page.getByText("52 / 72 XP").waitFor();
  await page.waitForTimeout(800);
  check("un-checking below the target reverses the bonus", bonus() === "0", bonus());

  const { page: mp } = await t.withContext({ viewport: { width: 390, height: 844 } });
  await mp.goto(t.APP);
  await mp.getByRole("button", { name: "Re-check in" }).click();
  await t.shot("4-mobile-form", mp);
  check("no horizontal scroll at 390px", !(await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  check("no console or page errors", t.errors.length === 0, t.errors.join(" | "));
});
