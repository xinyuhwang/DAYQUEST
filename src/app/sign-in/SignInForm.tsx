"use client";

import { useActionState, useEffect, useRef, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { requestCode, verifyCode, type SignInState } from "./actions";

const INITIAL: SignInState = { step: "email" };

export function SignInForm() {
  const next = useSearchParams().get("next") ?? "/";
  const [emailState, sendCode, sending] = useActionState(requestCode, INITIAL);
  const [codeState, submitCode, verifying] = useActionState(verifyCode, INITIAL);

  // Show the code step once a code has been sent; verification errors stay there.
  const onCodeStep = emailState.step === "code";
  const email = emailState.email ?? "";
  const codeError = codeState.step === "code" && codeState.email === email ? codeState.error : undefined;

  const codeInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (onCodeStep) codeInput.current?.focus();
  }, [onCodeStep, emailState]);

  if (!onCodeStep) {
    return (
      <form action={sendCode} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            defaultValue={email}
            aria-invalid={Boolean(emailState.error)}
            aria-describedby={emailState.error ? "email-error" : undefined}
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>
        {emailState.error && <ErrorText id="email-error">{emailState.error}</ErrorText>}
        <SubmitButton pending={sending}>{sending ? "Sending code…" : "Email me a code"}</SubmitButton>
        <p className="text-center text-xs text-ink-muted">New here? Signing in creates your account.</p>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        We sent a 6-digit code to <span className="font-medium text-ink">{email}</span>.
        {emailState.step === "code" && emailState.resent && " A new code is on its way."}
      </p>
      <form action={submitCode} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next} />
        <TimeZoneField />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="code" className="text-sm font-medium">
            Sign-in code
          </label>
          <input
            ref={codeInput}
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={7}
            required
            aria-invalid={Boolean(codeError)}
            aria-describedby={codeError ? "code-error" : undefined}
            className={`${inputClass} text-center font-mono text-2xl tracking-[0.4em]`}
            placeholder="••••••"
          />
        </div>
        {codeError && <ErrorText id="code-error">{codeError}</ErrorText>}
        <SubmitButton pending={verifying}>{verifying ? "Checking…" : "Continue"}</SubmitButton>
      </form>
      <div className="flex items-center justify-between text-sm">
        {/* A full page load resets both steps of the form. */}
        <a
          href={`/sign-in${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="text-ink-muted underline-offset-4 hover:underline"
        >
          Use a different email
        </a>
        <form action={sendCode}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="resend" value="1" />
          <button
            type="submit"
            disabled={sending}
            className="font-medium text-accent underline-offset-4 hover:underline disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send a new code"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-card border border-line bg-surface px-3.5 py-2.5 text-base text-ink placeholder:text-ink-muted/70 focus:border-accent focus:outline-2 focus:outline-offset-1 focus:outline-accent aria-[invalid=true]:border-warn";

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-card bg-accent px-4 py-2.5 font-medium text-on-accent transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function ErrorText({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="rounded-card bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
      {children}
    </p>
  );
}

/** Sends the browser's time zone so day boundaries are right from day one. */
function TimeZoneField() {
  // Empty on the server, the browser's zone on the client, with no hydration mismatch.
  const timeZone = useSyncExternalStore(
    noopSubscribe,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "",
  );
  return <input type="hidden" name="timezone" value={timeZone} />;
}

const noopSubscribe = () => () => {};
