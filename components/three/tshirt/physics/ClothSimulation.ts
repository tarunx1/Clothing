import { Matrix4, Quaternion, Vector3 } from "three";
import { garmentPhysics, GARMENT_QUALITY, type GarmentPhysicsConfig, type GarmentQuality } from "@/config/garmentPhysics";
import { buildConstraints, type ClothTopology } from "./ClothConstraints";
import { ClothAnchors } from "./ClothAnchors";
import { ClothTethers } from "./ClothTethers";
import { ClothBending } from "./ClothBending";
import { ClothCollisions } from "./ClothCollisions";
import { applyAir } from "./ClothForces";
import { solveDistances, limitStrain } from "./XPBDSolver";
import { ClothPointer } from "./ClothPointer";

export class ClothSimulation {
  readonly positions: Float32Array;
  readonly previousPositions: Float32Array;
  readonly previousTickPositions: Float32Array;
  readonly renderPositions: Float32Array;
  readonly velocities: Float32Array;
  readonly inverseMass: Float32Array;
  readonly anchors: ClothAnchors;
  readonly constraints;
  readonly tethers: ClothTethers;
  readonly bending: ClothBending;
  readonly collisions: ClothCollisions;
  readonly forces: Float32Array;
  /** Mouse "hand" (set a camera ray each frame; clear it when the cursor is away). */
  readonly pointer = new ClothPointer();
  readonly quality;
  accumulator = 0;
  time = 0;
  resets = 0;
  private initialized = false;
  private readonly tmp = new Vector3();
  private readonly oldAnchorPosition = new Vector3();
  private readonly oldAnchorRotation = new Quaternion();
  private readonly carriedRotation = new Quaternion();
  private readonly carryPosition = new Vector3();

  constructor(readonly topology: ClothTopology, quality: GarmentQuality, readonly config: GarmentPhysicsConfig = garmentPhysics) {
    this.quality = GARMENT_QUALITY[quality];
    this.positions = topology.positions.slice();
    this.previousPositions = topology.positions.slice();
    this.previousTickPositions = topology.positions.slice();
    this.renderPositions = topology.positions.slice();
    this.velocities = new Float32Array(this.positions.length);
    this.forces = new Float32Array(this.positions.length);
    this.inverseMass = new Float32Array(this.positions.length / 3);
    for (let i = 0; i < this.inverseMass.length; i++) this.inverseMass[i] = topology.positions[i * 3 + 1] < -0.32 ? 1 / config.hemMass : 1;
    this.anchors = new ClothAnchors(topology.positions, config.anchorBand, config.anchorWidth);
    for (const i of this.anchors.indices) this.inverseMass[i] = config.anchorInverseMass;
    this.constraints = buildConstraints(topology, config);
    this.tethers = new ClothTethers(topology.positions, this.anchors.indices);
    this.bending = new ClothBending(topology);
    this.collisions = new ClothCollisions(topology);

  }

  /** `steps` of pre-drape; a resume while hidden uses a short one to avoid a frame hitch. */
  reset(target: Matrix4, drape = true, steps: number = this.config.warmupSteps) {
    this.anchors.move(target, 0, this.config, true);
    for (let i = 0; i < this.positions.length; i += 3) this.tmp.fromArray(this.topology.positions, i).applyMatrix4(target).toArray(this.positions, i);
    this.previousPositions.set(this.positions); this.velocities.fill(0); this.accumulator = 0;
    this.initialized = true;
    if (drape) for (let i = 0; i < steps; i++) this.step(this.config.fixedTimeStep, target, 0);
    this.velocities.fill(0); this.previousPositions.set(this.positions);
    this.previousTickPositions.set(this.positions); this.renderPositions.set(this.positions);
  }

  advance(delta: number, target: Matrix4, scroll = 0) {
    if (!this.initialized) this.reset(target);
    this.accumulator += Math.min(Math.max(delta, 0), this.config.maxFrameDelta);
    while (this.accumulator + 1e-9 >= this.config.fixedTimeStep) {
      this.previousTickPositions.set(this.positions);
      this.step(this.config.fixedTimeStep, target, scroll);
      this.accumulator -= this.config.fixedTimeStep;
    }
  }

  /** Interpolate complete physics ticks, never the previous substep. */
  interpolate() {
    const alpha = Math.max(0, Math.min(1, this.accumulator / this.config.fixedTimeStep));
    for (let i = 0; i < this.positions.length; i++) this.renderPositions[i] = this.previousTickPositions[i] + (this.positions[i] - this.previousTickPositions[i]) * alpha;
    return this.renderPositions;
  }

  private step(dt: number, target: Matrix4, scroll: number) {
    const { config: c, positions: p, velocities: v, previousPositions: prev, inverseMass: mass } = this;
    const substeps: number = this.quality.substeps;
    const h = dt / substeps;
    this.pointer.track(p, dt, this.anchors.scale, c);
    // Aerodynamic load changes slowly relative to a 1/60 s tick: evaluate once.
    applyAir(p, v, this.topology.triangles, this.forces, this.time, Math.max(-c.maxScrollVelocity, Math.min(c.maxScrollVelocity, scroll)), this.anchors.scale, c);
    for (let sub = 0; sub < substeps; sub++) {
      this.time += h;
      this.oldAnchorPosition.copy(this.anchors.position);
      this.oldAnchorRotation.copy(this.anchors.rotation);
      const oldScale = this.anchors.scale;
      this.anchors.move(target, h, c);
      const scale = this.anchors.scale;
      // Carry the display turn through the whole garment. Pulling only the
      // shoulders through a rapid half-turn winds the torso around itself.
      // Leave a little rotational/translation lag for the cloth to resolve.
      this.carriedRotation.identity().slerp(
        this.oldAnchorRotation.invert().premultiply(this.anchors.rotation), 0.98,
      );
      this.carryPosition.copy(this.oldAnchorPosition).lerp(this.anchors.position, 0.98);
      const scaleRatio = scale / oldScale;
      for (let i = 0; i < p.length; i += 3) {
        this.tmp.fromArray(p, i).sub(this.oldAnchorPosition)
          .multiplyScalar(scaleRatio).applyQuaternion(this.carriedRotation)
          .add(this.carryPosition).toArray(p, i);
        this.tmp.fromArray(v, i).multiplyScalar(scaleRatio)
          .applyQuaternion(this.carriedRotation).toArray(v, i);
      }
      const damping = Math.exp(-c.damping * h), gravity = c.gravity * scale / c.metersPerUnit;
      prev.set(p);
      for (let i = 0; i < p.length; i += 3) {
        const speed = Math.hypot(v[i], v[i + 1], v[i + 2]) / scale;
        const drag = damping / (1 + c.airDrag * speed * h);
        const w = mass[i / 3];
        v[i] = v[i] * drag + this.forces[i] * w * h;
        v[i + 1] = v[i + 1] * drag + (this.forces[i + 1] * w - gravity) * h;
        v[i + 2] = v[i + 2] * drag + this.forces[i + 2] * w * h;
        p[i] += v[i] * h; p[i + 1] += v[i + 1] * h; p[i + 2] += v[i + 2] * h;
      }
      this.pointer.solve(p, mass, h, scale, c);
      this.constraints.lambda.fill(0);
      this.bending.lambda.fill(0);
      // Small steps: few iterations per substep, many substeps per tick.
      for (let iteration = 0; iteration < this.quality.solverIterations; iteration++) {
        // Alternate sweep order between iterations only: flipping it between
        // substeps injects a 2-substep jitter that becomes velocity (buzzing).
        solveDistances(p, mass, this.constraints, h, scale, iteration % 2 === 1);
        this.bending.solve(p, mass, h, c.bendCompliance, scale);
        this.tethers.solve(p, mass, scale, c.tetherAllowance);
        this.anchors.solve(p, mass, h, c.anchorCompliance);
      }
      this.collisions.solve(p, mass, c.thickness * scale);
      for (let k = 0; k < c.strainIterations; k++) limitStrain(p, mass, this.constraints, scale, c.maxStrain, k % 2 === 1);
      for (let i = 0; i < p.length; i += 3) {
        const dx = p[i] - this.anchors.position.x, dy = p[i + 1] - this.anchors.position.y, dz = p[i + 2] - this.anchors.position.z;
        if (!Number.isFinite(dx + dy + dz) || dx * dx + dy * dy + dz * dz > 16 * scale * scale) {
          this.resets++;
          if (process.env.NODE_ENV !== "production") console.warn("[garment] Recovered an invalid cloth step");
          this.reset(target, false); return;
        }
        const vx = (p[i] - prev[i]) / h, vy = (p[i + 1] - prev[i + 1]) / h, vz = (p[i + 2] - prev[i + 2]) / h;
        const limit = Math.min(1, c.maxVelocity * scale / (Math.hypot(vx, vy, vz) || 1));
        v[i] = vx * limit; v[i + 1] = vy * limit; v[i + 2] = vz * limit;
      }
    }
  }
}
