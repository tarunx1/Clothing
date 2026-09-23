"use client";

import type { GarmentAssets } from "@/config/garmentPhysics";
import type { HeroContent } from "@/lib/content/schemas";
import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { introTimings, shirtConfig } from "@/config/site";
import { gsap, useGSAP } from "@/lib/gsap";
import { ANIM, animTarget } from "@/lib/animationTargets";
import { createHeroMotion, settleEntrance } from "@/lib/heroMotion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ModelErrorBoundary } from "@/components/three/ModelErrorBoundary";
import { HeroTypography } from "./HeroTypography";
import { ScrollTransition } from "./ScrollTransition";
import { GarmentFeatureCallouts } from "./GarmentFeatureCallouts";

// WebGL is client-only and code-split away from the first paint.
const TShirtScene = dynamic(() => import("@/components/three/TShirtScene"), {
  loading: () => null,
});

interface HeroProps {
  modelAvailable: boolean;
  /** Admin-managed copy (lib/content). Layout and motion stay in code. */
  copy: HeroContent;
  assets: GarmentAssets;
  /** Later landing-page scenes, layered inside the same pinned stage. */
  children?: ReactNode;
}

export function Hero({ modelAvailable, assets, copy, children }: HeroProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [motion] = useState(createHeroMotion);
  const reducedMotion = useReducedMotion();
  const [sceneReady, setSceneReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  const introPlayed = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const markReady = useCallback(() => setSceneReady(true), []);

  // Never hold the page hostage: reveal the copy even if WebGL stalls.
  useEffect(() => {
    const id = window.setTimeout(markReady, introTimings.sceneReadyTimeoutMs);
    return () => window.clearTimeout(id);
  }, [markReady]);

  useGSAP(
    () => {
      if (!sceneReady) return;
      const q = gsap.utils.selector(rootRef);
      const lines = q(animTarget(ANIM.headlineLine));
      const caption = q(animTarget(ANIM.headlineCaption));
      const canvasLayer = q(animTarget(ANIM.canvasLayer));
      const metaItems = q(animTarget(ANIM.metaItem));
      // The header lives in the layout; its items opt in with data-intro-nav.
      // Queried from the document explicitly: string selectors are scoped to the hero.
      const navItems = Array.from(document.querySelectorAll<HTMLElement>("[data-intro-nav]"));
      const { entrance } = motion;
      const T = introTimings;

      if (reducedMotion || introPlayed.current) {
        settleEntrance(entrance);
        gsap.set([...lines, ...caption], { yPercent: 0, y: 0 });
        gsap.set([...navItems, ...metaItems, ...canvasLayer], { opacity: 1, y: 0 });
        if (!introPlayed.current) {
          // Reduced motion: a quiet fade, no travel.
          gsap.from([...canvasLayer, ...q(animTarget(ANIM.content)), ...navItems], {
            opacity: 0,
            duration: 0.8,
            ease: "power1.out",
          });
        }
        introPlayed.current = true;
        return;
      }

      const e = shirtConfig.entrance;
      const settle = T.shirtSettleAt - T.shirtOvershootAt;
      const travel = T.shirtOvershootAt - T.shirtStart;

      // ONE master timeline for the whole opening.
      const tl = gsap.timeline({
        onComplete: () => {
          introPlayed.current = true;
        },
      });

      tl.set(canvasLayer, { opacity: 1 }, 0)
        // Shirt travels along the Bézier curve, decelerates, overshoots slightly, settles.
        .to(entrance, { t: 1 + e.overshoot, duration: travel, ease: "power3.out" }, T.shirtStart)
        .to(entrance, { t: 1, duration: settle, ease: "sine.inOut" }, T.shirtOvershootAt)
        // Turns to face the camera: slow start, most of the turn after ~0.7s.
        .to(entrance, { rotY: e.overshootRotationY, duration: travel, ease: "power3.inOut" }, T.shirtStart)
        .to(entrance, { rotY: 0, duration: settle, ease: "sine.inOut" }, T.shirtOvershootAt)
        .to(entrance, { rotX: -0.025, rotZ: 0.012, scale: 1.012, duration: travel, ease: "power3.out" }, T.shirtStart)
        .to(entrance, { rotX: 0, rotZ: 0, scale: 1, duration: settle, ease: "sine.inOut" }, T.shirtOvershootAt)
        // Headline lines rise out of their masks.
        .fromTo(
          lines,
          // Origin set in the from-state so the tilt pivots on the baseline before the tween starts.
          { yPercent: 110, y: 0, rotate: 2.5, transformOrigin: "0% 100%" },
          { yPercent: 0, rotate: 0, duration: 1.15, ease: "power4.out", stagger: T.headlineLineStagger },
          T.headlineLineStart,
        )
        .fromTo(caption, { yPercent: 110, y: 0 }, { yPercent: 0, duration: 0.9, ease: "power3.out" }, T.captionStart)
        // Navigation and meta arrive last, quietly.
        .fromTo(
          navItems,
          { opacity: 0, y: -6 },
          { opacity: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.06 },
          T.navStart,
        )
        .fromTo(
          metaItems,
          { opacity: 0 },
          { opacity: 1, duration: 0.9, ease: "power2.out", stagger: 0.1 },
          T.navStart + 0.15,
        );
    },
    { scope: rootRef, dependencies: [sceneReady, reducedMotion, motion], revertOnUpdate: true },
  );

  return (
    <div ref={rootRef} data-hero-intro>
      <ScrollTransition
        motion={motion}
        reducedMotion={reducedMotion}
        aria-label="Introduction"
        className="relative h-screen overflow-hidden bg-(--theme-bg,#ffffff) supports-[height:100lvh]:h-lvh"
      >
        <div data-anim={ANIM.canvasLayer} className="absolute inset-0 opacity-0">
          <div data-anim={ANIM.canvasInner} className="pointer-events-auto absolute inset-0">
            {mounted ? (
              <ModelErrorBoundary fallback={null} onError={markReady}>
                <TShirtScene assets={assets} reducedMotion={reducedMotion} motion={motion} modelAvailable={modelAvailable} onReady={markReady} />
              </ModelErrorBoundary>
            ) : null}
          </div>
        </div>

        {/* Garment Feature Annotations & Leader Arrows */}
        <GarmentFeatureCallouts motion={motion} sceneReady={sceneReady} />

        <div data-anim={ANIM.content} className="pointer-events-none relative z-10 h-screen supports-[height:100svh]:h-svh">
          <HeroTypography copy={copy} />

          <div
            data-anim={ANIM.meta}
            className="pointer-events-auto absolute inset-x-0 bottom-0 flex items-end justify-between px-(--gutter) pb-5 text-[11px] leading-none font-medium tracking-[0.06em] text-(--theme-fg,#000000) uppercase md:pb-7 md:text-xs"
          >
            <span data-anim={ANIM.metaItem} data-reveal-fade>
              {copy.metaLeft}
            </span>
            <span data-anim={ANIM.metaItem} data-reveal-fade className="flex items-center gap-3">
              {copy.metaRight}
              <span aria-hidden="true" className="scroll-cue" />
            </span>
          </div>
        </div>

        {children}
      </ScrollTransition>
    </div>
  );
}
