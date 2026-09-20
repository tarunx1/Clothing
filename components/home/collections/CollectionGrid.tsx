"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { ScrollTrigger } from "@/lib/gsap";

interface CollectionGridProps {
  /** Number of segments, derived from the enabled collections. */
  count: number;
  /** Horizontal snap rail (mobile) instead of equal columns. */
  rail: boolean;
  hovering: boolean;
  /** Rail only: the segment to centre on first layout. */
  initialId: string | null;
  /** Rail only: reports the predominantly visible segment. */
  onVisibleChange: (collectionId: string) => void;
  onPointerLeave: () => void;
  children: ReactNode;
}

/**
 * Layout for the upper area. Desktop and tablet: N equal vertical frames.
 * Mobile: a scroll-snap rail where the next collection peeks in.
 */
export function CollectionGrid({ count, rail, hovering, initialId, onVisibleChange, onPointerLeave, children }: CollectionGridProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const reportVisible = useRef(onVisibleChange);
  /** Rail: the collection the visitor is looking at (starts on the centre). */
  const focusedId = useRef(initialId);

  useEffect(() => {
    reportVisible.current = onVisibleChange;
  });

  // Centre the rail on the focused collection. ScrollTrigger re-parents the
  // pinned stage on every refresh, which resets horizontal scroll, so the
  // position is restored after each refresh as well as on first layout.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!rail || !list) return;
    const centre = () => {
      const item = focusedId.current && list.querySelector<HTMLElement>(`[data-collection-id="${focusedId.current}"]`);
      if (item) list.scrollLeft = item.offsetLeft - list.offsetLeft - (list.clientWidth - item.clientWidth) / 2;
    };
    centre();
    ScrollTrigger.addEventListener("refresh", centre);
    return () => ScrollTrigger.removeEventListener("refresh", centre);
  }, [rail]);

  useEffect(() => {
    const list = listRef.current;
    if (!rail || !list) return;
    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.collectionId;
          if (id) ratios.set(id, entry.intersectionRatio);
        }
        let best: string | null = null;
        let bestRatio = 0.55;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        if (best) {
          focusedId.current = best;
          reportVisible.current(best);
        }
      },
      { root: list, threshold: [0, 0.25, 0.55, 0.75, 0.95] },
    );
    list.querySelectorAll("[data-collection-id]").forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [rail, count]);

  return (
    <ul
      ref={listRef}
      className="collection-grid"
      data-layout={rail ? "rail" : "columns"}
      data-hovering={hovering || undefined}
      style={{ ["--collection-count" as string]: count }}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </ul>
  );
}
