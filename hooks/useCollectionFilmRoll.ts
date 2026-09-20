"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Collection } from "@/types/collection";

export interface FilmRollController {
  /** Current image index per collection id. One React update per roll. */
  indexes: Readonly<Record<string, number>>;
  /**
   * The single entry point for advancing a segment, shared by the automatic
   * scheduler, clicks, pointer gestures, taps and the keyboard. Returns false
   * (and does nothing) while that segment is already rolling.
   */
  rollToNextImage: (collectionId: string) => boolean;
  /** Called by the film roll once its frames have settled. */
  completeRoll: (collectionId: string) => void;
  isAnimating: (collectionId: string) => boolean;
  isAnyAnimating: () => boolean;
}

/**
 * Image order stays sequential inside every collection (01 → 02 → … → 01).
 * Each segment has its own isAnimating flag so no two timelines ever drive
 * the same film stack.
 */
export function useCollectionFilmRoll(collections: readonly Collection[]): FilmRollController {
  const [indexes, setIndexes] = useState<Record<string, number>>(() =>
    Object.fromEntries(collections.map((collection) => [collection.id, 0])),
  );
  const animating = useRef(new Map<string, boolean>());
  const frameCounts = useRef(new Map<string, number>());

  useEffect(() => {
    frameCounts.current = new Map(collections.map((collection) => [collection.id, collection.images.length]));
  }, [collections]);

  const rollToNextImage = useCallback((collectionId: string) => {
    const count = frameCounts.current.get(collectionId) ?? 0;
    if (count < 2 || animating.current.get(collectionId)) return false;
    animating.current.set(collectionId, true);
    setIndexes((previous) => ({ ...previous, [collectionId]: ((previous[collectionId] ?? 0) + 1) % count }));
    return true;
  }, []);

  const completeRoll = useCallback((collectionId: string) => {
    animating.current.set(collectionId, false);
  }, []);

  const isAnimating = useCallback((collectionId: string) => animating.current.get(collectionId) === true, []);

  const isAnyAnimating = useCallback(() => {
    for (const busy of animating.current.values()) if (busy) return true;
    return false;
  }, []);

  return { indexes, rollToNextImage, completeRoll, isAnimating, isAnyAnimating };
}
