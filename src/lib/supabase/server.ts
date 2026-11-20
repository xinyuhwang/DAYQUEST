import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { SESSION_COOKIE_OPTIONS } from "@/lib/auth";
import { supabasePublicEnv } from "./env";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Acts as the signed-in user from the request cookies, so RLS applies.
 */
export async function createClient() {
  const { url, key } = supabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by the proxy (added with the sign-in flow).
        }
      },
    },
  });
}
