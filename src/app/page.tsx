import { Suspense } from "react";
import { DayView } from "@/components/today/DayView";
import { DaySkeleton } from "@/components/today/DaySkeleton";
import { formatDayLabel } from "@/lib/format";
import { getDayContext, getLatestCheckin, getTotalXp, listMissions } from "@/lib/missions/server";
import { getOpenSession } from "@/lib/focus/server";
import { getDayXp } from "@/lib/xp/sync";

export default function TodayPage({ searchParams }: PageProps<"/">) {
  return (
    <main className="flex flex-1 flex-col">
      {/* Everything below depends on the signed-in user, so it renders per request. */}
      <Suspense fallback={<DaySkeleton />}>
        <Day searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Day({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const params = await searchParams;
  const view = params.day === "tomorrow" ? "tomorrow" : "today";

  const ctx = await getDayContext();
  const dayKey = view === "today" ? ctx.today : ctx.tomorrow;
  const [missions, totalXp, checkin, todayXp, focusSession] = await Promise.all([
    listMissions(ctx, dayKey),
    getTotalXp(ctx),
    view === "today" ? getLatestCheckin(ctx, ctx.today) : Promise.resolve(null),
    view === "today" ? getDayXp(ctx, ctx.today) : Promise.resolve(null),
    getOpenSession(ctx),
  ]);

  return (
    <DayView
      key={view}
      day={view}
      dayLabel={formatDayLabel(dayKey)}
      missions={missions}
      totalXp={totalXp}
      checkin={checkin}
      todayXp={todayXp}
      focusSession={focusSession && { taskTitle: focusSession.taskTitle }}
    />
  );
}
