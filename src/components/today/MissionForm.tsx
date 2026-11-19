"use client";

import { useActionState, useId, useRef, useState } from "react";
import { taskXp, type Category, type Difficulty, type Importance } from "@/engine";
import type { MissionFormState } from "@/app/actions/missions";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  DURATION_PRESETS,
  IMPORTANCES,
  IMPORTANCE_LABEL,
} from "@/lib/labels";
import type { MissionDay } from "@/lib/missions/validate";

export interface MissionDraft {
  id?: string;
  title: string;
  category: Category;
  importance: Importance;
  difficulty: Difficulty;
  estimatedMinutes: number;
}

const EMPTY: MissionDraft = {
  title: "",
  category: "deep_work",
  importance: "normal",
  difficulty: "medium",
  estimatedMinutes: 30,
};

type Action = (prev: MissionFormState, form: FormData) => Promise<MissionFormState>;

/** Shared add/edit form. Calls `onSaved` after each successful save. */
export function MissionForm({
  action,
  initial = EMPTY,
  day,
  submitLabel,
  onSaved,
  onCancel,
  extraActions,
}: {
  action: Action;
  initial?: MissionDraft;
  day: MissionDay;
  submitLabel: string;
  onSaved?: () => void;
  onCancel?: () => void;
  extraActions?: React.ReactNode;
}) {
  const [draft, setDraft] = useState(initial);
  const titleRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  const [state, formAction, pending] = useActionState<MissionFormState, FormData>(
    async (prev, form) => {
      const next = await action(prev, form);
      if (next.savedCount > prev.savedCount) {
        // Saved: clear an add form (keeping the category) and let the parent react.
        if (!initial.id) setDraft((d) => ({ ...EMPTY, category: d.category }));
        onSaved?.();
        titleRef.current?.focus();
      }
      return next;
    },
    { savedCount: 0 },
  );

  const isPreset = (DURATION_PRESETS as readonly number[]).includes(draft.estimatedMinutes);
  const [customDuration, setCustomDuration] = useState(!isPreset);
  const xp = taskXp(draft, "completed");
  const err = state.errors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="day" value={day} />
      <input type="hidden" name="category" value={draft.category} />
      <input type="hidden" name="importance" value={draft.importance} />
      <input type="hidden" name="difficulty" value={draft.difficulty} />
      <input type="hidden" name="estMinutes" value={draft.estimatedMinutes} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-title`} className="text-sm font-medium">
          Mission
        </label>
        <input
          ref={titleRef}
          id={`${uid}-title`}
          name="title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          maxLength={200}
          autoComplete="off"
          placeholder="What do you want to accomplish?"
          aria-invalid={Boolean(err.title)}
          aria-describedby={err.title ? `${uid}-title-err` : undefined}
          className="w-full rounded-card border border-line bg-surface px-3.5 py-2.5 text-base placeholder:text-ink-muted/70 focus:border-accent focus:outline-2 focus:outline-offset-1 focus:outline-accent aria-[invalid=true]:border-warn"
        />
        {err.title && <FieldError id={`${uid}-title-err`}>{err.title}</FieldError>}
      </div>

      <Segmented
        label="Duration"
        options={[...DURATION_PRESETS.map((m) => ({ value: String(m), label: `${m}m` })), { value: "custom", label: "Custom" }]}
        value={customDuration ? "custom" : String(draft.estimatedMinutes)}
        onChange={(v) => {
          if (v === "custom") setCustomDuration(true);
          else {
            setCustomDuration(false);
            setDraft({ ...draft, estimatedMinutes: Number(v) });
          }
        }}
      />
      {customDuration && (
        <div className="-mt-2 flex items-center gap-2">
          <label htmlFor={`${uid}-min`} className="text-sm text-ink-muted">
            Minutes
          </label>
          <input
            id={`${uid}-min`}
            type="number"
            min={1}
            max={600}
            inputMode="numeric"
            value={Number.isFinite(draft.estimatedMinutes) ? draft.estimatedMinutes : ""}
            onChange={(e) => setDraft({ ...draft, estimatedMinutes: e.target.valueAsNumber })}
            className="w-24 rounded-card border border-line bg-surface px-3 py-1.5 text-base focus:border-accent focus:outline-2 focus:outline-accent"
          />
        </div>
      )}
      {err.estMinutes && <FieldError>{err.estMinutes}</FieldError>}

      <Segmented
        label="Importance"
        options={IMPORTANCES.map((v) => ({ value: v, label: IMPORTANCE_LABEL[v] }))}
        value={draft.importance}
        onChange={(v) => setDraft({ ...draft, importance: v as Importance })}
      />
      <Segmented
        label="Difficulty"
        options={DIFFICULTIES.map((v) => ({ value: v, label: DIFFICULTY_LABEL[v] }))}
        value={draft.difficulty}
        onChange={(v) => setDraft({ ...draft, difficulty: v as Difficulty })}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${uid}-cat`} className="text-sm font-medium">
          Category
        </label>
        <select
          id={`${uid}-cat`}
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value as Category })}
          className="w-full rounded-card border border-line bg-surface px-3 py-2.5 text-base focus:border-accent focus:outline-2 focus:outline-accent sm:w-56"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      {state.message && <FieldError>{state.message}</FieldError>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-card bg-accent px-4 py-2 font-medium text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-card px-3 py-2 text-sm text-ink-muted hover:bg-surface-2">
            Cancel
          </button>
        )}
        <span className="ml-auto text-sm text-ink-muted">
          Worth <span className="font-medium text-xp">+{Number.isFinite(xp) ? xp : 0} XP</span>
        </span>
      </div>
      {extraActions}
    </form>
  );
}

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(o.value)}
              className={`rounded-chip border px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
                selected ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface text-ink-muted hover:bg-canvas"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="text-sm text-warn">
      {children}
    </p>
  );
}
