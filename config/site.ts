/**
 * Single source of truth for brand copy, navigation, colours, motion timings
 * and 3D layout. Everything a designer or copywriter is likely to change
 * lives here, so components never hard-code content or choreography.
 */

export const siteConfig = {
  /** Absolute origin for canonical and Open Graph URLs. Set NEXT_PUBLIC_SITE_URL in production. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  brand: {
    name: "BRAND",
    description: "Heavyweight essentials, cut for those born to stand out.",
  },

  navigation: {
    primary: [
      { label: "Home", href: "/" },
      { label: "Shop", href: "/shop" },
      { label: "Collection", href: "/collections" },
      { label: "About", href: "/about" },
    ],
    bagLabel: "Bag",
    bagCount: 0,
  },

  footer: {
    navigationLabel: "Footer",
    // Reserved destinations until the corresponding pages/account are ready.
    secondary: [
      { label: "Instagram", href: "/instagram" },
      { label: "Contact", href: "/contact" },
    ],
  },

  hero: {
    /** Each entry is rendered as one masked line. */
    headline: ["Born to", "Stand out."],
    caption: "Collection 01 — Heavyweight cotton",
    /** Revealed as the scene turns black and the shirt shows its back. */
    turnHeadline: ["Turn", "Around."],
    turnCaption: "Back print — Limited first run",
    meta: {
      left: "SS26 / 001",
      right: "Scroll",
    },
  },

  colors: {
    light: "#FFFFFF",
    dark: "#000000",
  },
} as const;

/** Master intro timeline, in seconds from the moment the scene is ready. */
export const introTimings = {
  shirtStart: 0.3,
  headlineLineStart: 0.45,
  headlineLineStagger: 0.3,
  shirtOvershootAt: 1.55,
  shirtSettleAt: 1.8,
  captionStart: 1.05,
  navStart: 2.0,
  /** Safety net: reveal the typography even if WebGL never reports ready. */
  sceneReadyTimeoutMs: 4000,
} as const;

/**
 * Scroll storytelling. Distances are viewport heights. One pin holds the
 * stage through three chapters: the white → black story (`pinDistance`),
 * the handoff where the shirt recedes, and the Collection Explorer.
 */
export const scrollConfig = {
  pinDistance: 1.5,
  reducedMotionPinDistance: 0.6,
  /** Progress at which the header flips to white text. */
  headerThemeFlipAt: 0.5,
  /** Shirt recedes into the black while the explorer arrives. */
  handoffDistance: 0.8,
  /** Collection Explorer holds the stage (handoff + this ≈ 2.0 viewports). */
  explorerDistance: 1.2,
  reducedMotionExplorerDistance: 0.8,
} as const;

export interface ScrollChapters {
  story: number;
  handoff: number;
  explorer: number;
  total: number;
  /** Where the explorer becomes fully established. */
  explorerSettled: number;
}

export function getScrollChapters(reducedMotion: boolean): ScrollChapters {
  const story = reducedMotion ? scrollConfig.reducedMotionPinDistance : scrollConfig.pinDistance;
  const handoff = reducedMotion ? 0 : scrollConfig.handoffDistance;
  const explorer = reducedMotion ? scrollConfig.reducedMotionExplorerDistance : scrollConfig.explorerDistance;
  const explorerSettled = story + handoff + explorer * (reducedMotion ? 0.25 : 0.2);
  return { story, handoff, explorer, total: story + handoff + explorer, explorerSettled };
}

/** Collection Explorer behaviour. Copy for each collection lives in data/collections.ts. */
export const explorerConfig = {
  /** The five-segment layout's capacity; the admin enforces it for "Feature on homepage". */
  maxCollections: 5,
  copy: {
    heading: "Collections",
    explore: "Explore collection",
    cursor: "Next",
    nextImage: "Next image",
    missingImage: "Frame unavailable",
  },
  roll: {
    duration: 1.05,
    ease: "power3.inOut",
    reducedMotionFade: 0.35,
    /** Max wait for the incoming frame to decode before rolling anyway. */
    decodeTimeoutMs: 700,
  },
  scheduler: {
    firstDelayMs: 700,
    minDelayMs: 2200,
    maxDelayMs: 4500,
    resumeAfterInteractionMs: [3000, 5000] as const,
    busyRetryMs: 350,
  },
  pointer: {
    /** Deliberate vertical travel that requests one roll. */
    thresholdPx: 100,
    /** Movement per event below this is treated as jitter. */
    jitterPx: 2,
    /** A pause this long forgets partial travel. */
    idleResetMs: 450,
    /** Travel right after entering a frame is the approach, not a gesture. */
    enterSettleMs: 280,
  },
  info: {
    duration: 0.55,
  },
} as const;

export type Vec3Tuple = readonly [number, number, number];

/**
 * Shirt placement. Coordinates are viewport fractions measured from the
 * centre of the screen (x: -0.5 … 0.5, y: -0.5 … 0.5) plus a world-space
 * depth z. Paths are cubic Bézier control points; the last point is the
 * resting anchor.
 */
export interface ShirtLayout {
  /** P0, P1, P2, P3 of the entrance curve. */
  path: readonly [Vec3Tuple, Vec3Tuple, Vec3Tuple, Vec3Tuple];
  /** Largest model dimension as a fraction of the visible viewport height. */
  heightFraction: number;
  /** Upper bound for the largest dimension as a fraction of visible width. */
  maxWidthFraction: number;
  /** Horizontal drift applied as the camera pushes in during the scroll. */
  scrollShiftX: number;
  /** Resting Y rotation so the shirt reads three-dimensionally. */
  restRotationY: number;
}

export const shirtConfig = {
  /**
   * Drop a GLB at public/models/<file> to replace the procedural fallback
   * automatically. Must live in /models (the server checks that folder).
   */
  modelPath: "/models/tshirt.glb",
  /** Washed black: dark enough to read as black, light enough for folds to show. */
  color: "#202020",
  printColor: "#ecebe7",
  backPrint: {
    title: "BRAND",
    lines: ["BORN TO", "STAND OUT."],
    footnote: "001 — SS26",
  },
  camera: {
    fov: 30,
    z: 6,
    /** Camera distance at the end of the scroll story. */
    scrollZ: 5.3,
  },
  /** Aspect ratio (width / height) below which the stacked layout is used. */
  stackedAspect: 0.85,
  layouts: {
    side: {
      path: [
        [0.95, 0.46, -2.6],
        [0.66, 0.6, -1.5],
        [0.34, 0.1, -0.25],
        [0.215, -0.015, 0],
      ],
      heightFraction: 0.55,
      maxWidthFraction: 0.36,
      scrollShiftX: -0.03,
      restRotationY: -0.16,
    },
    stacked: {
      path: [
        [1.15, 0.2, -2.6],
        [0.8, 0.28, -1.5],
        [0.16, -0.08, -0.25],
        [0, -0.16, 0],
      ],
      heightFraction: 0.42,
      maxWidthFraction: 0.7,
      scrollShiftX: 0,
      restRotationY: -0.12,
    },
    /** Centred, no entrance travel: the product page 3D view. */
    studio: {
      path: [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0],
        [0, -0.02, 0],
      ],
      heightFraction: 0.74,
      maxWidthFraction: 0.84,
      scrollShiftX: 0,
      restRotationY: 0,
    },
  } satisfies Record<"side" | "stacked" | "studio", ShirtLayout>,
  /** Handoff to the Collection Explorer: the shirt sinks into the black. */
  exit: {
    depth: 1.8,
    scale: 0.12,
    lightFalloff: 0.9,
  },
  entrance: {
    startRotation: [0.26, -1.35, -0.2] as Vec3Tuple,
    startScale: 0.84,
    /** How far past the rest point (in curve time) the shirt overshoots. */
    overshoot: 0.035,
    overshootRotationY: 0.07,
  },
} as const;
