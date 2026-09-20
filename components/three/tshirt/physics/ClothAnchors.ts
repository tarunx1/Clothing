import { Matrix4, Quaternion, Vector3 } from "three";
import type { GarmentPhysicsConfig } from "@/config/garmentPhysics";

export class ClothAnchors {
  readonly indices: Uint32Array;
  readonly targets: Float32Array;
  readonly lambda: Float32Array;
  readonly position = new Vector3();
  readonly rotation = new Quaternion();
  readonly matrix = new Matrix4();
  scale = 1;
  private readonly tmp = new Vector3();
  private readonly unit = new Vector3();

  constructor(readonly rest: Float32Array, band = 0.1, widthFraction = 0.64) {
    let top = -Infinity, bottom = Infinity, width = 0;
    for (let i = 0; i < rest.length; i += 3) {
      top = Math.max(top, rest[i + 1]); bottom = Math.min(bottom, rest[i + 1]); width = Math.max(width, Math.abs(rest[i]));
    }
    const ids: number[] = [];
    for (let i = 0; i < rest.length / 3; i++) {
      // Three soft suspension patches: collar and the two shoulder seams.
      const x = Math.abs(rest[i * 3]), y = rest[i * 3 + 1];
      if (y > top - (top - bottom) * band && x < width * widthFraction) ids.push(i);
    }
    if (!ids.length) throw new Error("Garment proxy has no upper suspension vertices");
    this.indices = new Uint32Array(ids);
    this.targets = new Float32Array(ids.length * 3);
    this.lambda = new Float32Array(ids.length * 3);
  }

  move(target: Matrix4, dt: number, config: GarmentPhysicsConfig, snap = false) {
    target.decompose(this.tmp, this.targetRotation, this.unit);
    const scale = Math.max(this.unit.x, 0.01);
    if (snap) { this.position.copy(this.tmp); this.rotation.copy(this.targetRotation); }
    else {
      this.tmp.sub(this.position).clampLength(0, config.maxAnchorSpeed * scale * dt);
      this.position.add(this.tmp);
      this.rotation.rotateTowards(this.targetRotation, config.maxAngularSpeed * dt);
    }
    this.scale = scale;
    this.matrix.compose(this.position, this.rotation, this.unit.setScalar(scale));
    for (let k = 0; k < this.indices.length; k++) {
      this.tmp.fromArray(this.rest, this.indices[k] * 3).applyMatrix4(this.matrix).toArray(this.targets, k * 3);
    }
    this.lambda.fill(0);
  }
  private readonly targetRotation = new Quaternion();

  solve(p: Float32Array, mass: Float32Array, dt: number, compliance: number) {
    const alpha = compliance / (dt * dt);
    for (let k = 0; k < this.indices.length; k++) {
      const a = this.indices[k];
      for (let axis = 0; axis < 3; axis++) {
        const i = a * 3 + axis, j = k * 3 + axis;
        const dl = (this.targets[j] - p[i] - alpha * this.lambda[j]) / (mass[a] + alpha);
        this.lambda[j] += dl; p[i] += mass[a] * dl;
      }
    }
  }
}
