/**
 * DOM contract between the markup and the GSAP timelines. Components mark
 * elements with `data-anim`, timelines select them via `animTarget()`, so a
 * rename happens in one place.
 */
export const ANIM = {
  canvasLayer: "canvas-layer",
  canvasInner: "canvas-inner",
  content: "hero-content",
  headlineBlock: "headline-block",
  headlineLine: "headline-line",
  headlineCaption: "headline-caption",
  headlineExit: "headline-exit",
  turnBlock: "turn-block",
  turnLine: "turn-line",
  turnCaption: "turn-caption",
  turnExit: "turn-exit",
  meta: "meta",
  metaItem: "meta-item",
} as const;

export type AnimTarget = (typeof ANIM)[keyof typeof ANIM];

export const animTarget = (name: AnimTarget) => `[data-anim="${name}"]`;
