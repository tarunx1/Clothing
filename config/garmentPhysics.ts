/** Simulation uses a unit-width garment; metersPerUnit sets its physical size. */
export const GARMENT_PRESETS = {
  heavyweightCotton: {
    metersPerUnit: 0.9,
    gravity: 9.81,
    /** Dissipate residual motion without freezing the free sleeves and hem. */
    damping: 2.4,
    airDrag: 0.22,
    stretchCompliance: 0.00000002,
    /** Compression is nearly free, so fabric buckles into folds. */
    compressionCompliance: 0.000002,
    shearCompliance: 0.00000008,
    /** Signed fold resistance for softly suspended heavyweight cotton. */
    bendCompliance: 0.0006,
    tetherAllowance: 1.02,
    maxStrain: 1.035,
    strainIterations: 6,
    /** 0 = rely on signed dihedral bending only (softer and half the constraint count). */
    bendDistanceCompliance: 0,
    anchorCompliance: 0.0000000001,
    anchorInverseMass: 0.01,
    /** Suspension patch: top fraction of height and fraction of half-width (collar + shoulder seams). */
    anchorBand: 0.10,
    anchorWidth: 0.64,
    windStrength: 0.06,
    windFrequency: 0.19,
    thickness: 0.005,
    hemMass: 1.35,
    maxVelocity: 12,
    maxAnchorSpeed: 8,
    maxAngularSpeed: 3.5,
    scrollAirStrength: 0.035,
    /** Mouse hand, in unit-width garment units. */
    pointerRadius: 0.095,
    pointerHitRadius: 0.045,
    pointerPress: 0.025,
    pointerFriction: 0.65,
    pointerMaxSpeed: 3,
    maxScrollVelocity: 3,
    fixedTimeStep: 1 / 60,
    maxFrameDelta: 0.05,
    warmupSteps: 45,
    resumeWarmupSteps: 8,
  },
} as const;

export const garmentPhysics = GARMENT_PRESETS.heavyweightCotton;
export type GarmentPhysicsConfig = { [K in keyof typeof garmentPhysics]: number };
export const GARMENT_QUALITY = {
  // Small steps: many substeps with few iterations are cheaper and truer for cloth.
  high: { substeps: 6, solverIterations: 4, proxyCell: 0.075, dpr: [1, 1.5], shadows: true },
  medium: { substeps: 5, solverIterations: 4, proxyCell: 0.09, dpr: [1, 1.35], shadows: false },
  low: { substeps: 4, solverIterations: 4, proxyCell: 0.105, dpr: [1, 1.15], shadows: false },
} as const;
export type GarmentQuality = keyof typeof GARMENT_QUALITY;

export interface GarmentAssets {
  proxyAvailable: boolean;
  textures: Partial<Record<"basecolor" | "normal" | "roughness" | "ao", string>>;
}
export const physicsProxyPath = "/models/tshirt-physics.glb";
/** Dispatched on the canvas when rendering resumes after the shirt was parked offstage. */
export const GARMENT_RESUME_EVENT = "garment:resume";
