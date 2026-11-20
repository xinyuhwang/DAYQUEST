"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { breakMinutes, FOCUS_EARLY_END_MIN_FRACTION, FOCUS_EARLY_END_XP, focusedMs, remainingMs } from "@/engine";
import {
  completeFocusMission,
  endFocus,
  pauseFocus,
  resumeFocus,
  startFocus,
  type FocusClockState,
  type FocusResult,
} from "@/app/actions/focus";
import { CompanionEgg } from "@/components/Companion";
import { Card } from "@/components/ui";
import { AMBIENT_LABEL, chime, notify, useAmbient, type Ambient } from "./sound";
import { useClock } from "./useClock";

type Phase =
  | { kind: "focus" }
  | { kind: "confirm" }
  | { kind: "result"; result: FocusResult }
  | { kind: "break"; endsAt: number; minutes: number }
  | { kind: "breakOver" };

/** One mission, one countdown, a few controls (§8.1). */
export function FocusMode({
  session,
  taskTitle,
  serverNow,
  completedToday,
}: {
  session: FocusClockState;
  taskTitle: string;
  serverNow: number;
  completedToday: number;
}) {
  const [clock, setClock] = useState(session);
  // Correction applied to the device clock when the server says it's off.
  const [offset, setOffset] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "focus" });
  const [ambient, setAmbient] = useState<Ambient>("off");
  const [error, setError] = useState<string | null>(null);
  const [markedDone, setMarkedDone] = useState(false);
  const [busy, startTransition] = useTransition();
  const finishing = useRef(false);

  const now = useClock(serverNow) + offset;
  const paused = clock.pausedAt !== null;
  const left = remainingMs(clock, now);
  const total = clock.plannedMinutes * 60_000;
  const inSession = phase.kind === "focus" || phase.kind === "confirm";

  useAmbient(ambient, inSession && !paused);

  const finish = (early: boolean) =>
    startTransition(async () => {
      const r = await endFocus(clock.id, early);
      finishing.current = false;
      if ("notYetMs" in r) {
        // The device clock ran fast: line up with the server and keep going.
        setOffset((o) => o + (left - r.notYetMs));
        return;
      }
      if ("error" in r) {
        setError(r.error);
        return;
      }
      setError(null);
      setPhase({ kind: "result", result: r });
      if (!early) {
        chime();
        notify("Focus session complete", r.xp > 0 ? `+${r.xp} XP for “${taskTitle}”` : `Nice work on “${taskTitle}”`);
      }
    });

  // Time's up: end the session automatically.
  useEffect(() => {
    if (phase.kind === "focus" && left === 0 && !finishing.current) {
      finishing.current = true;
      finish(false);
    }
  });

  // Break countdown. When it runs out, the break is over (no extra state needed).
  const breakLeft = phase.kind === "break" ? Math.max(0, phase.endsAt - now) : 0;
  const breakRanOut = phase.kind === "break" && breakLeft === 0;
  const view: Phase["kind"] = breakRanOut ? "breakOver" : phase.kind;
  useEffect(() => {
    if (breakRanOut) {
      chime();
      notify("Break's over", `Ready for another round on “${taskTitle}”?`);
    }
  }, [breakRanOut, taskTitle]);

  // Remaining time in the tab title, so it's visible from other tabs.
  useEffect(() => {
    const previous = document.title;
    document.title =
      view === "break"
        ? `☕ ${formatClock(breakLeft)} · Break`
        : inSession
          ? `${paused ? "⏸ " : ""}${formatClock(left)} · ${taskTitle}`
          : "Focus · DAYQUEST";
    return () => {
      document.title = previous;
    };
  }, [view, breakLeft, left, paused, inSession, taskTitle]);

  const togglePause = () =>
    startTransition(async () => {
      const next = await (paused ? resumeFocus(clock.id) : pauseFocus(clock.id));
      if (next) setClock(next);
      else setError("Couldn't reach the server. Please try again.");
    });

  const again = () =>
    startTransition(async () => {
      const r = await startFocus(clock.taskId, clock.plannedMinutes);
      if (r?.error) setError(r.error);
    });

  const completedNow = completedToday + (phase.kind === "result" && phase.result.outcome === "completed" ? 1 : 0);
  const breakLength = breakMinutes(clock.plannedMinutes, completedNow);
  const focusedSoFar = focusedMs(clock, now);
  const earlyXp = focusedSoFar >= total * FOCUS_EARLY_END_MIN_FRACTION && clock.plannedMinutes >= 10;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-8">
      <Card className="flex flex-col items-center gap-5 text-center">
        <div className="flex w-full items-center justify-between text-sm">
          <Link href="/" className="rounded-card px-2 py-1 text-ink-muted hover:bg-surface-2 hover:text-ink">
            ← Today
          </Link>
          <span className="text-xs font-semibold tracking-wide text-accent">FOCUS MODE</span>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Focusing on</p>
          <h1 className="text-xl font-semibold break-words">{taskTitle}</h1>
        </div>

        {inSession && (
          <>
            <Ring progress={1 - left / total} paused={paused}>
              <span className="text-5xl font-semibold tabular-nums" role="timer" aria-live="off">
                {formatClock(left)}
              </span>
              <span className="text-sm text-ink-muted">{paused ? "Paused" : `of ${clock.plannedMinutes} min`}</span>
            </Ring>

            {phase.kind === "confirm" ? (
              <div className="flex w-full flex-col gap-3 rounded-card bg-surface-2 p-4 text-sm">
                <p>
                  {earlyXp
                    ? `You've focused for over half the session, so you'll get +${FOCUS_EARLY_END_XP} XP.`
                    : "Under half the session counts as practice, so no XP this time. That's okay."}
                </p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => finish(true)}
                    className="rounded-card bg-accent px-4 py-2 font-medium text-on-accent hover:opacity-90 disabled:opacity-60"
                  >
                    End session
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase({ kind: "focus" })}
                    className="rounded-card px-4 py-2 text-ink-muted hover:bg-surface"
                  >
                    Keep going
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={togglePause}
                  className="min-w-28 rounded-card bg-accent px-5 py-2.5 font-medium text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
                >
                  {paused ? "Resume" : "Pause"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPhase({ kind: "confirm" })}
                  className="rounded-card border border-line px-4 py-2.5 text-ink-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
                >
                  End early
                </button>
              </div>
            )}

            <AmbientPicker value={ambient} onChange={setAmbient} />
            <NotifyToggle />
          </>
        )}

        {phase.kind === "result" && (
          <Result
            result={phase.result}
            breakLength={breakLength}
            busy={busy}
            markedDone={markedDone}
            onBreak={() => setPhase({ kind: "break", minutes: breakLength, endsAt: now + breakLength * 60_000 })}
            onMarkDone={() =>
              startTransition(async () => {
                const r = await completeFocusMission(clock.taskId);
                if (r.ok) setMarkedDone(true);
                else setError("Couldn't mark the mission done.");
              })
            }
            onAgain={again}
            plannedMinutes={clock.plannedMinutes}
          />
        )}

        {phase.kind === "break" && view === "break" && (
          <>
            <Ring progress={1 - breakLeft / (phase.minutes * 60_000)} tone="xp">
              <span className="text-5xl font-semibold tabular-nums" role="timer">
                {formatClock(breakLeft)}
              </span>
              <span className="text-sm text-ink-muted">break</span>
            </Ring>
            <p className="text-sm text-ink-muted">Stand up, stretch, get some water. The timer will chime when it&apos;s time.</p>
            <button
              type="button"
              onClick={() => setPhase({ kind: "breakOver" })}
              className="rounded-card px-4 py-2 text-sm text-ink-muted hover:bg-surface-2"
            >
              Skip break
            </button>
          </>
        )}

        {view === "breakOver" && (
          <div className="flex flex-col items-center gap-3">
            <CompanionEgg className="size-12" />
            <p className="font-medium">Break&apos;s over. Ready for another round?</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                disabled={busy || markedDone}
                onClick={again}
                className="rounded-card bg-accent px-4 py-2 font-medium text-on-accent hover:opacity-90 disabled:opacity-60"
              >
                Start {clock.plannedMinutes} min
              </button>
              <Link href="/" className="rounded-card px-4 py-2 text-ink-muted hover:bg-surface-2">
                Back to Today
              </Link>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-warn">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}

function Result({
  result,
  breakLength,
  busy,
  markedDone,
  plannedMinutes,
  onBreak,
  onMarkDone,
  onAgain,
}: {
  result: FocusResult;
  breakLength: number;
  busy: boolean;
  markedDone: boolean;
  plannedMinutes: number;
  onBreak: () => void;
  onMarkDone: () => void;
  onAgain: () => void;
}) {
  const { outcome, xp, focusedMinutes } = result;
  const heading =
    outcome === "completed" ? "Session complete!" : outcome === "ended_early" ? "Good effort" : "Session ended";
  const detail =
    outcome === "abandoned"
      ? "Short sessions are practice too. No XP this time, and that's okay."
      : xp > 0
        ? `${focusedMinutes} minutes of focus earned +${xp} XP.`
        : `${focusedMinutes} minutes of focus. You've reached today's focus XP cap, so this one is just for you.`;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <CompanionEgg className={`size-14 ${outcome === "completed" ? "motion-safe:animate-bounce" : ""}`} />
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold">{heading}</p>
        <p className="text-sm text-ink-muted">{detail}</p>
        {xp > 0 && <p className="text-3xl font-semibold tabular-nums text-xp">+{xp} XP</p>}
      </div>
      <div className="flex w-full flex-col gap-2">
        {outcome !== "abandoned" && (
          <button
            type="button"
            onClick={onBreak}
            className="rounded-card bg-accent px-4 py-2 font-medium text-on-accent hover:opacity-90"
          >
            Take a {breakLength}-min break
          </button>
        )}
        <button
          type="button"
          disabled={busy || markedDone}
          onClick={onMarkDone}
          className="rounded-card border border-line px-4 py-2 text-ink hover:bg-surface-2 disabled:opacity-60"
        >
          {markedDone ? "Mission done ✓" : "Mark mission done"}
        </button>
        {!markedDone && (
          <button
            type="button"
            disabled={busy}
            onClick={onAgain}
            className="rounded-card px-4 py-2 text-sm text-accent hover:bg-accent-soft disabled:opacity-60"
          >
            Start another {plannedMinutes} min now
          </button>
        )}
        <Link href="/" className="rounded-card px-4 py-2 text-sm text-ink-muted hover:bg-surface-2">
          Back to Today
        </Link>
      </div>
    </div>
  );
}

function Ring({
  progress,
  paused = false,
  tone = "accent",
  children,
}: {
  progress: number;
  paused?: boolean;
  tone?: "accent" | "xp";
  children: React.ReactNode;
}) {
  const r = 88;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <div className="relative grid size-56 place-items-center">
      <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="10" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke={tone === "xp" ? "var(--xp)" : "var(--accent)"}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          opacity={paused ? 0.4 : 1}
          className="transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <div className="relative flex flex-col items-center gap-1">{children}</div>
    </div>
  );
}

function AmbientPicker({ value, onChange }: { value: Ambient; onChange: (v: Ambient) => void }) {
  return (
    <fieldset className="flex flex-col items-center gap-2">
      <legend className="mb-2 text-xs uppercase tracking-wide text-ink-muted">Ambient sound</legend>
      <div className="flex gap-1.5">
        {(Object.keys(AMBIENT_LABEL) as Ambient[]).map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={value === k}
            onClick={() => onChange(k)}
            className={`rounded-chip border px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              value === k ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-ink-muted hover:bg-canvas"
            }`}
          >
            {AMBIENT_LABEL[k]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

const noopSubscribe = () => () => {};

function NotifyToggle() {
  const initial = useSyncExternalStore(
    noopSubscribe,
    () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
    () => "unsupported" as const,
  );
  const [asked, setAsked] = useState<NotificationPermission | null>(null);
  const permission = asked ?? initial;
  if (permission === "unsupported" || permission === "denied") return null;
  if (permission === "granted") return <p className="text-xs text-ink-muted">We&apos;ll notify you when time&apos;s up.</p>;
  return (
    <button
      type="button"
      onClick={() => void Notification.requestPermission().then(setAsked)}
      className="text-xs text-ink-muted underline-offset-4 hover:underline"
    >
      Notify me when time&apos;s up
    </button>
  );
}

function formatClock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
