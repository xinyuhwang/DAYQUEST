"use client";

import { use, useMemo, useState } from "react";
import { io } from "next/cache";
import {
  DAILY_BONUS_XP,
  EVOLUTION_NAMES,
  calculateCapacity,
  checkLoad,
  dailyXpTarget,
  evolutionStage,
  focusSessionXp,
  levelFromTotalXp,
  qualifyingDailyBonuses,
  taskXp,
  type DailyBonusCode,
  type Difficulty,
  type Importance,
} from "@/engine";
import { Card, Chip, ProgressBar, SectionLabel } from "@/components/ui";
import { formatMinutes } from "@/lib/format";
import {
  CATEGORY_LABEL,
  SAMPLE_CHECKIN,
  SAMPLE_FOCUS_SESSIONS_DONE,
  SAMPLE_MISSIONS,
  SAMPLE_PRIOR_XP,
  type Mission,
} from "@/lib/sample-data";

const IMPORTANCE_LABEL: Record<Importance, string> = {
  optional: "Optional",
  normal: "Normal",
  important: "Important",
  critical: "Critical",
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const BONUS_LABEL: Record<DailyBonusCode, string> = {
  all_critical: "All critical missions done",
  xp_target: "Daily XP target reached",
  two_focus_sessions: "2 focus sessions",
  reflection: "Evening reflection",
};

export function TodayView() {
  // The date is read at request time, never baked into the static shell.
  use(io());
  const today = new Date();

  const [done, setDone] = useState<Set<string>>(() => new Set(["m1"]));
  const toggle = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const capacity = useMemo(() => calculateCapacity(SAMPLE_CHECKIN), []);
  const xpTarget = dailyXpTarget(capacity.recommendedMinutes);
  const plannedMinutes = SAMPLE_MISSIONS.reduce((sum, m) => sum + m.estimatedMinutes, 0);
  const load = checkLoad(plannedMinutes, capacity.recommendedMinutes);

  const taskXpEarned = SAMPLE_MISSIONS.filter((m) => done.has(m.id)).reduce(
    (sum, m) => sum + taskXp(m, "completed"),
    0,
  );
  const focusXpEarned =
    SAMPLE_FOCUS_SESSIONS_DONE * focusSessionXp({ taskId: "m1", plannedMinutes: 25, focusedMinutes: 25 });
  const earnedXp = taskXpEarned + focusXpEarned;

  const critical = SAMPLE_MISSIONS.filter((m) => m.importance === "critical");
  const bonuses = qualifyingDailyBonuses({
    criticalPlanned: critical.length,
    criticalCompleted: critical.filter((m) => done.has(m.id)).length,
    earnedXp,
    xpTarget,
    completedFocusSessions: SAMPLE_FOCUS_SESSIONS_DONE,
    reflectionDone: false,
  });
  const bonusXp = bonuses.reduce((sum, code) => sum + DAILY_BONUS_XP[code], 0);
  const todayXp = earnedXp + bonusXp;

  const level = levelFromTotalXp(SAMPLE_PRIOR_XP + todayXp);
  const stage = evolutionStage(level.level);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:gap-5 sm:py-10">
      {/* Header: date, companion, level */}
      <Card as="header" className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-accent">DAYQUEST</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
              {today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {done.size} of {SAMPLE_MISSIONS.length} missions complete
            </p>
          </div>
          <CompanionPlaceholder stageName={EVOLUTION_NAMES[stage]} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">
              Level {level.level} · {EVOLUTION_NAMES[stage]}
            </span>
            <span className="tabular-nums text-ink-muted">
              {level.xpIntoLevel} / {level.xpForNextLevel} XP
            </span>
          </div>
          <ProgressBar value={level.progress} label="Progress to next level" />
        </div>
      </Card>

      {/* Capacity */}
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <SectionLabel>Today&apos;s capacity</SectionLabel>
            <p className="mt-1 text-2xl font-semibold text-xp tabular-nums">
              {formatMinutes(capacity.recommendedMinutes)}
            </p>
            <p className="text-sm text-ink-muted">
              ≈ {capacity.focusSessions} focus sessions · energy {SAMPLE_CHECKIN.energy}/5 · focus{" "}
              {SAMPLE_CHECKIN.focus}/5 · {formatMinutes(SAMPLE_CHECKIN.availableMinutes)} available
            </p>
          </div>
          <Chip tone={load.overloaded ? "warn" : "xp"}>{load.overloaded ? "Over capacity" : "Balanced day"}</Chip>
        </div>

        <WorkloadBar
          deep={capacity.deepWorkMinutes}
          light={capacity.lightWorkMinutes}
          buffer={capacity.bufferMinutes}
        />

        {load.overloaded && (
          <p className="rounded-card bg-warn-soft px-4 py-3 text-sm text-warn">
            You&apos;ve planned {formatMinutes(plannedMinutes)}, which is {formatMinutes(load.overByMinutes)} more than
            today&apos;s capacity. Consider moving an Optional mission to tomorrow. That&apos;s planning, not falling
            behind.
          </p>
        )}
      </Card>

      {/* Missions */}
      <Card className="flex flex-col gap-1">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Today&apos;s missions</h2>
          <span className="text-sm text-ink-muted">{formatMinutes(plannedMinutes)} planned</span>
        </div>
        <ul className="flex flex-col divide-y divide-line">
          {SAMPLE_MISSIONS.map((m) => (
            <MissionRow key={m.id} mission={m} done={done.has(m.id)} onToggle={() => toggle(m.id)} />
          ))}
        </ul>
      </Card>

      {/* Daily XP */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">XP today</h2>
          <span className="text-2xl font-semibold text-xp tabular-nums">{todayXp} XP</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm text-ink-muted">
            <span>Daily target</span>
            <span className="tabular-nums">
              {earnedXp} / {xpTarget} XP
            </span>
          </div>
          <ProgressBar value={earnedXp / xpTarget} label="Progress to daily XP target" />
        </div>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <XpStat label="Missions" value={taskXpEarned} />
          <XpStat label="Focus" value={focusXpEarned} />
          <XpStat label="Bonuses" value={bonusXp} />
        </dl>
        {bonuses.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {bonuses.map((code) => (
              <Chip key={code} tone="accent">
                +{DAILY_BONUS_XP[code]} · {BONUS_LABEL[code]}
              </Chip>
            ))}
          </div>
        )}
      </Card>

      <p className="px-1 text-center text-xs text-ink-muted">
        Phase 0 prototype: sample data, nothing is saved yet.
      </p>
    </div>
  );
}

function MissionRow({ mission, done, onToggle }: { mission: Mission; done: boolean; onToggle: () => void }) {
  const xp = taskXp(mission, "completed");
  const quick = mission.estimatedMinutes < 15;
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        onClick={onToggle}
        className="flex w-full items-start gap-3 rounded-card px-1 py-3 text-left transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-2"
      >
        <span
          aria-hidden
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-chip border-2 transition-colors ${
            done ? "border-xp bg-xp text-on-accent" : "border-line bg-surface"
          }`}
        >
          {done && (
            <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className={`font-medium ${done ? "text-ink-muted line-through" : ""}`}>{mission.title}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
            <span>
              {CATEGORY_LABEL[mission.category]} · {formatMinutes(mission.estimatedMinutes)}
            </span>
            <Chip tone={mission.importance === "critical" ? "warn" : "neutral"}>
              {IMPORTANCE_LABEL[mission.importance]}
            </Chip>
            <Chip>{DIFFICULTY_LABEL[mission.difficulty]}</Chip>
            {quick && <Chip>Quick task · ½ XP</Chip>}
          </span>
        </span>
        <Chip tone={done ? "xp" : "accent"}>+{xp} XP</Chip>
      </button>
    </li>
  );
}

function WorkloadBar({ deep, light, buffer }: { deep: number; light: number; buffer: number }) {
  const total = deep + light + buffer || 1;
  const parts = [
    { label: "Deep work", minutes: deep, className: "bg-accent" },
    { label: "Light work", minutes: light, className: "bg-xp" },
    { label: "Buffer", minutes: buffer, className: "bg-line" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-chip bg-surface-2" aria-hidden>
        {parts.map((p) => (
          <div key={p.label} className={p.className} style={{ width: `${(p.minutes / total) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span aria-hidden className={`size-2 rounded-chip ${p.className}`} />
            {p.label} <span className="tabular-nums text-ink">{formatMinutes(p.minutes)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function XpStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-card bg-surface-2 px-3 py-2">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** Stand-in until the Rive companion arrives in Phase 2. */
function CompanionPlaceholder({ stageName }: { stageName: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1" aria-label={`Companion: ${stageName}`} role="img">
      <svg viewBox="0 0 64 72" className="size-14 sm:size-16" aria-hidden>
        <ellipse cx="32" cy="40" rx="24" ry="29" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" />
        <path d="M10 42l7-5 6 6 6-6 6 6 6-6 6 6 7-5" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="25" cy="30" r="2.6" fill="var(--ink)" />
        <circle cx="39" cy="30" r="2.6" fill="var(--ink)" />
        <path d="M28 35.5q4 3 8 0" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="text-xs text-ink-muted">{stageName}</span>
    </div>
  );
}

export function TodaySkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:gap-5 sm:py-10" aria-busy>
      {[140, 150, 380, 160].map((h, i) => (
        <div key={i} className="animate-pulse rounded-card border border-line bg-surface" style={{ height: h }} />
      ))}
    </div>
  );
}
