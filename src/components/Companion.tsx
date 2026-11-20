/** Stand-in for the companion until the Rive character arrives in Phase 2. */
export function CompanionEgg({ className = "size-14" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 72" className={className} aria-hidden>
      <ellipse cx="32" cy="40" rx="24" ry="29" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2" />
      <path d="M10 42l7-5 6 6 6-6 6 6 6-6 6 6 7-5" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="25" cy="30" r="2.6" fill="var(--ink)" />
      <circle cx="39" cy="30" r="2.6" fill="var(--ink)" />
      <path d="M28 35.5q4 3 8 0" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
