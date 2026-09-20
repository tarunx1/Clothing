"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { GARMENT_QUALITY, type GarmentQuality } from "@/config/garmentPhysics";

/** Shared by every garment canvas (homepage hero, product 3D view). */
export interface SceneQuality {
  tier: GarmentQuality;
  dpr: [number, number];
}

export function detectQuality(): SceneQuality {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency ?? 8;
  const small = Math.min(window.screen.width, window.screen.height) < 768;
  const low = cores <= 4 || (coarse && small);
  const tier = low ? "low" : cores <= 8 ? "medium" : "high";
  return { tier, dpr: [...GARMENT_QUALITY[tier].dpr] };
}

/** One step down (high → medium → low); low stays low. */
export function downgradeQuality(current: SceneQuality): SceneQuality {
  if (current.tier === "low") return current;
  const tier = current.tier === "high" ? "medium" : "low";
  return { tier, dpr: [...GARMENT_QUALITY[tier].dpr] };
}

/** Change quality only after sustained slow rendering, never per-frame state.
 * Hysteresis is one-way during a visit so garment topology does not oscillate.
 */
export function GarmentPerformance({ onSlow }: { onSlow: () => void }) {
  const sample = useRef({ elapsed: 0, frames: 0, warmup: 3 });
  useFrame((_, delta) => {
    const s = sample.current;
    if (delta <= 0 || delta > 0.25) return;
    if (s.warmup > 0) { s.warmup -= delta; return; }
    s.elapsed += delta; s.frames++;
    if (s.elapsed < 2) return;
    const fps = s.frames / s.elapsed;
    s.frames = 0; s.elapsed = 0;
    if (fps < 42) { s.warmup = 3; onSlow(); }
  });
  return null;
}
