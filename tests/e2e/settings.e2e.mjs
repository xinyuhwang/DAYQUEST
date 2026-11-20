// Settings: time zone and day end, server-owned and limited to one change a day.
import { suite } from "./lib.mjs";

await suite("settings", async (t) => {
  const { page, check, sql, APP } = t;
  const profile = () => sql(`select timezone || ' ' || day_rollover_hour from public.profiles where id='${t.uid()}'`);

  await t.signIn();
  await page.getByText("No missions yet").waitFor();
  check("first sign-in sets the browser's time zone", profile() === "America/New_York 4", profile());

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("heading", { name: "Settings" }).waitFor();
  check("Save is disabled until something changes", await page.getByRole("button", { name: "Save" }).isDisabled());
  await page.getByLabel("Time zone").selectOption("Asia/Tokyo");
  await page.getByLabel("Day ends at").selectOption("2");
  await t.shot("1-form");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("status").filter({ hasText: "Saved." }).waitFor();
  check("saving updates the profile", profile() === "Asia/Tokyo 2", profile());
  check("after a change, the form is locked for 24 hours",
    (await page.getByText(/You changed these recently/).isVisible()) && (await page.getByLabel("Time zone").isDisabled()));
  await t.shot("2-locked");

  // Direct API changes are refused by the database (covered in supabase/tests/rls.test.sql).
  await page.getByRole("link", { name: "Back to today" }).click();
  await page.getByText("Today's missions").waitFor();
  check("Today still works in the new time zone", new URL(page.url()).pathname === "/");

  const { page: mp } = await t.withContext({ viewport: { width: 390, height: 844 } });
  await mp.goto(`${APP}/settings`);
  await mp.getByRole("heading", { name: "Settings" }).waitFor();
  await t.shot("3-mobile", mp);
  check("no horizontal scroll at 390px", !(await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  check("no console or page errors", t.errors.length === 0, t.errors.join(" | "));
});
