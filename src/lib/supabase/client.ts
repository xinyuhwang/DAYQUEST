"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabasePublicEnv } from "./env";

/** Supabase client for Client Components. Acts as the signed-in user (RLS applies). */
export function createClient() {
  const { url, key } = supabasePublicEnv();
  return createBrowserClient<Database>(url, key);
}
