import type { DistanceConstraints } from "./ClothConstraints";

/** XPBD: alpha = compliance / dt²; multipliers persist across iterations,
 * reset per substep. See Macklin et al., Small Steps in Physics Simulation.
 * https://matthias-research.github.io/pages/publications/smallsteps.pdf
 */
export function solveDistances(p: Float32Array, mass: Float32Array, c: DistanceConstraints, dt: number, scale: number, reverse: boolean) {
  for (let n = 0; n < c.rest.length; n++) {
    const k = reverse ? c.rest.length - 1 - n : n;
    const a = c.pairs[k * 2], b = c.pairs[k * 2 + 1];
    const ai = a * 3, bi = b * 3;
    const dx = p[ai] - p[bi], dy = p[ai + 1] - p[bi + 1], dz = p[ai + 2] - p[bi + 2];
    const length = Math.hypot(dx, dy, dz);
    if (length < 1e-8) continue;
    const target = c.rest[k] * scale;
    const alpha = (length < target ? c.compression[k] : c.compliance[k]) / (dt * dt);
    const dl = (-(length - target) - alpha * c.lambda[k]) / (mass[a] + mass[b] + alpha);
    c.lambda[k] += dl;
    const wa = dl * mass[a] / length, wb = dl * mass[b] / length;
    p[ai] += dx * wa; p[ai + 1] += dy * wa; p[ai + 2] += dz * wa;
    p[bi] -= dx * wb; p[bi + 1] -= dy * wb; p[bi + 2] -= dz * wb;
  }
}

/** Cotton strain safety pass. Only tensile surface edges are limited; bending
 * and compression remain free. Alternating order avoids a directional bias.
 */
export function limitStrain(p: Float32Array, mass: Float32Array, c: DistanceConstraints, scale: number, maxRatio: number, reverse: boolean) {
  for (let n = 0; n < c.rest.length; n++) {
    const k = reverse ? c.rest.length - n - 1 : n;
    if (c.compliance[k] > 1e-6) continue;
    const a = c.pairs[k * 2], b = c.pairs[k * 2 + 1], ai = a * 3, bi = b * 3;
    const dx = p[ai] - p[bi], dy = p[ai + 1] - p[bi + 1], dz = p[ai + 2] - p[bi + 2];
    const d = Math.hypot(dx, dy, dz), max = c.rest[k] * scale * maxRatio;
    if (d <= max || d < 1e-9) continue;
    const correction = (max - d) / (d * (mass[a] + mass[b]));
    p[ai] += dx * correction * mass[a]; p[ai + 1] += dy * correction * mass[a]; p[ai + 2] += dz * correction * mass[a];
    p[bi] -= dx * correction * mass[b]; p[bi + 1] -= dy * correction * mass[b]; p[bi + 2] -= dz * correction * mass[b];
  }
}
