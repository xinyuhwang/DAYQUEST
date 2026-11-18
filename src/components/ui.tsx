/** Small theme-token-only UI primitives. No raw colors here or anywhere else. */
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  as: Tag = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "header";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={`rounded-card border border-line bg-surface p-5 shadow-card sm:p-6 ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

type Tone = "neutral" | "accent" | "xp" | "warn";

const TONE: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-muted",
  accent: "bg-accent-soft text-accent",
  xp: "bg-xp-soft text-xp",
  warn: "bg-warn-soft text-warn",
};

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-chip px-2.5 py-0.5 text-xs font-medium ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  label,
  tone = "xp",
}: {
  /** 0–1 */
  value: number;
  label: string;
  tone?: "xp" | "accent";
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="h-2 w-full overflow-hidden rounded-chip bg-surface-2"
    >
      <div
        className={`h-full rounded-chip transition-[width] duration-500 ease-out ${tone === "xp" ? "bg-xp" : "bg-accent"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{children}</p>;
}
