"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { EVOLUTION_NAMES, checkLoad, evolutionStage, levelFromTotalXp } from "@/engine";
import { createMission, setMissionDone } from "@/app/actions/missions";
import { signOut } from "@/app/sign-in/actions";
import { CompanionEgg } from "@/components/Companion";
import { Card, Chip, ProgressBar, SectionLabel } from "@/components/ui";
import { formatMinutes } from "@/lib/format";
import type { LatestCheckin, Mission } from "@/lib/missions/server";
import type { MissionDay } from "@/lib/missions/validate";
import { MissionForm } from "./MissionForm";
import { MissionItem } from "./MissionItem";

export function DayView({
  day,
  dayLabel,
  missions,
  totalXp,
  checkin,
}: {
  day: MissionDay;
  dayLabel: string;
  missions: Mission[];
  totalXp: number;
  checkin: LatestCheckin | null;
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

      {day === "today" && <CapacityCard checkin={checkin} plannedMinutes={plannedMinutes} />}

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

function CapacityCard({ checkin, plannedMinutes }: { checkin: LatestCheckin | null; plannedMinutes: number }) {
  if (!checkin) {
    return (
      <Card className="flex flex-col gap-1">
        <SectionLabel>Today&apos;s capacity</SectionLabel>
        <p className="text-sm text-ink-muted">
          You haven&apos;t checked in yet. The morning check-in (coming next) will tell you how much of your{" "}
          {plannedMinutes > 0 ? `${formatMinutes(plannedMinutes)} plan` : "day"} is realistic.
        </p>
      </Card>
    );
  }
  const load = checkLoad(plannedMinutes, checkin.recommendedMinutes);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <SectionLabel>Today&apos;s capacity</SectionLabel>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-xp">{formatMinutes(checkin.recommendedMinutes)}</p>
          <p className="text-sm text-ink-muted">
            energy {checkin.energy}/5 · focus {checkin.focus}/5 · {formatMinutes(checkin.availableMinutes)} available
          </p>
        </div>
        <Chip tone={load.overloaded ? "warn" : "xp"}>{load.overloaded ? "Over capacity" : "Balanced day"}</Chip>
      </div>
      {load.overloaded && (
        <p className="rounded-card bg-warn-soft px-4 py-3 text-sm text-warn">
          You&apos;ve planned {formatMinutes(plannedMinutes)}, {formatMinutes(load.overByMinutes)} more than today&apos;s capacity.
          Consider moving an Optional mission to tomorrow. That&apos;s planning, not falling behind.
        </p>
      )}
    </Card>
  );
}
