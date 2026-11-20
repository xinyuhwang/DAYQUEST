// Evening reflection and carry-over, plus "yesterday's loose ends" for a missed evening.
// The server uses the profile's time zone, so the suite switches the test user to
// fixed-offset zones where it's currently daytime (closed) or late evening (open).
import { addDays, dayIn, suite } from "./lib.mjs";

const hourIn = (tz) => Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(new Date()));
const zones = Array.from({ length: 27 }, (_, i) => i - 12).map((o) => (o === 0 ? "Etc/GMT" : `Etc/GMT${o > 0 ? "-" : "+"}${Math.abs(o)}`));
const DAY_TZ = zones.find((z) => hourIn(z) >= 10 && hourIn(z) <= 17);
const EVENING_TZ = zones.find((z) => hourIn(z) >= 21 && hourIn(z) <= 23);

await suite("wrapup", async (t) => {
  const { page, check, sql, APP } = t;
  const uid = () => t.uid();
  const task = (title, day, importance = "normal", status = "planned", sort = 0) =>
    sql(`insert into public.tasks (user_id, title, est_minutes, planned_date, importance, status, sort_order) values ('${uid()}', '${title}', 30, '${day}', '${importance}', '${status}', ${sort})`);
  const reflBonus = (day) => sql(`select coalesce(sum(amount),0) from public.xp_transactions where user_id='${uid()}' and reason like 'bonus:reflection%' and day='${day}'`);
  const missionTitles = () => page.locator("li span.break-words.font-medium").allInnerTexts();

  console.log(`day zone ${DAY_TZ} (${hourIn(DAY_TZ)}h), evening zone ${EVENING_TZ} (${hourIn(EVENING_TZ)}h)`);
  await t.signIn();
  await page.getByText("No missions yet").waitFor();

  // ---- Daytime: a missed yesterday shows up as loose ends.
  sql(`update public.profiles set timezone='${DAY_TZ}' where id='${uid()}'`);
  let today = dayIn(DAY_TZ), yesterday = addDays(today, -1);
  task("Read paper", yesterday, "normal", "done", 0);
  task("Draft slides", yesterday, "important", "planned", 1);
  task("Tidy inbox", yesterday, "optional", "planned", 2);
  task("Morning run", today, "normal", "planned", 0);
  await page.reload();
  await page.getByText("Yesterday's loose ends").waitFor();
  check("daytime: no evening card, just the 8 PM hint",
    (await page.getByText("The evening reflection opens at 8 PM.").isVisible()) && (await page.getByRole("region", { name: "Evening reflection" }).count()) === 0);
  check("missed yesterday shows its 2 unfinished missions", await page.getByText("2 missions were left unfinished").isVisible());
  await page.getByRole("button", { name: "Sort out yesterday" }).click();
  check("important starts ticked, optional unticked",
    (await page.getByRole("checkbox", { name: /Draft slides/ }).isChecked()) && !(await page.getByRole("checkbox", { name: /Tidy inbox/ }).isChecked()));
  check("live preview counts carried time", await page.getByText("Today will have 1h planned, including 30m carried over.").isVisible());
  await t.shot("1-yesterday");
  await page.getByRole("button", { name: /Wrap up yesterday/ }).click();
  await page.getByText("Yesterday's loose ends").waitFor({ state: "detached" });
  const titles = await missionTitles();
  check("carried mission joins today with a Carried over chip",
    titles.includes("Draft slides") && (await page.getByText("↻ Carried over").count()) === 1, titles.join(", "));
  check("unticked mission stays on yesterday; original marked carried_over",
    sql(`select string_agg(title || ':' || status, ',' order by sort_order) from public.tasks where user_id='${uid()}' and planned_date='${yesterday}'`) ===
      "Read paper:done,Draft slides:carried_over,Tidy inbox:planned");
  check("+10 reflection bonus lands on yesterday", reflBonus(yesterday) === "10" && reflBonus(today) === "0");

  // ---- Evening: tonight's reflection.
  sql(`update public.profiles set timezone='${EVENING_TZ}' where id='${uid()}'`);
  sql(`delete from public.tasks where user_id='${uid()}'`);
  today = dayIn(EVENING_TZ);
  const tomorrow = addDays(today, 1);
  sql(`insert into public.reflections (user_id, day) values ('${uid()}', '${addDays(today, -1)}') on conflict do nothing`);
  task("Write thesis intro", today, "critical", "planned", 0);
  task("Email advisor", today, "normal", "planned", 1);
  task("Organize photos", today, "optional", "planned", 2);
  task("Gym", tomorrow, "normal", "planned", 0);
  await page.reload();
  const evening = page.getByRole("region", { name: "Evening reflection" });
  await evening.waitFor();
  check("evening: reflection card shows, hint hidden", !(await page.getByText("opens at 8 PM").isVisible()));
  await page.getByRole("checkbox", { name: /Mark done: Email advisor/ }).click();
  for (let i = 0; i < 20 && sql(`select count(*) from public.xp_transactions where user_id='${uid()}' and source_type='task'`) === "0"; i++) await page.waitForTimeout(250);
  await page.reload(); await evening.waitFor();
  check("summary shows missions done and XP", /Missions\s*1 \/ 3\s*XP earned\s*30/.test(await evening.innerText()), (await evening.innerText()).replace(/\s+/g, " ").slice(0, 120));
  await page.getByRole("button", { name: "Wrap up the day" }).click();
  check("only unfinished missions are offered",
    (await page.getByRole("checkbox", { name: /Email advisor/ }).count()) === 1 /* the mission's own done-checkbox */ &&
    (await evening.getByRole("checkbox").count()) === 2);
  check("tomorrow preview includes what's already planned", await page.getByText("Tomorrow will have 1h planned, including 30m carried over.").isVisible());
  await page.getByLabel(/Anything worth remembering/).fill("Intro took longer than expected.");
  await t.shot("2-form");
  await page.getByRole("button", { name: /Finish the day · \+10 XP/ }).click();
  const done = page.getByRole("region", { name: "Day wrapped up" });
  await done.waitFor();
  check("wrapped-up card: carried count and notes",
    (await done.innerText()).includes("1 mission carried to tomorrow") && (await done.innerText()).includes("Intro took longer"));
  check("today's list drops the carried mission", !(await missionTitles()).includes("Write thesis intro"));
  check("+10 reflection bonus on today, shown in XP today", reflBonus(today) === "10" && (await page.getByText("+10 · Evening reflection").isVisible()));
  check("no all-critical bonus for carrying the critical mission away",
    sql(`select coalesce(sum(amount),0) from public.xp_transactions where user_id='${uid()}' and reason like 'bonus:all_critical%'`) === "0");
  await t.shot("3-done");
  await page.goto(`${APP}/?day=tomorrow`);
  await page.getByText("Write thesis intro").waitFor();
  check("tomorrow has the carried mission after what was planned", (await missionTitles()).join(",") === "Gym,Write thesis intro");
  await page.goto(APP); await done.waitFor();
  check("reload: still wrapped up, no form", (await page.getByRole("button", { name: "Wrap up the day" }).count()) === 0);

  // Mobile: the form at 390px.
  sql(`delete from public.reflections where user_id='${uid()}' and day='${today}'`);
  const { page: mp } = await t.withContext({ viewport: { width: 390, height: 844 } });
  await mp.goto(APP);
  await mp.getByRole("button", { name: "Wrap up the day" }).click();
  await t.shot("4-mobile", mp);
  check("no horizontal scroll at 390px", !(await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  check("no console/page errors", t.errors.length === 0, t.errors.join(" | "));
});
