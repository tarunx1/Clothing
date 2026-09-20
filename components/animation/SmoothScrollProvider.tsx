"use client";

import Lenis from "lenis";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const LenisContext = createContext<RefObject<Lenis | null> | null>(null);

/** Access the Lenis instance (null when reduced motion uses native scroll). */
export function useLenis(): RefObject<Lenis | null> {
  const ctx = useContext(LenisContext);
  if (!ctx) throw new Error("useLenis must be used inside SmoothScrollProvider");
  return ctx;
}

/**
 * Lenis drives smooth wheel scrolling and GSAP's ticker drives Lenis, so
 * scrolling, ScrollTrigger and every tween share one requestAnimationFrame.
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);
  const reducedMotion = useReducedMotion();

  // The hero is a story that starts at the top; never restore mid-story.
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.085,
      smoothWheel: true,
      wheelMultiplier: 0.9,
    });
    lenisRef.current = lenis;

    const unsubscribe = lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    // Prioritised so scroll position is resolved before tweens and WebGL.
    gsap.ticker.add(tick, false, true);
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.refresh();

    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      unsubscribe();
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [reducedMotion]);

  return <LenisContext.Provider value={lenisRef}>{children}</LenisContext.Provider>;
}
