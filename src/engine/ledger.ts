/**
 * Append-only XP ledger planning (docs/DESIGN.md §5.5).
 *
 * An award stream is identified by a base reason, e.g. "task_completed" for a
 * task, or "bonus:all_critical" for a day. Entries look like:
 *   "<base>#1"            the first award
 *   "<base>#1:reversal"   taking award #1 back
 *   "<base>#2"            awarded again later
 * Nothing is ever edited or deleted; the current state is the replay.
 */

export interface LedgerEntry {
  reason: string;
  amount: number;
  /** The DAYQUEST day ("YYYY-MM-DD") the entry counts toward. */
  day: string;
}

export interface LedgerChange {
  reason: string;
  amount: number;
  day: string;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Awards in this stream that have not been reversed. */
export function activeAwards(entries: LedgerEntry[], base: string): (LedgerEntry & { n: number })[] {
  const award = new RegExp(`^${escapeRegExp(base)}#(\\d+)$`);
  const reversal = new RegExp(`^${escapeRegExp(base)}#(\\d+):reversal$`);
  const reversed = new Set<number>();
  for (const e of entries) {
    const m = reversal.exec(e.reason);
    if (m) reversed.add(Number(m[1]));
  }
  const active: (LedgerEntry & { n: number })[] = [];
  for (const e of entries) {
    const m = award.exec(e.reason);
    if (m && !reversed.has(Number(m[1]))) active.push({ ...e, n: Number(m[1]) });
  }
  return active;
}

/**
 * What to append so the stream matches the desired state.
 *
 * @param shouldHold whether the user should currently hold this award
 * @param amount     XP to grant if a new award is needed (ignored for reversals,
 *                   which always cancel exactly what was granted)
 * @param day        the day a new award counts toward
 */
export function planLedgerChange(
  entries: LedgerEntry[],
  base: string,
  shouldHold: boolean,
  amount: number,
  day: string,
): LedgerChange[] {
  const active = activeAwards(entries, base);

  if (shouldHold) {
    if (active.length > 0 || amount <= 0) return [];
    const award = new RegExp(`^${escapeRegExp(base)}#(\\d+)$`);
    const maxN = entries.reduce((max, e) => {
      const m = award.exec(e.reason);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    return [{ reason: `${base}#${maxN + 1}`, amount, day }];
  }

  // Reverse every active award, on the same day it counted toward,
  // so daily totals net out correctly.
  return active.map((a) => ({ reason: `${base}#${a.n}:reversal`, amount: -a.amount, day: a.day }));
}

/** Net XP of a set of entries. */
export function sumLedger(entries: Pick<LedgerEntry, "amount">[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0);
}
