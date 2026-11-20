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

export function useClock(serverNow: number): number {
  return useSyncExternalStore(
    subscribe,
    () => now || Date.now(),
    () => serverNow,
  );
}
