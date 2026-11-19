import "server-only";
import { io } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { addDays, dayKey, DEFAULT_ROLLOVER_HOUR, type Category, type Difficulty, type Importance, type Mood, type Rating } from "@/engine";
import { SIGNED_OUT_PARAM, SIGN_IN_PATH } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type TaskStatus = Database["public"]["Enums"]["task_status"];

export interface Mission {
  id: string;
  title: string;
  category: Category;
  importance: Importance;
  difficulty: Difficulty;
  estimatedMinutes: number;
  status: TaskStatus;
}

export interface LatestCheckin {
  energy: Rating;
  focus: Rating;
  mood: Mood | null;
  availableMinutes: number;
  capacityMinutes: number;
  recommendedMinutes: number;
  /** "14:05" in the user's zone. */
  time: string;
}

/**
 * The signed-in user's Supabase client plus their DAYQUEST "today" and
 * "tomorrow", computed from their time zone and rollover hour (DESIGN.md §3).
 */
export async function getDayContext() {
  // Session checks and "what day is it" read the clock, so keep everything
  // below out of prerendered shells (Cache Components). No-op at request time.
  await io();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect(SIGN_IN_PATH);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("timezone, day_rollover_hour")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load your profile: ${error.message}`);
  // Every account gets a profile at signup, so none means the account is gone
  // and this browser's session is stale. Clear it and sign in again.
  if (!profile) {
    await forgetSession();
    redirect(`${SIGN_IN_PATH}?${SIGNED_OUT_PARAM}=1`);
  }

  const timezone = profile.timezone;
  const rolloverHour = profile.day_rollover_hour ?? DEFAULT_ROLLOVER_HOUR;
  const today = dayKey(new Date(), timezone, rolloverHour);
  return { supabase, userId, timezone, rolloverHour, today, tomorrow: addDays(today, 1) };
}

/**
 * Drops the auth cookies. Works in server actions, where a redirect is
 * rendered in the same response and skips the proxy. Server Components can't
 * set cookies, but their redirect is a fresh request that the proxy clears.
 */
async function forgetSession() {
  const store = await cookies();
  try {
    for (const { name } of store.getAll()) if (name.startsWith("sb-")) store.delete(name);
  } catch {
    // Rendering a Server Component: the proxy handles it.
  }
}

export type DayContext = Awaited<ReturnType<typeof getDayContext>>;

export async function listMissions(ctx: DayContext, day: string): Promise<Mission[]> {
  const { data, error } = await ctx.supabase
    .from("tasks")
    .select("id, title, category, importance, difficulty, est_minutes, status")
    .eq("planned_date", day)
    .is("parent_id", null)
    .neq("status", "carried_over")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Couldn't load missions: ${error.message}`);
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    importance: row.importance,
    difficulty: row.difficulty,
    estimatedMinutes: row.est_minutes,
    status: row.status,
  }));
}

export async function getTotalXp(ctx: DayContext): Promise<number> {
  const { data } = await ctx.supabase.from("user_xp").select("total_xp").maybeSingle();
  return data?.total_xp ?? 0;
}

export async function getLatestCheckin(ctx: DayContext, day: string): Promise<LatestCheckin | null> {
  const { data } = await ctx.supabase
    .from("daily_checkins")
    .select("energy, focus, mood, available_min, capacity_min, recommended_min, created_at")
    .eq("day", day)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    energy: data.energy as Rating,
    focus: data.focus as Rating,
    mood: data.mood,
    availableMinutes: data.available_min,
    capacityMinutes: data.capacity_min,
    recommendedMinutes: data.recommended_min,
    time: new Date(data.created_at).toLocaleTimeString("en-US", {
      timeZone: ctx.timezone,
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}
