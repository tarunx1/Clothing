"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { setSurfaceTheme } from "@/lib/surfaceTheme";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { brandStory } from "@/config/brandStory";
import { LookbookLanes } from "./LookbookLanes";
import { BrandStoryPanel } from "./BrandStoryPanel";
import type { LookbookImage } from "@/types/lookbook";
import type { BrandStoryContent } from "@/lib/content/schemas";
import { useTheme } from "@/components/theme/ThemeProvider";
import styles from "./lookbook.module.css";

/** Normal document flow after the existing pinned stage. No second smooth
 * scroll instance or pin: CSS sticky holds the editorial composition. */
export function LookbookBrandStory({ images, copy }: { images: LookbookImage[]; copy: BrandStoryContent }) {
  const root = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  useGSAP(() => {
    const section = root.current;
    if (!section) return;
    const q = gsap.utils.selector(section);
    ScrollTrigger.create({
      id: "lookbook-surface", trigger: section, start: "top 100px", end: "bottom top", refreshPriority: -2,
      onEnter: () => setSurfaceTheme(isDark ? "dark" : "light"),
      onEnterBack: () => setSurfaceTheme(isDark ? "dark" : "light"),
      onToggle: self => document.documentElement.toggleAttribute("data-lookbook-active", self.isActive),
    });
    const clearHeader = () => document.documentElement.removeAttribute("data-lookbook-active");
    if (reducedMotion) return clearHeader;
    gsap.fromTo(q("[data-story-reveal]"), { y: 22, opacity: 0 }, {
      y: 0, opacity: 1, duration: 0.8, stagger: 0.07, ease: "power2.out",
      scrollTrigger: { id: "lookbook-copy", trigger: q('[data-story-panel]')[0], start: "top 85%", once: true, refreshPriority: -2 },
    });
    const media = gsap.matchMedia();
    media.add("(min-width: 1100px)", () => {
      const start = [0, -3, -1], end = [-8, -15, -11];
      q("[data-lookbook-lane]").forEach((lane, i) => {
        gsap.fromTo(lane, { y: () => window.innerHeight * start[i] / 100 }, { y: () => window.innerHeight * end[i] / 100, ease: "none", scrollTrigger: {
          id: `lookbook-lane-${i}`, trigger: section, start: "top top", end: "bottom bottom", scrub: 0.6,
          invalidateOnRefresh: true, refreshPriority: -2,
        } });
      });
    });
    return () => { media.revert(); clearHeader(); };
  }, { scope: root, dependencies: [reducedMotion, isDark], revertOnUpdate: true });

  return (
    <section ref={root} id={brandStory.id} className={styles.section} aria-labelledby="brand-story-heading">
      <div className={styles.chapter}><span>{copy.chapter}</span><span>{copy.edition}</span></div>
      <div className={styles.spread}>
        <LookbookLanes images={images} />
        <div className={styles.story} data-story-panel><BrandStoryPanel copy={copy} /></div>
      </div>
      {copy.footer ? <p className={styles.footer}>{copy.footer}</p> : null}
    </section>
  );
}
