"use client";

import { useSyncExternalStore } from "react";

/**
 * A shared ticking clock (4×/s). During hydration it reports `serverNow`, so
 * the server-rendered countdown matches the first client render exactly.
 */
let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const l of listeners) l();
    }, 250);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/**
 * How far the device clock is *behind* the server, measured once per page
 * load against the time the server rendered it. A behind clock would show
 * extra time and finish late, so it's corrected here. A clock that's ahead is
 * left alone: the server catches that when the session ends (notYetMs).
 * Latency only makes the device look ahead, so it's never over-corrected.
 */
const behindBy = new Map<number, number>();
const MIN_DRIFT_MS = 2000;
function driftFor(serverNow: number): number {
  let d = behindBy.get(serverNow);
  if (d === undefined) {
    const gap = serverNow - Date.now();
    d = gap > MIN_DRIFT_MS ? gap : 0;
    behindBy.set(serverNow, d);
  }
  return d;
}

/** The current time in ms, lined up with the server for a slow device clock. */
export function useClock(serverNow: number): number {
  return useSyncExternalStore(
    subscribe,
    () => (now || Date.now()) + driftFor(serverNow),
    () => serverNow,
  );
}
