"use client";

import { useCallback, useRef, type PointerEvent } from "react";
import { explorerConfig } from "@/config/site";

interface PointerRollGestureOptions {
  enabled: boolean;
  isBusy: () => boolean;
  /** Fired once per deliberate stroke that crosses the threshold. */
  onThreshold: () => void;
  /** 0 → 1 travel towards the threshold, for cursor feedback. */
  onProgress?: (progress: number) => void;
}

const { thresholdPx, jitterPx, idleResetMs, enterSettleMs } = explorerConfig.pointer;

/**
 * Turns deliberate vertical mouse travel into single "next image" requests.
 * Jitter (tiny or direction-flipping movement), pauses and movement during
 * an active roll never accumulate, so images cannot be skipped by accident.
 */
export function usePointerRollGesture({ enabled, isBusy, onThreshold, onProgress }: PointerRollGestureOptions) {
  const track = useRef({ travel: 0, lastY: 0, lastX: 0, lastTime: 0, direction: 0, enteredAt: 0 });

  const reset = useCallback(() => {
    track.current.travel = 0;
    track.current.direction = 0;
    onProgress?.(0);
  }, [onProgress]);

  const onPointerEnter = useCallback(
    (event: PointerEvent) => {
      track.current.lastX = event.clientX;
      track.current.lastY = event.clientY;
      track.current.lastTime = event.timeStamp;
      track.current.enteredAt = event.timeStamp;
      reset();
    },
    [reset],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!enabled || event.pointerType !== "mouse") return;
      const t = track.current;
      const dy = event.clientY - t.lastY;
      const dx = event.clientX - t.lastX;
      const idle = event.timeStamp - t.lastTime > idleResetMs;
      t.lastX = event.clientX;
      t.lastY = event.clientY;
      t.lastTime = event.timeStamp;

      if (isBusy() || idle || event.timeStamp - t.enteredAt < enterSettleMs) return reset();
      if (Math.abs(dy) < jitterPx || Math.abs(dx) > Math.abs(dy) * 1.5) return;

      const direction = Math.sign(dy);
      if (t.direction !== 0 && direction !== t.direction) {
        // A reversal is not a deliberate stroke: keep only a little momentum.
        t.travel *= 0.25;
      }
      t.direction = direction;
      t.travel += Math.abs(dy);
      onProgress?.(Math.min(t.travel / thresholdPx, 1));

      if (t.travel >= thresholdPx) {
        reset();
        onThreshold();
      }
    },
    [enabled, isBusy, onThreshold, onProgress, reset],
  );

  return { onPointerEnter, onPointerMove, onPointerLeave: reset };
}
