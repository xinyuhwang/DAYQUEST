export function DaySkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:gap-5 sm:py-10" aria-busy aria-label="Loading your day">
      {[150, 44, 90, 320].map((h, i) => (
        <div
          key={i}
          className={`animate-pulse rounded-card border border-line bg-surface ${i === 1 ? "w-48" : ""}`}
          style={{ height: h }}
        />
      ))}
    </div>
  );
}
