import { shirtConfig, type Vec3Tuple } from "@/config/site";

/**
 * Mutable animation state shared between the DOM (GSAP timelines) and the
 * WebGL scene (useFrame). GSAP tweens these plain numbers; the scene reads
 * them every frame. Nothing here ever touches React state.
 */
export interface ShirtEntranceState {
  /** Progress along the Bézier entrance curve. Values > 1 overshoot. */
  t: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
}

export interface ShirtScrollState {
  /** Extra Y rotation revealing the back of the shirt. */
  rotY: number;
  /** 0 → 1 camera push-in. */
  push: number;
  /** Vertical drift as a fraction of viewport height. */
  lift: number;
  scale: number;
  /** 0 → 1 lighting mood, light studio to dark rim-lit. */
  dark: number;
  /** 0 → 1 handoff to the Collection Explorer: recede, dim, then pause rendering. */
  exit: number;
}

export interface HeroMotion {
  entrance: ShirtEntranceState;
  scroll: ShirtScrollState;
}

export function createHeroMotion(): HeroMotion {
  const [rx, ry, rz] = shirtConfig.entrance.startRotation;
  return {
    entrance: {
      t: 0,
      rotX: rx,
      rotY: ry,
      rotZ: rz,
      scale: shirtConfig.entrance.startScale,
    },
    scroll: { rotY: 0, push: 0, lift: 0, scale: 1, dark: 0, exit: 0 },
  };
}

/** Final values of the entrance, used for reduced motion. */
export function settleEntrance(state: ShirtEntranceState): void {
  state.t = 1;
  state.rotX = 0;
  state.rotY = 0;
  state.rotZ = 0;
  state.scale = 1;
}

/** Evaluates a cubic Bézier per component. Works for t outside 0…1. */
export function cubicBezier(
  points: readonly [Vec3Tuple, Vec3Tuple, Vec3Tuple, Vec3Tuple],
  t: number,
  out: [number, number, number],
): [number, number, number] {
  const [p0, p1, p2, p3] = points;
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  for (let i = 0; i < 3; i++) {
    out[i] = a * p0[i] + b * p1[i] + c * p2[i] + d * p3[i];
  }
  return out;
}

/** A settled, front-facing garment for non-hero views (no entrance travel). */
export function createStudioMotion(): HeroMotion {
  const motion = createHeroMotion();
  settleEntrance(motion.entrance);
  return motion;
}

/** Turn the garment around its vertical axis (drives the cloth's air response too). */
export function setGarmentRotation(motion: HeroMotion, radians: number): void {
  motion.scroll.rotY = radians;
}
