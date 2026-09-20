"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { explorerConfig, getScrollChapters } from "@/config/site";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { getCenterCollectionId } from "@/lib/collections";
import { useScrollStage, viewportOffset } from "@/lib/scrollStage";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useCollectionFilmRoll } from "@/hooks/useCollectionFilmRoll";
import { useCollectionRollScheduler } from "@/hooks/useCollectionRollScheduler";
import type { Collection } from "@/types/collection";
import { CollectionCursor, type CollectionCursorHandle } from "./CollectionCursor";
import { CollectionGrid } from "./CollectionGrid";
import { CollectionInfo } from "./CollectionInfo";
import { CollectionSegment, type InteractionSource } from "./CollectionSegment";

interface CollectionExplorerProps {
  /** Enabled collections in display order, images already resolved. */
  collections: Collection[];
}

const RAIL_QUERY = "(max-width: 767px)";
const HOVER_QUERY = "(hover: hover) and (pointer: fine)";
const COLUMN_SIZES = "(max-width: 767px) 84vw, (max-width: 1600px) 20vw, 360px";

/**
 * Landing-page scene after TURN AROUND. Lives inside the same pinned stage,
 * so the black background simply continues. Owns selection (active
 * collection), image indexes and the single automatic roll scheduler;
 * segments only report interactions.
 */
export function CollectionExplorer({ collections }: CollectionExplorerProps) {
  const stage = useScrollStage();
  const rootRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<CollectionCursorHandle>(null);
  const reducedMotion = useReducedMotion();
  const rail = useMediaQuery(RAIL_QUERY, false);
  const pointerMode = useMediaQuery(HOVER_QUERY, false) && !rail;

  const centerId = getCenterCollectionId(collections);
  const [activeId, setActiveId] = useState(centerId);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [visibleId, setVisibleId] = useState(centerId);
  const [live, setLive] = useState(false);
  const [loadImages, setLoadImages] = useState(false);
  const hoveredRef = useRef<string | null>(null);
  const focusedRef = useRef(false);

  const film = useCollectionFilmRoll(collections);

  const rollable = useMemo(() => collections.filter((c) => c.images.length > 1).map((c) => c.id), [collections]);
  // Mobile rail: only the predominantly visible collection may auto-roll.
  const candidates = useMemo(
    () => (rail ? (visibleId && rollable.includes(visibleId) ? [visibleId] : []) : rollable),
    [rail, visibleId, rollable],
  );

  const scheduler = useCollectionRollScheduler({
    firstId: centerId,
    candidates,
    enabled: live && !reducedMotion,
    roll: film.rollToNextImage,
    isBusy: film.isAnyAnimating,
    onAutoRoll: (id) => {
      // The automatic sequence may lead the information area, but never
      // while the visitor is pointing at or focused inside the explorer.
      if (!rail && !hoveredRef.current && !focusedRef.current) setActiveId(id);
    },
  });
  const { notifyInteraction } = scheduler;

  const handleHoverChange = useCallback(
    (id: string | null) => {
      hoveredRef.current = id;
      setHoveredId(id);
      if (id) {
        setActiveId(id);
        notifyInteraction();
      }
    },
    [notifyInteraction],
  );

  const scrollRailTo = useCallback((id: string) => {
    const item = rootRef.current?.querySelector<HTMLElement>(`[data-layout="rail"] [data-collection-id="${id}"]`);
    item?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, []);

  const handleActivate = useCallback(
    (id: string, source: InteractionSource) => {
      notifyInteraction();
      setActiveId(id);
      if (rail && source !== "pointer") scrollRailTo(id);
    },
    [notifyInteraction, rail, scrollRailTo],
  );

  const { rollToNextImage, completeRoll, isAnimating } = film;
  const handleRequestNext = useCallback(
    (id: string) => {
      notifyInteraction();
      setActiveId(id);
      return rollToNextImage(id);
    },
    [notifyInteraction, rollToNextImage],
  );

  const handleVisibleChange = useCallback((id: string) => {
    setVisibleId(id);
    setActiveId(id);
  }, []);

  const handleGridLeave = useCallback(() => {
    hoveredRef.current = null;
    setHoveredId(null);
  }, []);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!stage || !root) return;
      const q = gsap.utils.selector(root);
      const chapters = getScrollChapters(reducedMotion);

      // Request imagery while the story is still playing, well before it shows.
      ScrollTrigger.create({
        trigger: stage,
        start: () => `top+=${viewportOffset(chapters.story * 0.35)} top`,
        once: true,
        onEnter: () => setLoadImages(true),
      });

      const liveTrigger = {
        trigger: stage,
        start: () => `top+=${viewportOffset(chapters.explorerSettled)} top`,
        // The pin ends at `total`; stay live while the stage scrolls away.
        end: () => `+=${viewportOffset(chapters.total - chapters.explorerSettled + 1)}`,
        invalidateOnRefresh: true,
      };

      if (reducedMotion) {
        gsap.set(root, { autoAlpha: 0 });
        ScrollTrigger.create({
          ...liveTrigger,
          onToggle: (self) => {
            gsap.to(root, { autoAlpha: self.isActive ? 1 : 0, duration: 0.45, ease: "power1.inOut", overwrite: "auto" });
            setLive(self.isActive);
          },
        });
        ScrollTrigger.refresh();
        return;
      }

      // Nothing splits or slides: the layout is simply there as the shirt
      // recedes. Motion is reserved for the imagery coming up into the frames.
      const revealStart = chapters.story + chapters.handoff * 0.7;
      gsap
        .timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: stage,
            start: () => `top+=${viewportOffset(revealStart)} top`,
            end: () => `+=${viewportOffset(chapters.explorerSettled - revealStart)}`,
            scrub: true,
            // No invalidateOnRefresh: tween values are size-independent (start/end
            // still recompute), and invalidating would drop the from-states of
            // tweens the playhead has not reached yet.
          },
        })
        .fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.12 }, 0)
        .fromTo(
          q('[data-anim="explorer-segment"]'),
          { yPercent: 4, opacity: 0 },
          { yPercent: 0, opacity: 1, ease: "power2.out", duration: 0.5, stagger: { each: 0.07, from: "center" } },
          0.05,
        )
        .fromTo(
          q('[data-anim="explorer-separator"]'),
          { scaleY: 0 },
          { scaleY: 1, transformOrigin: "50% 0%", ease: "power2.inOut", duration: 0.55 },
          0.08,
        )
        .fromTo(
          q('[data-anim="explorer-divider"]'),
          { scaleX: 0 },
          { scaleX: 1, transformOrigin: "0% 50%", ease: "power2.inOut", duration: 0.5 },
          0.4,
        )
        .fromTo(
          q('[data-anim="explorer-info"]'),
          { yPercent: 40, opacity: 0 },
          { yPercent: 0, opacity: 1, ease: "power3.out", duration: 0.35, stagger: 0.06 },
          0.62,
        );

      ScrollTrigger.create({ ...liveTrigger, onToggle: (self) => setLive(self.isActive) });
      // Created after the stage pin: re-sort by refreshPriority and measure everything together.
      ScrollTrigger.refresh();
    },
    { scope: rootRef, dependencies: [reducedMotion, stage], revertOnUpdate: true },
  );

  if (collections.length === 0) return null;

  return (
    <div
      ref={rootRef}
      data-explorer-layer
      className="collection-explorer"
      aria-labelledby="collection-explorer-heading"
      role="region"
      onFocus={() => {
        focusedRef.current = true;
        notifyInteraction();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) focusedRef.current = false;
      }}
    >
      <h2 id="collection-explorer-heading" className="sr-only">
        {explorerConfig.copy.heading}
      </h2>

      <div className="collection-explorer__viewport">
        <div className="collection-explorer__upper">
          <CollectionGrid
            count={collections.length}
            rail={rail}
            hovering={hoveredId !== null}
            initialId={centerId}
            onVisibleChange={handleVisibleChange}
            onPointerLeave={handleGridLeave}
          >
            {collections.map((collection, i) => (
              <CollectionSegment
                key={collection.id}
                collection={collection}
                position={i + 1}
                imageIndex={film.indexes[collection.id] ?? 0}
                isActive={collection.id === activeId}
                isHovered={collection.id === hoveredId}
                loadImages={loadImages}
                reducedMotion={reducedMotion}
                pointerMode={pointerMode}
                sizes={COLUMN_SIZES}
                cursorRef={cursorRef}
                isAnimating={isAnimating}
                onActivate={handleActivate}
                onHoverChange={handleHoverChange}
                onRequestNext={handleRequestNext}
                onRollComplete={completeRoll}
              />
            ))}
          </CollectionGrid>
        </div>

        <span aria-hidden="true" data-anim="explorer-divider" className="collection-explorer__divider" />

        <CollectionInfo collections={collections} activeId={activeId} reducedMotion={reducedMotion} />
      </div>

      {pointerMode ? <CollectionCursor ref={cursorRef} /> : null}
    </div>
  );
}
