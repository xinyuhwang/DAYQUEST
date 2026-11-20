import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { CompanionEgg } from "@/components/Companion";

export const metadata: Metadata = { title: "Page not found · DAYQUEST" };

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <CompanionEgg />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">This page wandered off</h1>
          <p className="text-sm text-ink-muted">There&apos;s nothing here. Your missions are safe on the Today page.</p>
        </div>
        <Link
          href="/"
          className="rounded-card bg-accent px-4 py-2 font-medium text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Back to today
        </Link>
      </Card>
    </main>
  );
}
