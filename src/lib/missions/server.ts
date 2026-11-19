import "server-only";
import { io } from "next/cache";
import { redirect } from "next/navigation";
import { addDays, dayKey, DEFAULT_ROLLOVER_HOUR, type Category, type Difficulty, type Importance, type Rating } from "@/engine";
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
  availableMinutes: number;
  recommendedMinutes: number;
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
  if (!userId) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, day_rollover_hour")
    .eq("id", userId)
    .single();

  const timezone = profile?.timezone ?? "UTC";
  const today = dayKey(new Date(), timezone, profile?.day_rollover_hour ?? DEFAULT_ROLLOVER_HOUR);
  return { supabase, userId, timezone, today, tomorrow: addDays(today, 1) };
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
    .select("energy, focus, available_min, recommended_min")
    .eq("day", day)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    energy: data.energy as Rating,
    focus: data.focus as Rating,
    availableMinutes: data.available_min,
    recommendedMinutes: data.recommended_min,
  };
}
