import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui";
import { CompanionEgg } from "@/components/Companion";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Sign in · DAYQUEST" };

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <CompanionEgg />
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
