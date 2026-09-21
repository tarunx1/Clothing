"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { getScrollChapters, scrollConfig, shirtConfig, siteConfig, type ScrollChapters } from "@/config/site";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { ANIM, animTarget } from "@/lib/animationTargets";
import { setSurfaceTheme } from "@/lib/surfaceTheme";
import type { HeroMotion } from "@/lib/heroMotion";
import { ScrollStageContext, viewportOffset } from "@/lib/scrollStage";
import { useTheme } from "@/components/theme/ThemeProvider";

interface ScrollTransitionProps {
  motion: HeroMotion;
  reducedMotion: boolean;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

const { light, dark } = siteConfig.colors;

/** Upward drift of the opening headline; smaller when it sits under the header. */
const headlineDrift = () => {
  const stacked = window.innerWidth / window.innerHeight < shirtConfig.stackedAspect;
  return -window.innerHeight * (stacked ? 0.015 : 0.06);
};

/**
 * Owns the pinned landing-page stage. One pin holds three chapters:
 * 1. story: the scene turns white → black (in dark mode) or stays white (in light mode) while the shirt shows its back
 *    (a scrubbed timeline whose duration is 1, so positions read as progress);
 * 2. handoff: the shirt recedes and TURN AROUND masks away;
 * 3. Collection Explorer: rendered as a child layer with its own triggers.
 */
export function ScrollTransition({ motion, reducedMotion, children, className = "", ...rest }: ScrollTransitionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Exposed through state as well: child scenes set up after the element exists.
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const attachSection = useCallback((node: HTMLElement | null) => {
    sectionRef.current = node;
    setStage(node);
  }, []);

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;
      const q = gsap.utils.selector(section);
      const chapters = getScrollChapters(reducedMotion);
      const stageBg = isDark ? dark : light;
      const stageDarkVal = isDark ? 1 : 0;

      const resetScroll = () => {
        Object.assign(motion.scroll, { rotY: 0, push: 0, lift: 0, scale: 1, dark: stageDarkVal, exit: 0 });
        setSurfaceTheme(isDark ? "dark" : "light");
      };

      // One pin for the whole stage. Every chapter trigger (here and in the
      // explorer) uses this same element; the pin refreshes last so its own
      // spacing is never added to their start positions.
      ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: () => `+=${viewportOffset(chapters.total)}`,
        pin: true,
        refreshPriority: -1,
        invalidateOnRefresh: true,
      });

      if (reducedMotion) {
        return buildReducedStory(section, q, motion, chapters, resetScroll, isDark);
      }

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: () => `+=${viewportOffset(chapters.story)}`,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: () => setSurfaceTheme(isDark ? "dark" : "light"),
        },
      });

      // Maintain active theme background (stays crisp white in light mode, deep black in dark mode)
      tl.fromTo(section, { backgroundColor: stageBg }, { backgroundColor: stageBg, ease: "sine.inOut", duration: 1 }, 0)
        .fromTo(motion.scroll, { dark: stageDarkVal }, { dark: stageDarkVal, ease: "sine.inOut", duration: 1 }, 0)
        // Shirt: front-facing until ~25%, a slow quarter turn by 60%, back revealed by 100%.
        // power2.in → power2.out with equal travel keeps angular velocity continuous at 60%.
        .fromTo(motion.scroll, { rotY: 0 }, { rotY: Math.PI / 2, ease: "power2.in", duration: 0.4 }, 0.2)
        .fromTo(
          motion.scroll,
          { rotY: Math.PI / 2 },
          { rotY: Math.PI, ease: "power2.out", duration: 0.4, immediateRender: false },
          0.6,
        )
        .fromTo(motion.scroll, { push: 0 }, { push: 1, ease: "power1.inOut", duration: 1 }, 0)
        .fromTo(motion.scroll, { lift: 0, scale: 1 }, { lift: 0.02, scale: 1.05, ease: "sine.inOut", duration: 1 }, 0)
        // Typography: drift up and soften, then mask out as the scene darkens.
        // Explicit start values: refresh on resize must never re-read a mid-scroll offset.
        .fromTo(q(animTarget(ANIM.headlineBlock)), { y: 0, opacity: 1 }, { y: headlineDrift, opacity: 0.6, duration: 0.46 }, 0)
        .fromTo(
          q(animTarget(ANIM.headlineExit)),
          { yPercent: 0 },
          { yPercent: -112, ease: "power2.in", duration: 0.13, stagger: 0.025 },
          0.4,
        )
        .fromTo(
          q(animTarget(ANIM.turnLine)),
          { yPercent: 110, y: 0 },
          { yPercent: 0, ease: "power3.out", duration: 0.17, stagger: 0.05 },
          0.55,
        )
        .fromTo(q(animTarget(ANIM.turnCaption)), { yPercent: 110, y: 0 }, { yPercent: 0, ease: "power3.out", duration: 0.12 }, 0.68)
        .fromTo(q(animTarget(ANIM.meta)), { opacity: 1 }, { opacity: 0, duration: 0.1 }, 0);

      // Handoff: the background is already black and stays untouched. The shirt
      // sinks deeper, dims and fades into it; TURN AROUND clips away upward.
      // Separate targets (exit wrappers, motion.scroll.exit, canvas-inner) mean
      // this never fights the story timeline when scrolling back.
      gsap
        .timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: section,
            start: () => `top+=${viewportOffset(chapters.story)} top`,
            end: () => `+=${viewportOffset(chapters.handoff)}`,
            scrub: true,
            // Size-independent values: keep recorded from-states across refreshes.
          },
        })
        // Timeline positions read as handoff progress (0 → 1). The explorer
        // reveal starts at ~0.7, once the shirt is nearly gone.
        .fromTo(motion.scroll, { exit: 0 }, { exit: 1, ease: "power1.inOut", duration: 0.8 }, 0.05)
        .fromTo(q(animTarget(ANIM.canvasInner)), { autoAlpha: 1 }, { autoAlpha: 0, ease: "power2.in", duration: 0.55 }, 0.2)
        .fromTo(
          q(animTarget(ANIM.turnExit)),
          { yPercent: 0 },
          { yPercent: -112, ease: "power2.in", duration: 0.3, stagger: 0.04 },
          0.12,
        )
        .set({}, {}, 1);

      return resetScroll;
    },
    { scope: sectionRef, dependencies: [reducedMotion, motion, isDark], revertOnUpdate: true },
  );

  return (
    <ScrollStageContext.Provider value={stage}>
      <section ref={attachSection} className={className} {...rest}>
        {children}
      </section>
    </ScrollStageContext.Provider>
  );
}

/**
 * Reduced motion: no scrubbing, no long rotation. The shared pin holds three
 * discrete states (light story, dark story, Collection Explorer) and the
 * scene swaps between them with short fades.
 */
type ReducedStage = "light" | "dark" | "explorer";

function buildReducedStory(
  section: HTMLElement,
  q: (selector: string) => Element[],
  motion: HeroMotion,
  chapters: ScrollChapters,
  reset: () => void,
  isDarkTheme: boolean = false,
): () => void {
  const turn = [...q(animTarget(ANIM.turnLine)), ...q(animTarget(ANIM.turnCaption))];
  const headline = q(animTarget(ANIM.headlineBlock));
  const turnBlock = q(animTarget(ANIM.turnBlock));
  const canvas = q(animTarget(ANIM.canvasInner));
  const meta = q(animTarget(ANIM.meta));
  gsap.set(turn, { yPercent: 0, y: 0 });
  gsap.set(turnBlock, { autoAlpha: 0 });

  let current: ReducedStage = isDarkTheme ? "dark" : "light";
  const apply = (next: ReducedStage) => {
    current = next;
    const isDark = isDarkTheme;
    setSurfaceTheme(isDark ? "dark" : "light");
    const fade = { duration: 0.45, ease: "power1.inOut", overwrite: "auto" as const };
    gsap.to(section, { backgroundColor: isDark ? dark : light, ...fade });
    gsap.to(headline, { autoAlpha: isDark ? 0 : 1, ...fade });
    gsap.to(meta, { autoAlpha: isDark ? 0 : 1, ...fade });
    gsap.to(turnBlock, { autoAlpha: next === "dark" ? 1 : 0, ...fade });

    const shirt = gsap.timeline().to(canvas, { autoAlpha: 0, duration: 0.2, ease: "power1.in", overwrite: "auto" });
    if (next === "explorer") {
      // Hidden: exit = 1 also pauses WebGL rendering and cloth simulation.
      shirt.call(() => Object.assign(motion.scroll, { exit: 1 }));
      return;
    }
    shirt
      .call(() => {
        Object.assign(motion.scroll, next === "dark" ? { rotY: Math.PI, dark: 1, exit: 0 } : { rotY: 0, dark: 0, exit: 0 });
      })
      .to(canvas, { autoAlpha: 1, duration: 0.35, ease: "power1.out" });
  };

  ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: () => `+=${viewportOffset(chapters.total)}`,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      const travelled = self.progress * chapters.total;
      const next: ReducedStage =
        travelled < chapters.story * 0.5 ? "light" : travelled < chapters.explorerSettled ? "dark" : "explorer";
      if (next !== current) apply(next);
    },
  });

  return reset;
}
