import { Suspense } from "react";
import { TodayView, TodaySkeleton } from "@/components/today/TodayView";

export default function TodayPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense fallback={<TodaySkeleton />}>
        <TodayView />
      </Suspense>
    </main>
  );
}
