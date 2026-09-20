import type { ClothTopology } from "./ClothConstraints";

/** Broad-phase candidates are precomputed for this bounded hero motion.
 * Non-neighbour surface particles cannot occupy the same thickness sphere.
 * This is an approximation, not continuous triangle self-collision.
 */
export class ClothCollisions {
  readonly pairs: Uint32Array;
  constructor({ positions: p, triangles }: ClothTopology) {
    const neighbours = new Set<string>();
    for (let k = 0; k < triangles.length; k += 3) for (let j = 0; j < 3; j++) {
      const a = triangles[k + j], b = triangles[k + (j + 1) % 3];
      neighbours.add(`${Math.min(a, b)}:${Math.max(a, b)}`);
    }
    const pairs: number[] = [];
    for (let a = 0; a < p.length / 3; a++) for (let b = a + 1; b < p.length / 3; b++) {
      const d = Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);
      if (d > 0.018 && d < 0.08 && !neighbours.has(`${a}:${b}`)) pairs.push(a, b);
    }
    this.pairs = new Uint32Array(pairs);
  }
  solve(p: Float32Array, mass: Float32Array, thickness: number) {
    for (let k = 0; k < this.pairs.length; k += 2) {
      const a = this.pairs[k], b = this.pairs[k + 1], ai = a * 3, bi = b * 3;
      const dx = p[ai] - p[bi], dy = p[ai + 1] - p[bi + 1], dz = p[ai + 2] - p[bi + 2];
      const d = Math.hypot(dx, dy, dz);
      if (d >= thickness || d < 1e-8) continue;
      const w = (thickness - d) / (d * (mass[a] + mass[b]));
      p[ai] += dx * w * mass[a]; p[ai + 1] += dy * w * mass[a]; p[ai + 2] += dz * w * mass[a];
      p[bi] -= dx * w * mass[b]; p[bi + 1] -= dy * w * mass[b]; p[bi + 2] -= dz * w * mass[b];
    }
  }
}
