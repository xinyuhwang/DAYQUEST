#!/usr/bin/env node
/**
 * Local development helper: prints the latest DAYQUEST sign-in code sent to an
 * email address, read from the local Supabase test inbox (Mailpit).
 *
 *   pnpm dev:code you@example.test
 *
 * Only works against the local stack; real emails are never involved.
 */

const MAILPIT = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const email = process.argv[2];

if (!email) {
  console.error("Usage: pnpm dev:code <email>");
  process.exit(1);
}

async function latestCode(to) {
  const query = encodeURIComponent(`to:"${to}"`);
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${query}&limit=1`);
  if (!res.ok) throw new Error(`Mailpit returned ${res.status}`);
  const { messages = [] } = await res.json();
  if (messages.length === 0) return null;

  const msg = await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json();
  const code = (msg.Text || msg.HTML || "").match(/\b(\d{6})\b/)?.[1];
  return code ? { code, sentAt: new Date(msg.Date) } : null;
}

try {
  // Wait briefly in case the email is still on its way.
  for (let attempt = 0; attempt < 10; attempt++) {
    const found = await latestCode(email);
    if (found) {
      const minutes = Math.round((Date.now() - found.sentAt.getTime()) / 60000);
      console.log(found.code);
      console.error(`(sent ${minutes <= 0 ? "just now" : `${minutes} min ago`}; codes expire after 10 minutes)`);
      process.exit(0);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error(`No sign-in email for ${email} yet. Request a code on the sign-in page first.`);
  process.exit(1);
} catch (err) {
  console.error(`Couldn't reach the local inbox at ${MAILPIT}. Is Supabase running? (pnpm db:start)`);
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
