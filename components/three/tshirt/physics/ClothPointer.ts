import { Vector3 } from "three";
import type { GarmentPhysicsConfig } from "@/config/garmentPhysics";

/**
 * A soft "hand" that follows the mouse across the garment. The camera ray is
 * tested against the cloth particles; where it meets fabric, a kinematic
 * sphere presses a small dent and drags nearby fabric along with the cursor.
 * When the cursor leaves the garment, the sphere eases away and the cloth
 * recovers under its own simulation. Fully deterministic when inactive.
 */
export class ClothPointer {
  readonly origin = new Vector3();
  readonly direction = new Vector3(0, 0, -1);
  readonly center = new Vector3();
  readonly velocity = new Vector3();
  /** 0 → 1 contact strength, eased in and out. */
  strength = 0;
  private hasRay = false;
  private hit = false;
  private readonly target = new Vector3();
  private readonly previous = new Vector3();
  private readonly sampledDirection = new Vector3();
  private readonly sampledOrigin = new Vector3();

  setRay(origin: Vector3, direction: Vector3) {
    this.origin.copy(origin);
    this.direction.copy(direction).normalize();
    this.hasRay = true;
  }

  clearRay() {
    this.hasRay = false;
  }

  get active() {
    return this.strength > 0.001;
  }

  /** Once per physics tick: find where the ray meets the fabric and move the hand. */
  track(positions: Float32Array, dt: number, scale: number, c: GarmentPhysicsConfig) {
    const moved = this.direction.distanceToSquared(this.sampledDirection) > 1e-8 || this.origin.distanceToSquared(this.sampledOrigin) > 1e-8;
    this.sampledDirection.copy(this.direction); this.sampledOrigin.copy(this.origin);
    let nearest = Infinity;
    if (this.hasRay) {
      const hitRadius = c.pointerHitRadius * scale;
      const hit2 = hitRadius * hitRadius;
      const o = this.origin, d = this.direction;
      for (let i = 0; i < positions.length; i += 3) {
        const px = positions[i] - o.x, py = positions[i + 1] - o.y, pz = positions[i + 2] - o.z;
        const t = px * d.x + py * d.y + pz * d.z;
        if (t <= 0 || t >= nearest) continue;
        const qx = px - d.x * t, qy = py - d.y * t, qz = pz - d.z * t;
        if (qx * qx + qy * qy + qz * qz < hit2) nearest = t;
      }
    }
    const wasHit = this.hit;
    this.hit = nearest < Infinity;
    if (this.hit) {
      // Centre sits on the camera side, so the sphere shell presses `pointerPress` into the fabric.
      const radius = c.pointerRadius * scale;
      // Holding the mouse still must not chase its own dent deeper each tick.
      if (moved || !wasHit) this.target.copy(this.direction).multiplyScalar(nearest - radius + c.pointerPress * scale).add(this.origin);
      if (!wasHit || this.strength < 0.001) this.center.copy(this.target);
    }
    this.previous.copy(this.center);
    if (this.hit) this.center.lerp(this.target, 1 - Math.exp(-dt * 30));
    else this.center.addScaledVector(this.direction, -c.pointerRadius * scale * dt * 2);
    this.velocity.subVectors(this.center, this.previous).divideScalar(Math.max(dt, 1e-4));
    this.velocity.clampLength(0, c.pointerMaxSpeed * scale);
    const goal = this.hit ? 1 : 0;
    this.strength += (goal - this.strength) * (1 - Math.exp(-dt * (this.hit ? 14 : 6)));
    if (!this.hit && this.strength < 0.001) this.strength = 0;
  }

  /** Per substep: push particles out of the hand and let it drag the fabric. */
  solve(positions: Float32Array, mass: Float32Array, h: number, scale: number, c: GarmentPhysicsConfig) {
    if (!this.active) return;
    const radius = c.pointerRadius * scale;
    const influence = radius * 1.35;
    const cx = this.center.x, cy = this.center.y, cz = this.center.z;
    const drag = c.pointerFriction * this.strength;
    const vx = this.velocity.x * h, vy = this.velocity.y * h, vz = this.velocity.z * h;
    for (let i = 0, k = 0; i < positions.length; i += 3, k++) {
      if (mass[k] === 0) continue;
      const dx = positions[i] - cx, dy = positions[i + 1] - cy, dz = positions[i + 2] - cz;
      // Touch the near fabric layer; let the sewn constraints carry motion
      // into the rest of the shirt instead of dragging both panels at once.
      const depth = dx * this.direction.x + dy * this.direction.y + dz * this.direction.z;
      const contactDepth = radius - c.pointerPress * scale;
      const layerWidth = Math.max(c.thickness * scale * 2, 0.008 * scale);
      const layer = Math.max(0, Math.min(1, (contactDepth + layerWidth - depth) / layerWidth));
      if (layer === 0) continue;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= influence * influence) continue;
      const d = Math.sqrt(d2) || 1e-6;
      const falloff = 1 - d / influence;
      // Friction: nearby fabric follows the cursor's motion.
      const w = drag * falloff * falloff * layer * Math.min(1, mass[k]);
      positions[i] += vx * w; positions[i + 1] += vy * w; positions[i + 2] += vz * w;
      if (d < radius) {
        const push = (radius - d) * this.strength * layer * Math.min(1, mass[k]) * (1 - Math.exp(-40 * h));
        positions[i] += (dx / d) * push; positions[i + 1] += (dy / d) * push; positions[i + 2] += (dz / d) * push;
      }
    }
  }
}
