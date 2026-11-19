import { describe, expect, it } from "vitest";
import { activeAwards, planLedgerChange, sumLedger, type LedgerEntry } from "./ledger";

const D = "2026-11-18";
const BASE = "task_completed";

/** Applies planned changes, like inserting them into the ledger. */
function apply(entries: LedgerEntry[], shouldHold: boolean, amount = 52, day = D): LedgerEntry[] {
  return [...entries, ...planLedgerChange(entries, BASE, shouldHold, amount, day)];
}

describe("planLedgerChange", () => {
  it("awards #1 on first completion", () => {
    expect(planLedgerChange([], BASE, true, 52, D)).toEqual([{ reason: "task_completed#1", amount: 52, day: D }]);
  });

  it("is idempotent: completing twice awards once", () => {
    const once = apply([], true);
    expect(planLedgerChange(once, BASE, true, 52, D)).toEqual([]);
  });

  it("reverses exactly what was granted, on the original day", () => {
    const awarded = [{ reason: "task_completed#1", amount: 52, day: "2026-11-17" }];
    // Even if the mission was edited since (now worth 70), the reversal cancels 52.
    expect(planLedgerChange(awarded, BASE, false, 70, D)).toEqual([
      { reason: "task_completed#1:reversal", amount: -52, day: "2026-11-17" },
    ]);
  });

  it("does nothing when un-checking something never awarded", () => {
    expect(planLedgerChange([], BASE, false, 52, D)).toEqual([]);
  });

  it("numbers re-awards after a reversal, so the unique key never collides", () => {
    let ledger = apply([], true); // #1
    ledger = apply(ledger, false); // #1:reversal
    ledger = apply(ledger, true, 35); // #2 at the new value
    expect(ledger.map((e) => e.reason)).toEqual(["task_completed#1", "task_completed#1:reversal", "task_completed#2"]);
    expect(sumLedger(ledger)).toBe(35);
    expect(activeAwards(ledger, BASE).map((a) => a.n)).toEqual([2]);
  });

  it("nets to zero after any number of check/un-check cycles ending un-checked", () => {
    let ledger: LedgerEntry[] = [];
    for (let i = 0; i < 5; i++) {
      ledger = apply(ledger, true);
      ledger = apply(ledger, true); // double click
      ledger = apply(ledger, false);
      ledger = apply(ledger, false); // double click
    }
    expect(sumLedger(ledger)).toBe(0);
    expect(new Set(ledger.map((e) => e.reason)).size).toBe(ledger.length);
  });

  it("never writes a zero-XP award", () => {
    expect(planLedgerChange([], BASE, true, 0, D)).toEqual([]);
  });

  it("keeps different streams independent", () => {
    const ledger = [{ reason: "bonus:all_critical#1", amount: 30, day: D }];
    expect(activeAwards(ledger, "bonus:xp_target")).toEqual([]);
    expect(planLedgerChange(ledger, "bonus:all_critical", true, 30, D)).toEqual([]);
  });

  it("treats regex characters in the base literally", () => {
    const ledger = [{ reason: "bonusXall_critical#1", amount: 30, day: D }];
    expect(activeAwards(ledger, "bonus.all_critical")).toEqual([]);
  });
});
