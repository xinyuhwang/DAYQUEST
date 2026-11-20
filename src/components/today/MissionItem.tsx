"use client";

import { useState, useTransition } from "react";
import { CUSTOM_FOCUS_RANGE, FOCUS_PRESETS, QUICK_TASK_THRESHOLD_MIN, taskXp } from "@/engine";
import { startFocus } from "@/app/actions/focus";
import { deleteMission, moveMission, updateMission } from "@/app/actions/missions";
import { Chip } from "@/components/ui";
import { formatMinutes } from "@/lib/format";
import { CATEGORY_LABEL, DIFFICULTY_LABEL, IMPORTANCE_LABEL } from "@/lib/labels";
import type { Mission } from "@/lib/missions/server";
import type { MissionDay } from "@/lib/missions/validate";
import { MissionForm } from "./MissionForm";

export function MissionItem({
  mission,
  day,
  onToggle,
  canFocus = false,
  focusing = false,
}: {
  mission: Mission;
  day: MissionDay;
  /** Present only for today's missions; tomorrow's can't be completed yet. */
  onToggle?: (done: boolean) => void;
  /** Show the Focus button (today's open missions, when no session is running). */
  canFocus?: boolean;
  /** A focus session is running on this mission: it can't be moved or deleted. */
  focusing?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const done = mission.status === "done";
  const xp = taskXp(mission, "completed");
  const quick = mission.estimatedMinutes < QUICK_TASK_THRESHOLD_MIN;
  const otherDay: MissionDay = day === "today" ? "tomorrow" : "today";

  if (editing) {
    return (
      <li className="rounded-card bg-canvas p-4">
        <MissionForm
          action={updateMission}
          initial={mission}
          day={day}
          submitLabel="Save changes"
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
          extraActions={
            focusing ? (
              <p className="border-t border-line pt-3 text-sm text-ink-muted">
                A focus session is running on this mission. Finish it to move or delete the mission.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
                {!done && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await moveMission(mission.id, otherDay);
                        if (r.ok) setEditing(false);
                        else setActionError(r.error ?? "Couldn't move the mission.");
                      })
                    }
                    className="rounded-card px-3 py-1.5 text-accent hover:bg-accent-soft disabled:opacity-60"
                  >
                    Move to {otherDay}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Delete “${mission.title}”?`)) return;
                    startTransition(async () => {
                      const r = await deleteMission(mission.id);
                      if (!r.ok) setActionError(r.error ?? "Couldn't delete the mission.");
                    });
                  }}
                  className="rounded-card px-3 py-1.5 text-warn hover:bg-warn-soft disabled:opacity-60"
                >
                  Delete
                </button>
                {actionError && (
                  <p role="alert" className="w-full text-warn">
                    {actionError}
                  </p>
                )}
              </div>
            )
          }
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 py-3">
      <div className="group flex items-start gap-3">
        {onToggle ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={`${done ? "Mark not done" : "Mark done"}: ${mission.title}`}
            onClick={() => onToggle(!done)}
            className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-chip border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              done ? "border-xp bg-xp text-on-accent" : "border-line bg-surface hover:border-xp"
            }`}
          >
            {done && (
              <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ) : (
          <span aria-hidden className="mt-0.5 size-5 shrink-0 rounded-chip border-2 border-dashed border-line" />
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={`font-medium break-words ${done ? "text-ink-muted line-through" : ""}`}>{mission.title}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
            <span>
              {CATEGORY_LABEL[mission.category]} · {formatMinutes(mission.estimatedMinutes)}
            </span>
            <Chip tone={mission.importance === "critical" ? "warn" : "neutral"}>{IMPORTANCE_LABEL[mission.importance]}</Chip>
            <Chip>{DIFFICULTY_LABEL[mission.difficulty]}</Chip>
            {quick && <Chip>Quick task · ½ XP</Chip>}
            {mission.carriedOver && <Chip>↻ Carried over</Chip>}
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Chip tone={done ? "xp" : "accent"}>+{xp} XP</Chip>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-card px-1.5 py-0.5 text-xs text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
            aria-label={`Edit ${mission.title}`}
          >
            Edit
          </button>
        </div>
      </div>
      {canFocus && !done && picking && (
        <FocusPicker missionId={mission.id} title={mission.title} onCancel={() => setPicking(false)} />
      )}
      {canFocus && !done && !picking && (
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-label={`Focus on ${mission.title}`}
          className="ml-8 flex items-center gap-1.5 self-start rounded-chip border border-line px-3 py-1 text-xs font-medium text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
        >
          <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
            <path d="M4 3l9 5-9 5z" fill="currentColor" />
          </svg>
          Focus
        </button>
      )}
    </li>
  );
}

/** Choose a session length and start focus mode. */
function FocusPicker({ missionId, title, onCancel }: { missionId: string; title: string; onCancel: () => void }) {
  const [minutes, setMinutes] = useState(25);
  const [custom, setCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, startTransition] = useTransition();
  const start = () =>
    startTransition(async () => {
      const r = await startFocus(missionId, minutes);
      if (r?.error) setError(r.error);
    });

  return (
    <div className="ml-8 flex flex-col gap-3 rounded-card bg-canvas p-3" role="group" aria-label={`Focus session for ${title}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {FOCUS_PRESETS.map((p) => (
          <button
            key={p.focusMinutes}
            type="button"
            aria-pressed={!custom && minutes === p.focusMinutes}
            onClick={() => {
              setCustom(false);
              setMinutes(p.focusMinutes);
            }}
            className={`rounded-chip border px-3 py-1 text-sm ${
              !custom && minutes === p.focusMinutes
                ? "border-accent bg-accent-soft font-medium text-accent"
                : "border-line bg-surface text-ink-muted hover:bg-canvas"
            }`}
          >
            {p.focusMinutes}/{p.breakMinutes}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={custom}
          onClick={() => setCustom(true)}
          className={`rounded-chip border px-3 py-1 text-sm ${
            custom ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-ink-muted hover:bg-canvas"
          }`}
        >
          Custom
        </button>
        {custom && (
          <label className="flex items-center gap-1.5 text-sm text-ink-muted">
            <input
              type="number"
              min={CUSTOM_FOCUS_RANGE.min}
              max={CUSTOM_FOCUS_RANGE.max}
              value={Number.isFinite(minutes) ? minutes : ""}
              onChange={(e) => setMinutes(e.target.valueAsNumber)}
              className="w-16 rounded-card border border-line bg-surface px-2 py-1 text-base text-ink"
            />
            min
          </label>
        )}
      </div>
      <p className="text-xs text-ink-muted">
        {minutes >= 10
          ? `Earns +${Math.round((minutes * 10) / 25)} XP when you finish, on top of the mission's XP.`
          : "Sessions under 10 minutes don't earn focus XP."}
      </p>
      {error && (
        <p role="alert" className="text-sm text-warn">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={starting}
          onClick={start}
          className="rounded-card bg-accent px-4 py-1.5 text-sm font-medium text-on-accent hover:opacity-90 disabled:opacity-60"
        >
          {starting ? "Starting…" : "Start focus"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-card px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-2">
          Cancel
        </button>
      </div>
    </div>
  );
}
