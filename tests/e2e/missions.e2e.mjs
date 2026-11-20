// Missions on Today and Tomorrow: add, validate, complete, edit, move, delete.
import { suite } from "./lib.mjs";

await suite("missions", async (t) => {
  const { page, check } = t;
  await t.signIn();
  await page.getByText("No missions yet").waitFor();
  check("new account sees an empty Today with the add form open", await page.getByLabel("Mission").isVisible());
  await t.shot("1-empty");

  await page.getByRole("button", { name: "Add mission" }).click();
  check("empty title is rejected", (await page.locator("p[role=alert]").first().innerText()).length > 0);

  await page.getByLabel("Mission").fill("Finish PhD application revisions");
  await page.getByRole("button", { name: "90m" }).click();
  await page.getByRole("button", { name: "Critical" }).click();
  await page.getByRole("button", { name: "Hard" }).click();
  const worth = await page.getByText(/^Worth/).innerText();
  check("form previews the XP (hard × critical = 52)", worth.includes("+52 XP"), worth);
  await page.getByRole("button", { name: "Add mission" }).click();
  await page.getByText("Finish PhD application revisions").waitFor();
  check("form clears after saving", (await page.getByLabel("Mission").inputValue()) === "");

  await page.getByLabel("Mission").fill("Reply to advisor's email");
  await page.getByRole("button", { name: "Custom" }).click();
  await page.getByLabel("Minutes").fill("10");
  await page.getByRole("button", { name: "Easy" }).click();
  await page.getByRole("button", { name: "Add mission" }).click();
  await page.getByText("Reply to advisor's email").waitFor();
  check("a 10-minute mission is marked as a quick task", await page.getByText("Quick task · ½ XP").isVisible());
  await page.getByLabel("Mission").fill("Read one research paper");
  await page.getByRole("button", { name: "Add mission" }).click();
  await page.getByText("Read one research paper").waitFor();

  await page.getByRole("checkbox", { name: /Finish PhD/ }).click();
  await page.getByText("1 of 3 missions complete").waitFor();
  await page.reload();
  await page.getByText("1 of 3 missions complete").waitFor();
  check("completion survives a reload",
    (await page.getByRole("checkbox", { name: /Finish PhD/ }).getAttribute("aria-checked")) === "true");
  await t.shot("2-today");

  await page.getByRole("button", { name: "Edit Read one research paper" }).click();
  await page.getByLabel("Mission").first().fill("Read two research papers");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByText("Read two research papers").waitFor();
  check("editing a mission saves the new title", true);

  await page.getByRole("button", { name: "Edit Reply to advisor's email" }).click();
  await page.getByRole("button", { name: "Move to tomorrow" }).click();
  await page.getByText("1 of 2 missions complete").waitFor();
  await page.getByRole("link", { name: "Tomorrow" }).click();
  await page.getByText("Reply to advisor's email").waitFor();
  check("moved mission shows on Tomorrow, which has no checkboxes", (await page.getByRole("checkbox").count()) === 0);
  await t.shot("3-tomorrow");

  const rowsOf = (day) =>
    t.sql(`select string_agg(title || ':' || status, ',' order by sort_order) from public.tasks t
      where user_id='${t.uid()}' and planned_date = (select (now() at time zone p.timezone - interval '4 hours')::date + ${day} from public.profiles p where p.id = t.user_id)`);
  check("moving today → tomorrow is a carry-over: the original stays on today", rowsOf(0).includes("Reply to advisor's email:carried_over"), rowsOf(0));

  // Moving it back undoes the carry instead of leaving a hidden original behind.
  await page.getByRole("button", { name: "Edit Reply to advisor's email" }).click();
  await page.getByRole("button", { name: "Move to today" }).click();
  await page.getByText("0 missions planned for tomorrow").waitFor();
  check("moving it back restores the original, with no Carried over tag",
    rowsOf(0).includes("Reply to advisor's email:planned") && !rowsOf(0).includes("carried_over") &&
    t.sql(`select count(*) from public.tasks where user_id='${t.uid()}'`) === "3");

  await page.getByRole("link", { name: "Today" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Edit Reply to advisor's email" }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByText("1 of 2 missions complete").waitFor();
  check("deleting removes the mission", true);

  check("database matches what the page shows",
    rowsOf(0) === "Finish PhD application revisions:done,Read two research papers:planned", rowsOf(0));
  check("no console or page errors", t.errors.length === 0, t.errors.join(" | "));
});
