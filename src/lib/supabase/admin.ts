import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabasePublicEnv } from "./env";

/**
 * Privileged client that bypasses RLS. Use it ONLY in server code that writes
 * the game economy (xp_transactions, user_unlocks, user_achievements) or the
 * state it depends on (check-ins, reflections, mission status, day settings),
 * always scoped to the verified user's id.
 * Never import this from a Client Component; `server-only` enforces that.
 */
export function createAdminClient() {
  const { url } = supabasePublicEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SECRET_KEY (server-only). See README.");
  return createSupabaseClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
