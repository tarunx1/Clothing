/** Long-range, tension-only constraints accelerate stretch convergence along
 * long panels. They constrain distances to physical shoulder particles, never
 * to animated targets. Compression and folding remain free.
 */
export class ClothTethers {
  readonly pairs: Uint32Array;
  readonly lengths: Float32Array;
  constructor(rest: Float32Array, anchors: Uint32Array) {
    const pairs: number[] = [], lengths: number[] = [];
    const pinned = new Set(anchors);
    for (let i = 0; i < rest.length / 3; i++) {
      if (pinned.has(i)) continue;
      for (const side of [-1, 1]) {
        let closest = -1, distance = Infinity;
        for (const a of anchors) {
          if (rest[a * 3] * side < 0.04) continue;
          const d = Math.hypot(rest[i * 3] - rest[a * 3], rest[i * 3 + 1] - rest[a * 3 + 1], rest[i * 3 + 2] - rest[a * 3 + 2]);
          if (d < distance) { closest = a; distance = d; }
        }
        if (closest >= 0) { pairs.push(i, closest); lengths.push(distance); }
      }
    }
    this.pairs = new Uint32Array(pairs); this.lengths = new Float32Array(lengths);
  }
  solve(p: Float32Array, mass: Float32Array, scale: number, allowance: number) {
    for (let k = 0; k < this.lengths.length; k++) {
      const a = this.pairs[k * 2], b = this.pairs[k * 2 + 1], ai = a * 3, bi = b * 3;
      const dx = p[ai] - p[bi], dy = p[ai + 1] - p[bi + 1], dz = p[ai + 2] - p[bi + 2];
      const d = Math.hypot(dx, dy, dz), limit = this.lengths[k] * scale * allowance;
      if (d <= limit || d < 1e-8) continue;
      const correction = (limit - d) / (d * (mass[a] + mass[b]));
      p[ai] += dx * correction * mass[a]; p[ai + 1] += dy * correction * mass[a]; p[ai + 2] += dz * correction * mass[a];
      p[bi] -= dx * correction * mass[b]; p[bi + 1] -= dy * correction * mass[b]; p[bi + 2] -= dz * correction * mass[b];
    }
  }
}
