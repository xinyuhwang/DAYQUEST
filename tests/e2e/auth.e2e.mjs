// Sign-in, redirects, session cookies, the 404 page and stale-session recovery.
import { APP, signInCode, suite } from "./lib.mjs";

await suite("auth", async (t) => {
  const { page, check } = t;

  await page.goto(APP);
  check("signed-out visit lands on /sign-in", new URL(page.url()).pathname === "/sign-in");
  await t.shot("1-email");

  await page.getByLabel("Email").fill("not-an-email");
  await page.getByRole("button", { name: "Email me a code" }).click();
  check("invalid email shows an error", (await page.locator("p[role=alert]").innerText()).length > 0);

  await page.getByLabel("Email").fill(t.email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Sign-in code").waitFor();
  const code = await signInCode(t.email);
  await t.shot("2-code");
  await page.getByLabel("Sign-in code").fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Continue" }).click();
  check("wrong code shows an error", (await page.locator("p[role=alert]").innerText()).length > 0);

  await page.getByLabel("Sign-in code").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Today's missions").waitFor({ timeout: 15000 });
  check("correct code opens Today", new URL(page.url()).pathname === "/");

  const auth = (await t.ctx.cookies()).filter((c) => c.name.startsWith("sb-"));
  check("auth cookies are httpOnly and SameSite=Lax", auth.length > 0 && auth.every((c) => c.httpOnly && c.sameSite === "Lax"));
  check("page scripts can't read the session", !(await page.evaluate(() => document.cookie)).includes("sb-"));

  await page.goto(`${APP}/sign-in`);
  check("signed-in visit to /sign-in goes to Today", new URL(page.url()).pathname === "/");

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email").waitFor();
  check("sign out clears the session", (await t.ctx.cookies()).every((c) => !c.name.startsWith("sb-") || !c.value));

  // A leftover ?next= to a missing page shows the friendly 404 after sign-in.
  await page.goto(`${APP}/no-such-page`);
  await t.signIn();
  await page.getByText("This page wandered off").waitFor();
  await page.getByRole("link", { name: "Back to today" }).click();
  await page.getByText("Today's missions").waitFor();
  check("friendly 404 after sign-in; Back to today works", true);

  // Stale session: the account disappears (e.g. db:reset) while still signed in.
  t.sql(`delete from auth.users where email='${t.email}'`);
  await page.getByRole("button", { name: "Start check-in" }).click();
  await page.getByRole("button", { name: "Okay", exact: true }).first().click();
  await page.getByRole("button", { name: "Steady", exact: true }).click();
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await page.waitForURL(/\/sign-in/, { timeout: 10000 });
  const token = (await t.ctx.cookies()).filter((c) => c.name === "sb-127-auth-token" || /auth-token\.\d$/.test(c.name));
  check("stale session: saving sends you to sign-in and drops the cookie", token.length === 0);
  await page.goto(APP);
  await page.getByLabel("Email").waitFor();
  check("no redirect loop afterwards", new URL(page.url()).pathname === "/sign-in");
  await t.signIn();
  await page.getByRole("button", { name: "Start check-in" }).click();
  await page.getByRole("button", { name: "Okay", exact: true }).first().click();
  await page.getByRole("button", { name: "Steady", exact: true }).click();
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await page.getByRole("button", { name: "Re-check in" }).waitFor();
  check("signing in again works and check-in saves", true);
  check("no console or page errors", t.errors.length === 0, t.errors.join(" | "));
}, { viewport: { width: 390, height: 844 }, ignoreConsole: ["status of 404"] }); // the 404 visit is deliberate
