"use client";

import { useActionState, useId, useState } from "react";
import { DAILY_BONUS_XP } from "@/engine";
import { wrapUpDay, type WrapUpFormState } from "@/app/actions/reflection";
import { Card, Chip, SectionLabel } from "@/components/ui";
import { formatMinutes } from "@/lib/format";
import { IMPORTANCE_LABEL } from "@/lib/labels";
import type { WrapUp } from "@/lib/reflection/server";
import { NOTES_MAX } from "@/lib/reflection/validate";

const BONUS = DAILY_BONUS_XP.reflection;

/**
 * The evening reflection (§3 step 8): a summary of the day and a gentle
 * carry-over, where the user picks which unfinished missions move on.
 * Also used the next day for a missed evening ("yesterday's loose ends").
 */
export function WrapUpCard({ wrapUp }: { wrapUp: WrapUp }) {
  const [open, setOpen] = useState(false);
  const tonight = wrapUp.day === "today";
  const nextDay = tonight ? "tomorrow" : "today";

  if (wrapUp.reflection) {
    const { carried, notes } = wrapUp.reflection;
    return (
      <Card className="flex flex-col gap-2" aria-label="Day wrapped up">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel>Day wrapped up</SectionLabel>
          <Chip tone="xp">+{BONUS} XP · Evening reflection</Chip>
        </div>
        <p className="text-sm text-ink-muted">
          {carried > 0
            ? `${carried} ${carried === 1 ? "mission" : "missions"} carried to ${nextDay}.`
            : "Nothing carried over."}{" "}
          Rest well.
        </p>
        {notes && <p className="line-clamp-3 border-l-2 border-line pl-3 text-sm italic text-ink-muted">{notes}</p>}
      </Card>
    );
  }

  const { summary, unfinished } = wrapUp;
  return (
    <Card className="flex flex-col gap-4" aria-label={tonight ? "Evening reflection" : "Yesterday's loose ends"}>
      <div>
        <SectionLabel>{tonight ? "Evening reflection" : "Yesterday's loose ends"}</SectionLabel>
        <p className="mt-1 text-sm text-ink-muted">
          {tonight
            ? "How did today go? Wrap it up and give tomorrow an easy start."
            : `You didn't wrap up ${wrapUp.dayLabel}. ${unfinished.length} ${
                unfinished.length === 1 ? "mission was" : "missions were"
              } left unfinished. Bring any into today?`}
        </p>
      </div>

      {tonight && (
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <Stat label="Missions" value={`${summary.done} / ${summary.total}`} />
          <Stat label="XP earned" value={String(summary.xp)} />
          <Stat
            label="Focus"
            value={summary.focusMinutes > 0 ? formatMinutes(summary.focusMinutes) : "—"}
          />
        </dl>
      )}

      {open ? (
        <WrapUpForm wrapUp={wrapUp} onCancel={() => setOpen(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start rounded-card bg-accent px-4 py-2 font-medium text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {tonight ? "Wrap up the day" : "Sort out yesterday"}
        </button>
      )}
    </Card>
  );
}

function WrapUpForm({ wrapUp, onCancel }: { wrapUp: WrapUp; onCancel: () => void }) {
  const tonight = wrapUp.day === "today";
  const nextDay = tonight ? "tomorrow" : "today";
  const uid = useId();
  // Optional missions start unticked: a nudge to let them go rather than pile up.
  const [carry, setCarry] = useState<Set<string>>(
    () => new Set(wrapUp.unfinished.filter((m) => m.importance !== "optional").map((m) => m.id)),
  );
  const [state, formAction, pending] = useActionState<WrapUpFormState, FormData>(wrapUpDay, { savedCount: 0 });

  const carriedMinutes = wrapUp.unfinished.filter((m) => carry.has(m.id)).reduce((s, m) => s + m.estimatedMinutes, 0);
  const total = wrapUp.nextDayMinutes + carriedMinutes;
  const toggle = (id: string) =>
    setCarry((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="day" value={wrapUp.day} />

      {wrapUp.unfinished.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Carry to {nextDay}</legend>
          <p className="mb-1 text-xs text-ink-muted">
            Unticked missions stay on {tonight ? "today" : wrapUp.dayLabel}. Optional ones start unticked.
          </p>
          <ul className="flex flex-col gap-1">
            {wrapUp.unfinished.map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-card px-2 py-2 hover:bg-canvas">
                  <input
                    type="checkbox"
                    name="carry"
                    value={m.id}
                    checked={carry.has(m.id)}
                    onChange={() => toggle(m.id)}
                    className="size-4 shrink-0 accent-[var(--color-accent)]"
                  />
                  <span className="min-w-0 flex-1 break-words text-sm">{m.title}</span>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {IMPORTANCE_LABEL[m.importance]} · {formatMinutes(m.estimatedMinutes)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="rounded-card bg-surface-2 px-4 py-3 text-sm text-ink-muted" aria-live="polite">
            {total > 0 ? (
              <>
                {tonight ? "Tomorrow" : "Today"} will have{" "}
                <span className="font-medium text-ink">{formatMinutes(total)}</span> planned
                {carriedMinutes > 0 && `, including ${formatMinutes(carriedMinutes)} carried over`}.
              </>
            ) : (
              `Nothing planned for ${nextDay} yet. A clean slate.`
            )}
          </p>
        </fieldset>
      ) : (
        <p className="rounded-card bg-xp-soft px-4 py-3 text-sm text-xp">Every mission done. Nothing to carry over.</p>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor={`${uid}-notes`} className="text-sm font-medium">
          Anything worth remembering? <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <textarea
          id={`${uid}-notes`}
          name="notes"
          rows={3}
          maxLength={NOTES_MAX}
          placeholder="What went well, what got in the way…"
          className="w-full rounded-card border border-line bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-muted"
        />
      </div>

      {state.message && (
        <p role="alert" className="text-sm text-warn">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-card bg-accent px-4 py-2 font-medium text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {pending ? "Saving…" : `${tonight ? "Finish the day" : "Wrap up yesterday"} · +${BONUS} XP`}
        </button>
        <button type="button" onClick={onCancel} className="rounded-card px-3 py-2 text-sm text-ink-muted hover:bg-surface-2">
          Cancel
        </button>
      </div>
    </form>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-surface-2 px-3 py-2">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
