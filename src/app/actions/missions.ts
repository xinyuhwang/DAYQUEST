"use server";

import { refresh } from "next/cache";
import { getDayContext } from "@/lib/missions/server";
import { parseMissionForm, type FieldErrors, type MissionDay } from "@/lib/missions/validate";

export interface MissionFormState {
  /** Increments on each success so the client can reset or close the form. */
  savedCount: number;
  errors?: FieldErrors;
  message?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export async function createMission(prev: MissionFormState, form: FormData): Promise<MissionFormState> {
  const parsed = parseMissionForm(form);
  if (!parsed.ok) return { ...prev, errors: parsed.errors };

  const ctx = await getDayContext();
  const { title, category, importance, difficulty, estMinutes, day } = parsed.value;
  const plannedDate = day === "today" ? ctx.today : ctx.tomorrow;

  // New missions go to the end of the day's list.
  const { data: last } = await ctx.supabase
    .from("tasks")
    .select("sort_order")
    .eq("planned_date", plannedDate)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await ctx.supabase.from("tasks").insert({
    title,
    category,
    importance,
    difficulty,
    est_minutes: estMinutes,
    planned_date: plannedDate,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (error) return { ...prev, errors: undefined, message: "Couldn't save the mission. Please try again." };

  refresh();
  return { savedCount: prev.savedCount + 1 };
}

export async function updateMission(prev: MissionFormState, form: FormData): Promise<MissionFormState> {
  const id = form.get("id");
  if (!isUuid(id)) return { ...prev, message: "That mission no longer exists." };
  const parsed = parseMissionForm(form);
  if (!parsed.ok) return { ...prev, errors: parsed.errors };

  const ctx = await getDayContext();
  const { title, category, importance, difficulty, estMinutes } = parsed.value;
  const { error } = await ctx.supabase
    .from("tasks")
    .update({ title, category, importance, difficulty, est_minutes: estMinutes })
    .eq("id", id);
  if (error) return { ...prev, errors: undefined, message: "Couldn't save your changes. Please try again." };

  refresh();
  return { savedCount: prev.savedCount + 1 };
}

/** Check or un-check one of today's missions. XP awards hook in here next (§5.5). */
export async function setMissionDone(id: string, done: boolean): Promise<{ ok: boolean }> {
  if (!isUuid(id)) return { ok: false };
  const ctx = await getDayContext();
  const { data, error } = await ctx.supabase
    .from("tasks")
    .update(
      done
        ? { status: "done", completed_at: new Date().toISOString() }
        : { status: "planned", completed_at: null },
    )
    .eq("id", id)
    .eq("planned_date", ctx.today) // only today's missions can be completed
    .select("id");
  refresh();
  return { ok: !error && data.length === 1 };
}

export async function moveMission(id: string, to: MissionDay): Promise<{ ok: boolean }> {
  if (!isUuid(id) || (to !== "today" && to !== "tomorrow")) return { ok: false };
  const ctx = await getDayContext();
  const { error } = await ctx.supabase
    .from("tasks")
    .update({ planned_date: to === "today" ? ctx.today : ctx.tomorrow, status: "planned", completed_at: null })
    .eq("id", id)
    .neq("status", "done"); // finished missions stay where they were finished
  refresh();
  return { ok: !error };
}

export async function deleteMission(id: string): Promise<{ ok: boolean }> {
  if (!isUuid(id)) return { ok: false };
  const ctx = await getDayContext();
  const { error } = await ctx.supabase.from("tasks").delete().eq("id", id);
  refresh();
  return { ok: !error };
}
