"use client";

import { useEffect } from "react";

export type Ambient = "off" | "white" | "rain";

export const AMBIENT_LABEL: Record<Ambient, string> = { off: "Off", white: "White noise", rain: "Rain" };

let shared: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  shared ??= new AudioContext();
  if (shared.state === "suspended") void shared.resume();
  return shared;
}

/**
 * Generated ambient noise, so no audio files are needed. White noise is flat;
 * "rain" is brown noise through a low-pass filter. Café and other packs need
 * recorded audio and arrive later as unlockable variants (§8.1).
 */
export function useAmbient(kind: Ambient, playing: boolean) {
  useEffect(() => {
    if (kind === "off" || !playing) return;
    const ctx = audio();
    if (!ctx) return;

    const seconds = 4;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === "white") data[i] = white * 0.35;
      else {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(kind === "white" ? 0.12 : 0.5, ctx.currentTime + 1);
    let node: AudioNode = source;
    if (kind === "rain") {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 900;
      source.connect(filter);
      node = filter;
    }
    node.connect(gain).connect(ctx.destination);
    source.start();

    return () => {
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
      source.stop(ctx.currentTime + 0.35);
    };
  }, [kind, playing]);
}

/** A soft two-note chime for "time's up". */
export function chime() {
  const ctx = audio();
  if (!ctx) return;
  [660, 880].forEach((freq, i) => {
    const t = ctx.currentTime + i * 0.25;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.3);
  });
}

/** Shows a browser notification when the tab is in the background and the user allowed it. */
export function notify(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return;
  new Notification(title, { body, tag: "dayquest-focus" });
}
