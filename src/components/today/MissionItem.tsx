"use client";

import { useState, useTransition } from "react";
import { QUICK_TASK_THRESHOLD_MIN, taskXp } from "@/engine";
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
}: {
  mission: Mission;
  day: MissionDay;
  /** Present only for today's missions; tomorrow's can't be completed yet. */
  onToggle?: (done: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
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
            <div className="flex flex-wrap gap-2 border-t border-line pt-3 text-sm">
              {!done && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startTransition(() => moveMission(mission.id, otherDay).then(() => setEditing(false)))}
                  className="rounded-card px-3 py-1.5 text-accent hover:bg-accent-soft disabled:opacity-60"
                >
                  Move to {otherDay}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Delete “${mission.title}”?`)) startTransition(() => deleteMission(mission.id).then(() => {}));
                }}
                className="rounded-card px-3 py-1.5 text-warn hover:bg-warn-soft disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          }
        />
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-3 py-3">
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
    </li>
  );
}
