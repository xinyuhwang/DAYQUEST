"use client";

import Link from "next/link";
import { useCallback, useEffect, useOptimistic, useState, useTransition } from "react";
import { DAILY_BONUS_XP, EVOLUTION_NAMES, evolutionStage, levelFromTotalXp, type DailyBonusCode } from "@/engine";
import { createMission, setMissionDone } from "@/app/actions/missions";
import { signOut } from "@/app/sign-in/actions";
import { CompanionEgg } from "@/components/Companion";
import { Card, Chip, ProgressBar } from "@/components/ui";
import { formatMinutes } from "@/lib/format";
import type { LatestCheckin, Mission } from "@/lib/missions/server";
import type { WrapUpState } from "@/lib/reflection/server";
import type { DayXp } from "@/lib/xp/sync";
import type { MissionDay } from "@/lib/missions/validate";
import { CapacityCard } from "./Checkin";
import { MissionForm } from "./MissionForm";
import { MissionItem } from "./MissionItem";
import { WrapUpCard } from "./WrapUp";

export function DayView({
  day,
  dayLabel,
  missions,
  totalXp,
  checkin,
  todayXp,
  focusSession,
  wrapUp,
}: {
  day: MissionDay;
  dayLabel: string;
  missions: Mission[];
  totalXp: number;
  checkin: LatestCheckin | null;
  todayXp: DayXp | null;
  /** The running focus session, if any. */
  focusSession: { taskTitle: string } | null;
  /** Evening reflection state; today's view only. */
  wrapUp: WrapUpState | null;
}) {
  // Checkbox taps update instantly; the server result replaces this on refresh.
  const [optimistic, setOptimisticDone] = useOptimistic(missions, (state, change: { id: string; done: boolean }) =>
    state.map((m) => (m.id === change.id ? { ...m, status: change.done ? "done" : "planned" } : m)),
  );
  const [, startTransition] = useTransition();
  const toggle = (id: string, done: boolean) =>
    startTransition(async () => {
      setOptimisticDone({ id, done });
      await setMissionDone(id, done);
    });

  const [adding, setAdding] = useState(missions.length === 0);
  const doneCount = optimistic.filter((m) => m.status === "done").length;
  const plannedMinutes = optimistic.reduce((sum, m) => sum + m.estimatedMinutes, 0);
  const level = levelFromTotalXp(totalXp);
  const stage = evolutionStage(level.level);

  // Celebrate level-ups: compare with the level from the previous render.
  const [prevLevel, setPrevLevel] = useState(level.level);
  const [celebration, setCelebration] = useState<{ level: number; evolved: boolean } | null>(null);
  const dismissCelebration = useCallback(() => setCelebration(null), []);
  if (level.level !== prevLevel) {
    setPrevLevel(level.level);
    if (level.level > prevLevel) {
      setCelebration({ level: level.level, evolved: evolutionStage(prevLevel) !== stage });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:gap-5 sm:py-10">
      <Card as="header" className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold tracking-wide text-accent">DAYQUEST</p>
              <form action={signOut}>
                <button type="submit" className="text-xs text-ink-muted underline-offset-4 hover:underline">
                  Sign out
                </button>
              </form>
            </div>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">{dayLabel}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {day === "today"
                ? optimistic.length === 0
                  ? "No missions yet"
                  : `${doneCount} of ${optimistic.length} missions complete`
                : `${optimistic.length} ${optimistic.length === 1 ? "mission" : "missions"} planned for tomorrow`}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1">
            <CompanionEgg className="size-14 sm:size-16" />
            <span className="text-xs text-ink-muted">{EVOLUTION_NAMES[stage]}</span>
          </div>
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

      <nav aria-label="Day" className="flex gap-1 self-start rounded-card border border-line bg-surface p-1 shadow-card">
        <DayTab href="/" active={day === "today"}>
          Today
        </DayTab>
        <DayTab href="/?day=tomorrow" active={day === "tomorrow"}>
          Tomorrow
        </DayTab>
      </nav>

      {celebration && (
        <LevelUpToast
          level={celebration.level}
          evolvedTo={celebration.evolved ? EVOLUTION_NAMES[stage] : null}
          onDone={dismissCelebration}
        />
      )}

      {focusSession && (
        <Link
          href="/focus"
          className="flex items-center justify-between gap-3 rounded-card border border-accent bg-accent-soft px-5 py-3 text-sm shadow-card hover:opacity-90"
        >
          <span className="min-w-0">
            <span className="font-medium text-accent">Focus session running</span>
            <span className="block truncate text-ink-muted">{focusSession.taskTitle}</span>
          </span>
          <span className="shrink-0 font-medium text-accent">Return to focus →</span>
        </Link>
      )}

      {wrapUp?.yesterday && <WrapUpCard key="yesterday" wrapUp={wrapUp.yesterday} />}
      {wrapUp?.tonight && !wrapUp.tonight.reflection && <WrapUpCard key="tonight" wrapUp={wrapUp.tonight} />}

      {day === "today" && (
        <CapacityCard
          checkin={checkin}
          plannedMinutes={plannedMinutes}
          optionalOpen={optimistic.filter((m) => m.importance === "optional" && m.status !== "done").length}
        />
      )}

      <Card className="flex flex-col gap-1">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">{day === "today" ? "Today's missions" : "Tomorrow's missions"}</h2>
          {optimistic.length > 0 && <span className="text-sm text-ink-muted">{formatMinutes(plannedMinutes)} planned</span>}
        </div>

        {optimistic.length === 0 && !adding && (
          <p className="py-4 text-sm text-ink-muted">
            {day === "today" ? "A fresh day. What's the one thing that would make it count?" : "Plan tomorrow tonight and wake up knowing where to start."}
          </p>
        )}

        {optimistic.length > 0 && (
          <ul className="flex flex-col divide-y divide-line">
            {optimistic.map((m) => (
              <MissionItem
                key={m.id}
                mission={m}
                day={day}
                onToggle={day === "today" ? (done) => toggle(m.id, done) : undefined}
                canFocus={day === "today" && !focusSession}
              />
            ))}
          </ul>
        )}

        {adding ? (
          <div className="mt-3 rounded-card border border-line bg-canvas p-4">
            <MissionForm
              key={day}
              action={createMission}
              day={day}
              submitLabel="Add mission"
              onCancel={optimistic.length > 0 ? () => setAdding(false) : undefined}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-2 self-start rounded-card px-3 py-2 text-sm font-medium text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"
          >
            + Add a mission
          </button>
        )}
      </Card>

      {day === "today" && todayXp && <XpTodayCard xp={todayXp} />}
      {wrapUp?.tonight?.reflection && <WrapUpCard key="done" wrapUp={wrapUp.tonight} />}
      {day === "today" && wrapUp && !wrapUp.tonight && (
        <p className="px-1 text-center text-xs text-ink-muted">The evening reflection opens at 8 PM.</p>
      )}
    </div>
  );
}

function DayTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-[10px] px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
        active ? "bg-accent-soft text-accent" : "text-ink-muted hover:bg-canvas hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

const BONUS_LABEL: Record<DailyBonusCode, string> = {
  all_critical: "All critical missions done",
  xp_target: "Daily XP target reached",
  two_focus_sessions: "2 focus sessions",
  reflection: "Evening reflection",
};

function XpTodayCard({ xp }: { xp: DayXp }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">XP today</h2>
        <span className="text-2xl font-semibold tabular-nums text-xp">{xp.total} XP</span>
      </div>
      {xp.target > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-sm text-ink-muted">
            <span>Daily target</span>
            <span className="tabular-nums">
              {xp.earnedTowardTarget} / {xp.target} XP
            </span>
          </div>
          <ProgressBar value={xp.earnedTowardTarget / xp.target} label="Progress to daily XP target" />
        </div>
      ) : (
        <p className="text-sm text-ink-muted">Your daily XP target appears after the morning check-in.</p>
      )}
      <dl className="grid grid-cols-3 gap-2 text-sm">
        <XpStat label="Missions" value={xp.missions} />
        <XpStat label="Focus" value={xp.focus} />
        <XpStat label="Bonuses" value={xp.bonuses} />
      </dl>
      {xp.activeBonuses.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Bonuses earned today">
          {xp.activeBonuses.map((code) => (
            <li key={code}>
              <Chip tone="accent">
                +{DAILY_BONUS_XP[code]} · {BONUS_LABEL[code]}
              </Chip>
            </li>
          ))}
        </ul>
      )}
    </Card>
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

function LevelUpToast({ level, evolvedTo, onDone }: { level: number; evolvedTo: string | null; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 6000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-6 z-10 mx-auto flex max-w-sm items-center gap-3 rounded-card border border-accent bg-surface p-4 shadow-card sm:inset-x-auto sm:right-6 sm:mx-0"
    >
      <CompanionEgg className="size-10 shrink-0 motion-safe:animate-bounce" />
      <div className="flex-1">
        <p className="font-semibold">Level {level}!</p>
        <p className="text-sm text-ink-muted">
          {evolvedTo ? `Your companion evolved into a ${evolvedTo}.` : "Your companion is growing with you."}
        </p>
      </div>
      <button type="button" onClick={onDone} className="rounded-card px-2 py-1 text-sm text-ink-muted hover:bg-surface-2" aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
