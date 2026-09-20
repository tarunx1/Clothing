import type { GarmentPhysicsConfig } from "@/config/garmentPhysics";

function hash(n: number) { n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
/** Smooth value noise, with no periodic bobbing or vertex displacement shader. */
function noise(t: number, seed: number) {
  const i = Math.floor(t), f = t - i, s = f * f * (3 - 2 * f);
  return (hash(i + seed) * (1 - s) + hash(i + seed + 1) * s) * 2 - 1;
}

export function applyAir(p: Float32Array, velocity: Float32Array, triangles: Uint32Array, force: Float32Array, time: number, scroll: number, scale: number, config: GarmentPhysicsConfig) {
  force.fill(0);
  const t = time * config.windFrequency;
  const wx = scale * noise(t, 17) * config.windStrength;
  const wy = scale * noise(t, 941) * config.windStrength * 0.2;
  const wz = scale * (noise(t, 813) * config.windStrength + scroll * config.scrollAirStrength);
  for (let k = 0; k < triangles.length; k += 3) {
    const a = triangles[k] * 3, b = triangles[k + 1] * 3, c = triangles[k + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const area2 = Math.hypot(nx, ny, nz);
    if (area2 < 1e-9) continue;
    nx /= area2; ny /= area2; nz /= area2;
    const relative = nx * (wx - (velocity[a] + velocity[b] + velocity[c]) / 3) + ny * (wy - (velocity[a + 1] + velocity[b + 1] + velocity[c + 1]) / 3) + nz * (wz - (velocity[a + 2] + velocity[b + 2] + velocity[c + 2]) / 3);
    const pressure = Math.max(-5 * scale, Math.min(5 * scale, relative * Math.abs(relative) * config.airDrag));
    for (let j = 0; j < 3; j++) {
      const i = triangles[k + j] * 3;
      force[i] += nx * pressure / 6; force[i + 1] += ny * pressure / 6; force[i + 2] += nz * pressure / 6;
    }
  }
}
