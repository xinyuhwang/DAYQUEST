import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in · DAYQUEST" };

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <svg viewBox="0 0 64 72" className="size-14" aria-hidden>
            <ellipse cx="32" cy="40" rx="24" ry="29" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" />
            <path d="M10 42l7-5 6 6 6-6 6 6 6-6 6 6 7-5" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="25" cy="30" r="2.6" fill="var(--ink)" />
            <circle cx="39" cy="30" r="2.6" fill="var(--ink)" />
            <path d="M28 35.5q4 3 8 0" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <p className="text-sm font-semibold tracking-wide text-accent">DAYQUEST</p>
          <h1 className="text-xl font-semibold">Sign in to start today&apos;s quest</h1>
        </div>
        {/* useSearchParams reads the request URL, so it renders at request time. */}
        <Suspense fallback={<div className="h-40" aria-busy />}>
          <SignInForm />
        </Suspense>
      </Card>
    </main>
  );
}
