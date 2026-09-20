import type { ClothTopology } from "./ClothConstraints";

/** Signed dihedral XPBD preserves the authored fold angle between neighbouring
 * triangles. Unlike distance-only bending, it resists folding a flat panel over
 * itself and remembers which side of the fabric a crease faces.
 */
export class ClothBending {
  readonly quads: Uint32Array;
  readonly rest: Float32Array;
  readonly lambda: Float32Array;
  private readonly gradient = new Float64Array(12);

  constructor(topology: ClothTopology) {
    const edges = new Map<string, number[]>(), t = topology.triangles;
    for (let i = 0; i < t.length; i += 3) for (let j = 0; j < 3; j++) {
      const a = t[i + j], b = t[i + (j + 1) % 3], c = t[i + (j + 2) % 3];
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      const edge = edges.get(key);
      if (edge) edge.push(c); else edges.set(key, [a, b, c]);
    }
    const quads: number[] = [];
    for (const e of edges.values()) if (e.length === 4) quads.push(e[2], e[3], e[0], e[1]);
    this.quads = new Uint32Array(quads);
    this.rest = new Float32Array(quads.length / 4);
    this.lambda = new Float32Array(this.rest.length);
    for (let k = 0; k < this.rest.length; k++) this.rest[k] = this.angleAndGradient(topology.positions, k);
  }

  private angleAndGradient(p: Float32Array, k: number) {
    const q = this.quads, i0 = q[k * 4] * 3, i1 = q[k * 4 + 1] * 3, i2 = q[k * 4 + 2] * 3, i3 = q[k * 4 + 3] * 3;
    const ex = p[i3] - p[i2], ey = p[i3 + 1] - p[i2 + 1], ez = p[i3 + 2] - p[i2 + 2];
    const length = Math.hypot(ex, ey, ez);
    const ax = p[i2] - p[i0], ay = p[i2 + 1] - p[i0 + 1], az = p[i2 + 2] - p[i0 + 2];
    const bx = p[i3] - p[i1], by = p[i3 + 1] - p[i1 + 1], bz = p[i3 + 2] - p[i1 + 2];
    const n0x = ay * ez - az * ey, n0y = az * ex - ax * ez, n0z = ax * ey - ay * ex;
    const n1x = ey * bz - ez * by, n1y = ez * bx - ex * bz, n1z = ex * by - ey * bx;
    const l0 = n0x * n0x + n0y * n0y + n0z * n0z, l1 = n1x * n1x + n1y * n1y + n1z * n1z;
    if (length < 1e-7 || l0 < 1e-12 || l1 < 1e-12) { this.gradient.fill(0); return 0; }
    const cross = ((n0y * n1z - n0z * n1y) * ex + (n0z * n1x - n0x * n1z) * ey + (n0x * n1y - n0y * n1x) * ez) / length;
    const angle = Math.atan2(cross, n0x * n1x + n0y * n1y + n0z * n1z);
    const d02 = ((p[i0] - p[i3]) * ex + (p[i0 + 1] - p[i3 + 1]) * ey + (p[i0 + 2] - p[i3 + 2]) * ez) / length;
    const d12 = ((p[i1] - p[i3]) * ex + (p[i1 + 1] - p[i3 + 1]) * ey + (p[i1 + 2] - p[i3 + 2]) * ez) / length;
    const g = this.gradient;
    g[0] = -length * n0x / l0; g[1] = -length * n0y / l0; g[2] = -length * n0z / l0;
    g[3] = -length * n1x / l1; g[4] = -length * n1y / l1; g[5] = -length * n1z / l1;
    g[6] = -d02 * n0x / l0 - d12 * n1x / l1; g[7] = -d02 * n0y / l0 - d12 * n1y / l1; g[8] = -d02 * n0z / l0 - d12 * n1z / l1;
    for (let axis = 0; axis < 3; axis++) g[9 + axis] = -g[axis] - g[3 + axis] - g[6 + axis];
    return angle;
  }

  solve(p: Float32Array, mass: Float32Array, dt: number, compliance: number, scale: number) {
    const alpha = compliance / (dt * dt * scale * scale);
    for (let k = 0; k < this.rest.length; k++) {
      let c = this.angleAndGradient(p, k) - this.rest[k];
      if (c > Math.PI) c -= 2 * Math.PI;
      if (c < -Math.PI) c += 2 * Math.PI;
      let denominator = alpha;
      for (let j = 0; j < 4; j++) {
        const g = j * 3;
        denominator += mass[this.quads[k * 4 + j]] * (this.gradient[g] ** 2 + this.gradient[g + 1] ** 2 + this.gradient[g + 2] ** 2);
      }
      if (denominator < 1e-10) continue;
      const dl = (-c - alpha * this.lambda[k]) / denominator;
      this.lambda[k] += dl;
      for (let j = 0; j < 4; j++) {
        const index = this.quads[k * 4 + j];
        for (let axis = 0; axis < 3; axis++) p[index * 3 + axis] += mass[index] * dl * this.gradient[j * 3 + axis];
      }
    }
  }
}
