import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { DaySettingsForm } from "@/components/settings/DaySettingsForm";
import { Card } from "@/components/ui";
import { getDayContext } from "@/lib/missions/server";
import { daySettingsLockedUntil } from "@/lib/settings/server";

export const metadata: Metadata = { title: "Settings · DAYQUEST" };

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:gap-5 sm:py-10">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold sm:text-3xl">Settings</h1>
        <Link href="/" className="rounded-card px-3 py-2 text-sm font-medium text-accent hover:bg-accent-soft">
          ← Back to today
        </Link>
      </div>
      <Suspense fallback={<Card className="h-64 animate-pulse" aria-busy>{null}</Card>}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  const ctx = await getDayContext();
  return (
    <DaySettingsForm
      timezone={ctx.timezone}
      rolloverHour={ctx.rolloverHour}
      timeZones={Intl.supportedValuesOf("timeZone")}
      lockedUntil={await daySettingsLockedUntil(ctx)}
    />
  );
}
