"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { explorerConfig } from "@/config/site";
import { collectionHref, formatIndex } from "@/lib/collections";
import { gsap } from "@/lib/gsap";
import type { Collection } from "@/types/collection";

interface CollectionInfoProps {
  collections: readonly Collection[];
  activeId: string | null;
  reducedMotion: boolean;
}

const { copy, info } = explorerConfig;

/**
 * Lower editorial area for the active collection. Every collection's index,
 * title and description is stacked in one grid cell (so the layout never
 * jumps); GSAP masks the outgoing one up and the incoming one in from below.
 */
export function CollectionInfo({ collections, activeId, reducedMotion }: CollectionInfoProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Server markup shows the initial collection; after that GSAP owns visibility.
  const [initialId] = useState(activeId);
  const shownId = useRef(activeId);
  /** Every item that is visible or on its way in, so rapid changes never leave two. */
  const visibleIds = useRef(new Set(activeId ? [activeId] : []));

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || shownId.current === activeId) return;
    shownId.current = activeId;

    const pick = (ids: Iterable<string>, part: string) =>
      Array.from(ids).flatMap((id) =>
        Array.from(root.querySelectorAll<HTMLElement>(`[data-info-part="${part}"][data-info-id="${id}"]`)),
      );
    const leaving = [...visibleIds.current].filter((id) => id !== activeId);
    const entering = activeId ? [activeId] : [];
    visibleIds.current = new Set(entering);

    const outgoingMasked = [...pick(leaving, "title"), ...pick(leaving, "index")];
    const incomingMasked = [...pick(entering, "title"), ...pick(entering, "index")];
    const outgoingCopy = pick(leaving, "description");
    const incomingCopy = pick(entering, "description");

    // overwrite: true kills every tween on these targets, including delayed
    // entrances that have not started yet.
    if (reducedMotion) {
      gsap.set([...outgoingMasked, ...outgoingCopy], { autoAlpha: 0, yPercent: 0, overwrite: true });
      gsap.fromTo(
        [...incomingMasked, ...incomingCopy],
        { autoAlpha: 0, yPercent: 0, y: 0 },
        { autoAlpha: 1, duration: 0.3, ease: "power1.out", overwrite: true },
      );
      return;
    }
    const d = info.duration;
    // Titles and numbers move like the film strip above: outgoing and incoming
    // share one ease and duration, exactly one line apart, so they never overlap.
    const strip = { duration: d, ease: "power3.inOut", overwrite: true } as const;
    gsap.to(outgoingMasked, { yPercent: -105, ...strip });
    gsap.fromTo(incomingMasked, { yPercent: 105, y: 0, autoAlpha: 1 }, { yPercent: 0, ...strip });
    // Descriptions: the old line clears before the new one rises in.
    gsap.to(outgoingCopy, { yPercent: -25, autoAlpha: 0, duration: d * 0.35, ease: "power2.in", overwrite: true });
    gsap.fromTo(
      incomingCopy,
      { yPercent: 40, y: 0, autoAlpha: 0 },
      { yPercent: 0, autoAlpha: 1, duration: d * 0.75, ease: "power3.out", delay: d * 0.35, overwrite: true },
    );
  }, [activeId, reducedMotion]);

  useEffect(() => {
    const root = rootRef.current;
    return () => {
      if (root) gsap.killTweensOf(root.querySelectorAll("[data-info-part]"));
    };
  }, []);

  const total = collections.length;
  const active = collections.find((c) => c.id === activeId) ?? collections[0];
  if (!active) return null;

  const stack = (part: "index" | "title" | "description", render: (c: Collection, i: number) => string) =>
    collections.map((collection, i) => (
      <span
        key={collection.id}
        data-info-part={part}
        data-info-id={collection.id}
        data-initial={collection.id === initialId ? "shown" : "hidden"}
        aria-hidden={collection.id !== activeId || undefined}
        className="info-stack__item"
      >
        {render(collection, i)}
      </span>
    ));

  return (
    <div ref={rootRef} className="collection-info">
      <div className="collection-info__primary">
        <p className="collection-info__count" data-anim="explorer-info">
          <span className="info-stack info-stack--masked">{stack("index", (_, i) => formatIndex(i + 1))}</span>
          <span aria-hidden="true" className="collection-info__total">
            {" / "}
            {formatIndex(total)}
          </span>
          <span className="sr-only"> of {total}</span>
        </p>
        <h3 className="collection-info__title display-type" data-anim="explorer-info">
          <span className="info-stack info-stack--masked">{stack("title", (c) => c.name)}</span>
        </h3>
      </div>

      <p className="collection-info__description" data-anim="explorer-info">
        <span className="info-stack">{stack("description", (c) => c.shortDescription)}</span>
      </p>

      <div className="collection-info__action" data-anim="explorer-info">
        <Link
          href={collectionHref(active.slug)}
          prefetch={false}
          className="collection-info__link nav-link"
          aria-label={`${copy.explore}: ${active.name}`}
        >
          {copy.explore}
          <span aria-hidden="true" className="collection-info__arrow">
            ↗
          </span>
        </Link>
      </div>
    </div>
  );
}
