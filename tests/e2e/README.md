# Browser tests

End-to-end checks that drive the real app in Chrome, against the **local** stack only.

```bash
pnpm db:start          # local Supabase (Docker)
pnpm dev               # the app, default http://localhost:3000
pnpm test:e2e          # all suites
pnpm test:e2e focus    # one suite (auth, missions, xp, checkin, focus, wrapup, settings)
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `E2E_URL` | `http://localhost:3000` | where the app runs |
| `MAILPIT_URL` | `http://127.0.0.1:54324` | local inbox for sign-in codes |
| `E2E_DB_CONTAINER` | `supabase_db_dayquest` | database container for checks |
| `E2E_BROWSER` | `chrome` | Playwright channel (uses your installed Chrome) |
| `HEADED` | unset | set to `1` to watch the browser |

How it works:

- Each suite signs up throwaway users (`e2e-<suite>+…@example.test`), reads codes from Mailpit, and deletes those users when it finishes, pass or fail.
- Checks read the database with `psql` inside the local container. Some suites also *write* to it to set up state:
  - moving a focus session's start back to simulate elapsed time;
  - changing the test user's time zone to reach 8 PM.
- Screenshots go to `tests/e2e/screenshots/` (git-ignored).
- The exit code is non-zero if any check fails. The runner checks first that the app, Mailpit and the database are reachable.

Never point these at a hosted project.
