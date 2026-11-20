"use client";

import { useActionState, useId, useState } from "react";
import { calculateCapacity, capacityLimiters, checkLoad, type Mood, type Rating } from "@/engine";
import { submitCheckin, type CheckinFormState } from "@/app/actions/checkin";
import { Card, Chip, SectionLabel } from "@/components/ui";
import { formatMinutes } from "@/lib/format";
import { AVAILABLE_MIN, ENERGY_LABEL, FOCUS_LABEL, MOOD_EMOJI, MOOD_LABEL, MOODS, RATINGS } from "@/lib/labels";
import type { LatestCheckin } from "@/lib/missions/server";

/** Today's capacity: a prompt to check in, the check-in form, or the capacity report. */
export function CapacityCard({
  checkin,
  plannedMinutes,
  optionalOpen,
}: {
  checkin: LatestCheckin | null;
  plannedMinutes: number;
  /** Optional missions not done yet: the first ones to move when overloaded. */
  optionalOpen: number;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <Card className="flex flex-col gap-4">
        <div>
          <SectionLabel>{checkin ? "Re-check in" : "Morning check-in"}</SectionLabel>
          <p className="mt-1 text-sm text-ink-muted">
            {checkin
              ? "Energy changed? Update your plan for the rest of the day. Your XP target can go down, never up."
              : "Four quick questions to size today to how you actually feel."}
          </p>
        </div>
        <CheckinForm previous={checkin} onSaved={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </Card>
    );
  }

  if (!checkin) {
    return (
      <Card className="flex flex-col gap-3">
        <SectionLabel>Today&apos;s capacity</SectionLabel>
        <p className="text-sm text-ink-muted">
          How are you starting the day? A quick check-in shows how much of your{" "}
          {plannedMinutes > 0 ? `${formatMinutes(plannedMinutes)} plan` : "day"} is realistic and sets today&apos;s XP
          target.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start rounded-card bg-accent px-4 py-2 font-medium text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Start check-in
        </button>
      </Card>
    );
  }

  const report = calculateCapacity({
    availableMinutes: checkin.availableMinutes,
    energy: checkin.energy,
    focus: checkin.focus,
  });
  const load = checkLoad(plannedMinutes, checkin.recommendedMinutes);
  // The bar spans all the time the user gave, so the parts add up to it.
  const total = Math.max(1, checkin.availableMinutes);
  const parts: { label: string; minutes: number; className: string; style?: React.CSSProperties }[] = [
    { label: "Deep work", minutes: report.deepWorkMinutes, className: "bg-accent" },
    { label: "Light work", minutes: report.lightWorkMinutes, className: "bg-xp" },
    { label: "Buffer", minutes: report.bufferMinutes, className: "bg-line" },
    ...(report.setAsideMinutes > 0 ? [{ label: "Set aside", minutes: report.setAsideMinutes, className: "", style: HATCH }] : []),
  ];

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <SectionLabel>Today&apos;s capacity</SectionLabel>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-xp">{formatMinutes(checkin.recommendedMinutes)}</p>
          <p className="text-sm text-ink-muted">
            recommended focus work · about {report.focusSessions} {report.focusSessions === 1 ? "session" : "sessions"}{" "}
            of 25 min
          </p>
        </div>
        {plannedMinutes > 0 && (
          <Chip tone={load.overloaded ? "warn" : "xp"}>{load.overloaded ? "Over capacity" : "Balanced day"}</Chip>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          {parts.map((p) => (
            <div key={p.label} className={p.className} style={{ ...p.style, width: `${(p.minutes / total) * 100}%` }} />
          ))}
        </div>
        <dl className={`grid gap-2 text-sm ${parts.length > 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
          {parts.map((p) => (
            <div key={p.label} className="flex flex-col">
              <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
                <span className={`size-2 rounded-full ${p.className}`} style={p.style} aria-hidden />
                {p.label}
              </dt>
              <dd className="font-medium tabular-nums">{formatMinutes(p.minutes)}</dd>
            </div>
          ))}
        </dl>
        {report.setAsideMinutes > 0 && (
          <p className="text-xs text-ink-muted">
            {formatMinutes(report.setAsideMinutes)} of your {formatMinutes(checkin.availableMinutes)} is set aside because{" "}
            {setAsideReason(checkin.energy, checkin.focus)}. That&apos;s room to recover, not time lost.
          </p>
        )}
      </div>

      {load.overloaded && (
        <p className="rounded-card bg-warn-soft px-4 py-3 text-sm text-warn">
          You&apos;ve planned {formatMinutes(plannedMinutes)}, {formatMinutes(load.overByMinutes)} more than today&apos;s
          capacity.{" "}
          {optionalOpen > 0
            ? `Consider moving ${optionalOpen === 1 ? "your Optional mission" : "an Optional mission"} to tomorrow.`
            : "Consider moving a mission to tomorrow."}{" "}
          That&apos;s planning, not falling behind.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p className="text-xs text-ink-muted">
          Checked in at {checkin.time} · energy {ENERGY_LABEL[checkin.energy]} · focus {FOCUS_LABEL[checkin.focus]}
          {checkin.mood && ` · ${MOOD_LABEL[checkin.mood]}`} · {formatMinutes(checkin.availableMinutes)} available
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-card px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
        >
          Re-check in
        </button>
      </div>
    </Card>
  );
}

function CheckinForm({
  previous,
  onSaved,
  onCancel,
}: {
  previous: LatestCheckin | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [energy, setEnergy] = useState<Rating | null>(previous?.energy ?? null);
  const [focus, setFocus] = useState<Rating | null>(previous?.focus ?? null);
  const [mood, setMood] = useState<Mood | null>(previous?.mood ?? null);
  const [minutes, setMinutes] = useState(previous ? Math.min(previous.availableMinutes, 240) : 240);
  const uid = useId();

  const [state, formAction, pending] = useActionState<CheckinFormState, FormData>(
    async (prev, form) => {
      const next = await submitCheckin(prev, form);
      if (next.savedCount > prev.savedCount) onSaved();
      return next;
    },
    { savedCount: 0 },
  );
  const err = state.errors ?? {};
  const preview = energy && focus ? calculateCapacity({ availableMinutes: minutes, energy, focus }) : null;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="energy" value={energy ?? ""} />
      <input type="hidden" name="focus" value={focus ?? ""} />
      <input type="hidden" name="mood" value={mood ?? ""} />

      <RatingPicker
        question="How is your energy?"
        labels={ENERGY_LABEL}
        icon={(r) => <BatteryIcon level={r} />}
        value={energy}
        onChange={setEnergy}
        error={energy ? undefined : err.energy}
      />
      <RatingPicker
        question="How focused do you feel?"
        labels={FOCUS_LABEL}
        icon={(r) => <FocusIcon level={r} />}
        value={focus}
        onChange={setFocus}
        error={focus ? undefined : err.focus}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">
          What&apos;s your mood? <span className="font-normal text-ink-muted">(optional)</span>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {MOODS.map((m) => {
            const selected = mood === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={selected}
                onClick={() => setMood(selected ? null : m)}
                className={`flex items-center gap-1.5 rounded-chip border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
                  selected ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-ink-muted hover:bg-canvas"
                }`}
              >
                <span aria-hidden>{MOOD_EMOJI[m]}</span>
                {MOOD_LABEL[m]}
              </button>
            );
          })}
        </div>
        {err.mood && <FieldError>{err.mood}</FieldError>}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${uid}-time`} className="text-sm font-medium">
          {previous ? "How much focused time do you have left today?" : "How much time can you give to focused work today?"}
        </label>
        <p className="text-2xl font-semibold tabular-nums" aria-hidden>
          {formatHours(minutes)}
        </p>
        <input
          id={`${uid}-time`}
          type="range"
          name="availableMinutes"
          min={AVAILABLE_MIN.min}
          max={AVAILABLE_MIN.max}
          step={AVAILABLE_MIN.step}
          value={minutes}
          aria-valuetext={formatHours(minutes)}
          onChange={(e) => setMinutes(e.target.valueAsNumber)}
          className="w-full accent-[var(--color-accent)]"
        />
        <div className="flex justify-between text-xs text-ink-muted">
          <span>30 min</span>
          <span>10 hours</span>
        </div>
        {err.availableMinutes && <FieldError>{err.availableMinutes}</FieldError>}
      </div>

      <p className="rounded-card bg-surface-2 px-4 py-3 text-sm text-ink-muted" aria-live="polite">
        {preview ? (
          <>
            Of your {formatMinutes(minutes)}: about{" "}
            <span className="font-medium text-ink">{formatMinutes(preview.recommendedMinutes)}</span> of focused work (
            {preview.focusSessions} {preview.focusSessions === 1 ? "session" : "sessions"})
            {preview.setAsideMinutes > 0 ? ", " : " and "}
            <span className="font-medium text-ink">{formatMinutes(preview.bufferMinutes)}</span> of buffer for the
            unexpected
            {preview.setAsideMinutes > 0 && energy && focus && (
              <>
                , and <span className="font-medium text-ink">{formatMinutes(preview.setAsideMinutes)}</span> set aside
                because {setAsideReason(energy, focus)}
              </>
            )}
            .
          </>
        ) : (
          "Pick your energy and focus to see a realistic workload."
        )}
      </p>

      {state.message && <FieldError>{state.message}</FieldError>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-card bg-accent px-4 py-2 font-medium text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {pending ? "Saving…" : previous ? "Update my plan" : "Check in"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-card px-3 py-2 text-sm text-ink-muted hover:bg-surface-2">
          Cancel
        </button>
      </div>
    </form>
  );
}

function RatingPicker({
  question,
  labels,
  icon,
  value,
  onChange,
  error,
}: {
  question: string;
  labels: Record<Rating, string>;
  icon: (r: Rating) => React.ReactNode;
  value: Rating | null;
  onChange: (r: Rating) => void;
  error?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{question}</legend>
      <div className="grid grid-cols-5 gap-1.5">
        {RATINGS.map((r) => {
          const selected = value === r;
          return (
            <button
              key={r}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(r)}
              className={`flex flex-col items-center gap-1.5 rounded-card border px-1 py-2.5 text-[11px] leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent sm:text-xs ${
                selected ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-ink-muted hover:bg-canvas"
              }`}
            >
              {icon(r)}
              {labels[r]}
            </button>
          );
        })}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </fieldset>
  );
}

/** Battery with 1–5 bars. */
function BatteryIcon({ level }: { level: Rating }) {
  return (
    <svg viewBox="0 0 28 16" className="h-4 w-7" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1.5" width="23" height="13" rx="3" />
      <rect x="25" y="5.5" width="2" height="5" rx="1" fill="currentColor" stroke="none" />
      {Array.from({ length: level }, (_, i) => (
        <rect key={i} x={3.5 + i * 4} y="4" width="2.8" height="8" rx="0.8" fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}

/** From fog (faint, broken rings) to a sharp target. */
function FocusIcon({ level }: { level: Rating }) {
  const rings = [7, 4.5, 2];
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      {rings.map((radius, i) => {
        const shown = i < Math.max(1, level - 2) || level <= 2;
        if (!shown) return null;
        const dashed = level <= 2;
        return (
          <circle
            key={radius}
            cx="8"
            cy="8"
            r={radius}
            strokeDasharray={dashed ? (level === 1 ? "1 2.5" : "2.5 2") : undefined}
            opacity={level === 1 ? 0.6 : 1}
          />
        );
      })}
      {level >= 3 && <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />}
    </svg>
  );
}

function formatHours(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return Number.isInteger(h) ? `${h} ${h === 1 ? "hour" : "hours"}` : formatMinutes(minutes);
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm text-warn">
      {children}
    </p>
  );
}

/** Diagonal stripes for "set aside": time that exists but isn't planned. */
const HATCH: React.CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, var(--color-line) 0 2px, transparent 2px 5px)",
};

/** "your energy is Okay", "your focus is Scattered", "your energy is Low and focus is Foggy". */
function setAsideReason(energy: Rating, focus: Rating): string {
  const why = capacityLimiters(energy, focus).map((k) =>
    k === "energy" ? `energy is ${ENERGY_LABEL[energy]}` : `focus is ${FOCUS_LABEL[focus]}`,
  );
  return `your ${why.join(" and ")}`;
}
