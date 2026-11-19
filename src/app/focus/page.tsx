import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FocusMode } from "@/components/focus/FocusMode";
import { Card } from "@/components/ui";
import { completedSessionsToday, getOpenSession } from "@/lib/focus/server";
import { getDayContext } from "@/lib/missions/server";

export const metadata: Metadata = { title: "Focus · DAYQUEST" };

export default function FocusPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<div className="mx-auto mt-24 size-56 animate-pulse rounded-full bg-surface-2" aria-busy />}>
        <Focus />
      </Suspense>
    </main>
  );
}

async function Focus() {
  const ctx = await getDayContext();
  const [session, completedToday] = await Promise.all([getOpenSession(ctx), completedSessionsToday(ctx)]);

  if (!session) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8">
        <Card className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-lg font-semibold">No focus session running</h1>
          <p className="text-sm text-ink-muted">Pick one of today&apos;s missions and press Focus to start one.</p>
          <Link href="/" className="rounded-card bg-accent px-4 py-2 font-medium text-on-accent hover:opacity-90">
            Back to Today
          </Link>
        </Card>
      </div>
    );
  }

  const { taskTitle, serverNow, ...clock } = session;
  return (
    <FocusMode
      key={session.id}
      session={clock}
      taskTitle={taskTitle}
      serverNow={serverNow}
      completedToday={completedToday}
    />
  );
}
