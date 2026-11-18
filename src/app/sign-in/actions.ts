"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone, normalizeCode, normalizeEmail, safeNextPath } from "@/lib/auth";

export type SignInState =
  | { step: "email"; error?: string; email?: string }
  | { step: "code"; email: string; error?: string; resent?: boolean };

function friendlyAuthError(code: string | undefined, fallback: string): string {
  switch (code) {
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many codes requested. Please wait a minute and try again.";
    case "otp_expired":
      return "That code is wrong or has expired. Check the latest email, or send a new code.";
    case "email_address_invalid":
      return "That email address doesn't look right.";
    default:
      return fallback;
  }
}

/** Step 1: email a 6-digit code. Creates the account on first sign-in. */
export async function requestCode(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = normalizeEmail(formData.get("email"));
  if (!email) return { step: "email", error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    return { step: "email", email, error: friendlyAuthError(error.code, "Couldn't send a code. Please try again.") };
  }
  return { step: "code", email, resent: formData.get("resend") === "1" };
}

/** Step 2: verify the code, save the user's time zone the first time, then continue. */
export async function verifyCode(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = normalizeEmail(formData.get("email"));
  if (!email) return { step: "email", error: "Enter your email again." };

  const token = normalizeCode(formData.get("code"));
  if (!token) return { step: "code", email, error: "Enter the 6-digit code from the email." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) {
    return { step: "code", email, error: friendlyAuthError(error?.code, "Couldn't verify that code. Please try again.") };
  }

  // Day boundaries depend on the user's time zone (DESIGN.md §3). Set it from
  // the browser on first sign-in; later changes happen in Settings.
  const tz = formData.get("timezone");
  if (isValidTimeZone(tz)) {
    const { error: tzError } = await supabase
      .from("profiles")
      .update({ timezone: tz })
      .eq("id", data.user.id)
      .eq("timezone", "UTC");
    // Not fatal: the user can still set it in Settings.
    if (tzError) console.error("Failed to save time zone", tzError.message);
  }

  redirect(safeNextPath(formData.get("next")));
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
