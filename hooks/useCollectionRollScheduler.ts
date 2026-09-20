"use client";

import { useEffect, useState } from "react";
import { explorerConfig } from "@/config/site";

export interface RollSchedulerOptions {
  /** The first automatic roll always goes to this collection (the centre). */
  firstId: string | null;
  /** Collections allowed to roll next, in display order. */
  candidates: readonly string[];
  /** Section is on screen, established, and motion is allowed. */
  enabled: boolean;
  roll: (collectionId: string) => boolean;
  isBusy: () => boolean;
  onAutoRoll?: (collectionId: string) => void;
}

const { scheduler: cfg, roll: rollCfg } = explorerConfig;

// Randomness only ever runs in timers on the client, never during render,
// so server and client markup always match.
const between = (min: number, max: number) => min + (max - min) * ((Math.random() + Math.random()) / 2);
const nextDelay = () => rollCfg.duration * 1000 + between(cfg.minDelayMs, cfg.maxDelayMs);
const resumeDelay = () => between(cfg.minDelayMs * 0.5, cfg.minDelayMs);

function pickNext(candidates: readonly string[], history: readonly string[]): string | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  // Never repeat the last segment; with enough choices, skip the one before too.
  const avoid = new Set(history.slice(candidates.length > 3 ? -2 : -1));
  const pool = candidates.filter((id) => !avoid.has(id));
  const from = pool.length ? pool : candidates.filter((id) => id !== history.at(-1));
  return from[Math.floor(Math.random() * from.length)] ?? candidates[0];
}

/** Framework-free scheduler: one timer, one decision at a time. */
function createRollScheduler() {
  let options: RollSchedulerOptions | null = null;
  let timer = 0;
  let started = false;
  let history: string[] = [];
  let pausedUntil = 0;

  const clear = () => window.clearTimeout(timer);

  const tick = () => {
    const o = options;
    if (!o?.enabled || document.hidden) return;

    const wait = pausedUntil - performance.now();
    if (wait > 0) return schedule(wait + 60);
    if (o.isBusy()) return schedule(cfg.busyRetryMs);

    const id = !started && o.firstId && o.candidates.includes(o.firstId) ? o.firstId : pickNext(o.candidates, history);
    if (!id || !o.roll(id)) return schedule(cfg.busyRetryMs);

    started = true;
    history = [...history.slice(-4), id];
    o.onAutoRoll?.(id);
    schedule(nextDelay());
  };

  const schedule = (delay: number) => {
    clear();
    timer = window.setTimeout(tick, delay);
  };

  return {
    /** Latest callbacks and candidates, read at decision time. */
    update: (next: RollSchedulerOptions) => {
      options = next;
    },
    start: () => schedule(started ? resumeDelay() : cfg.firstDelayMs),
    stop: clear,
    resume: () => schedule(resumeDelay()),
    notifyInteraction: () => {
      const [min, max] = cfg.resumeAfterInteractionMs;
      pausedUntil = performance.now() + between(min, max);
    },
  };
}

/**
 * ONE timer for the whole explorer. The first automatic roll is the centre
 * collection; afterwards it picks a different segment each time, waits for a
 * natural, varied pause, and never overlaps rolls. It pauses when the section
 * is offscreen, the tab is hidden, motion is reduced, or the user interacts.
 */
export function useCollectionRollScheduler(options: RollSchedulerOptions): { notifyInteraction: () => void } {
  const [scheduler] = useState(createRollScheduler);

  useEffect(() => {
    scheduler.update(options);
  });

  useEffect(() => {
    if (!options.enabled) {
      scheduler.stop();
      return;
    }
    scheduler.start();
    const onVisibility = () => (document.hidden ? scheduler.stop() : scheduler.resume());
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      scheduler.stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [options.enabled, scheduler]);

  return { notifyInteraction: scheduler.notifyInteraction };
}
