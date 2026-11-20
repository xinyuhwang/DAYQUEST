"use client";

import { useActionState, useId, useState } from "react";
import { MAX_ROLLOVER_HOUR } from "@/engine";
import { updateDaySettings, type DaySettingsState } from "@/app/actions/settings";
import { Card, SectionLabel } from "@/components/ui";
import { rolloverLabel } from "@/lib/settings/validate";

const HOURS = Array.from({ length: MAX_ROLLOVER_HOUR + 1 }, (_, h) => h);
const field = "w-full rounded-card border border-line bg-surface px-3 py-2 text-base text-ink disabled:opacity-60";

/** Time zone and the hour the day ends (§3). */
export function DaySettingsForm({
  timezone,
  rolloverHour,
  timeZones,
  lockedUntil,
}: {
  timezone: string;
  rolloverHour: number;
  timeZones: string[];
  /** "Sat 3:15 PM" while the 24-hour limit applies; null when changes are allowed. */
  lockedUntil: string | null;
}) {
  const uid = useId();
  const [tz, setTz] = useState(timezone);
  const [hour, setHour] = useState(rolloverHour);
  const [state, formAction, pending] = useActionState<DaySettingsState, FormData>(updateDaySettings, { savedCount: 0 });
  const zones = timeZones.includes(timezone) ? timeZones : [timezone, ...timeZones];
  const changed = tz !== timezone || hour !== rolloverHour;
  const locked = lockedUntil !== null;

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <SectionLabel>Your day</SectionLabel>
        <p className="mt-1 text-sm text-ink-muted">
          These decide when your day starts and ends, so XP, bonuses and the evening reflection line up with your life.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${uid}-tz`} className="text-sm font-medium">
            Time zone
          </label>
          <select id={`${uid}-tz`} name="timezone" value={tz} onChange={(e) => setTz(e.target.value)} disabled={locked} className={field}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor={`${uid}-hour`} className="text-sm font-medium">
            Day ends at
          </label>
          <select
            id={`${uid}-hour`}
            name="rolloverHour"
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            disabled={locked}
            className={field}
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {rolloverLabel(h)}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-muted">
            Work before {rolloverLabel(hour).toLowerCase()} counts toward the evening before, so a late night still belongs to its day.
          </p>
        </div>

        <p className="rounded-card bg-surface-2 px-4 py-3 text-sm text-ink-muted">
          {locked
            ? `You changed these recently. You can change them again after ${lockedUntil}.`
            : "You can change these once every 24 hours, because they decide which day your XP counts toward."}
        </p>

        {state.message && (
          <p role="alert" className="text-sm text-warn">
            {state.message}
          </p>
        )}
        {state.savedCount > 0 && !state.message && !changed && (
          <p role="status" className="text-sm text-xp">
            Saved.
          </p>
        )}

        <button
          type="submit"
          disabled={pending || locked || !changed}
          className="self-start rounded-card bg-accent px-4 py-2 font-medium text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
    </Card>
  );
}
