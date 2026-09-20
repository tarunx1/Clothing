"use client";

import { createContext, useContext } from "react";

/**
 * The pinned landing-page stage. Scenes rendered inside it (the Collection
 * Explorer) attach their own ScrollTriggers to this element, offset by the
 * chapter distances in config/site.ts, instead of creating another pin.
 */
export const ScrollStageContext = createContext<HTMLElement | null>(null);

/** The pinned stage element, or null until it has mounted. */
export function useScrollStage(): HTMLElement | null {
  return useContext(ScrollStageContext);
}

/** Scroll offset (px from the stage top) for a distance in viewport heights. */
export const viewportOffset = (viewports: number) => window.innerHeight * viewports;
