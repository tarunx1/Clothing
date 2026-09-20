import type { GarmentPhysicsConfig } from "@/config/garmentPhysics";

export interface ClothTopology { positions: Float32Array; triangles: Uint32Array }
export interface DistanceConstraints {
  pairs: Uint32Array;
  rest: Float32Array;
  compliance: Float32Array;
  /** Compliance while shorter than rest: fabric buckles into folds instead of compressing. */
  compression: Float32Array;
  lambda: Float32Array;
}

/** Mesh edges resist stretch; opposite edges resist shear and out-of-plane bending.
 * Opposite-vertex distance bending is the inexpensive PBD bending approximation.
 * Woven and knit cotton barely stretches but offers almost no resistance to
 * compression, which is what lets real fabric wrinkle.
 */
export function buildConstraints(topology: ClothTopology, config: GarmentPhysicsConfig): DistanceConstraints {
  const { positions: p, triangles: t } = topology;
  const edges = new Map<string, { a: number; b: number; opposite: number[] }>();
  for (let i = 0; i < t.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const a = Math.min(t[i + k], t[i + (k + 1) % 3]);
      const b = Math.max(t[i + k], t[i + (k + 1) % 3]);
      const key = `${a}:${b}`;
      if (!edges.has(key)) edges.set(key, { a, b, opposite: [] });
      edges.get(key)!.opposite.push(t[i + (k + 2) % 3]);
    }
  }
  const pairs: number[] = [], rest: number[] = [], compliance: number[] = [], compression: number[] = [];
  const seen = new Set<string>();
  const add = (a: number, b: number, c: number, squash = c) => {
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
    if (seen.has(key) || a === b) return;
    seen.add(key);
    const length = Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);
    if (length < 1e-6) return;
    pairs.push(a, b); rest.push(length); compliance.push(c); compression.push(Math.max(c, squash));
  };
  for (const { a, b } of edges.values()) {
    const diagonal = Math.abs(p[a * 3] - p[b * 3]) > 0.015 && Math.abs(p[a * 3 + 1] - p[b * 3 + 1]) > 0.015;
    add(a, b, diagonal ? config.shearCompliance : config.stretchCompliance, config.compressionCompliance);
  }
  // Optional distance bending (0 disables it; signed dihedral bending is the default).
  if (config.bendDistanceCompliance > 0) {
    for (const { opposite } of edges.values()) {
      if (opposite.length === 2) add(opposite[0], opposite[1], config.bendDistanceCompliance);
    }
  }
  return {
    pairs: new Uint32Array(pairs),
    rest: new Float32Array(rest),
    compliance: new Float32Array(compliance),
    compression: new Float32Array(compression),
    lambda: new Float32Array(rest.length),
  };
}
