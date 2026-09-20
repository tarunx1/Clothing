import { BufferGeometry, DynamicDrawUsage, Matrix4, Triangle, Vector3 } from "three";
import { topologyGeometry } from "./ClothProxy";
import type { ClothTopology } from "./ClothConstraints";

/** Barycentric surface transfer, with residual detail in a moving triangle frame.
 * Render cloth, collar and prints bind to the SAME proxy so they cannot lag apart.
 */
export class ClothMeshBinding {
  readonly indices: Uint32Array;
  readonly weights: Float32Array;
  readonly offsets: Float32Array;
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly c = new Vector3();
  private readonly tangent = new Vector3();
  private readonly bitangent = new Vector3();
  private readonly normal = new Vector3();
  private readonly point = new Vector3();
  private readonly local = new Matrix4();

  constructor(readonly geometry: BufferGeometry, topology: ClothTopology) {
    const p = geometry.getAttribute("position");
    this.indices = new Uint32Array(p.count * 3);
    this.weights = new Float32Array(p.count * 3);
    this.offsets = new Float32Array(p.count * 3);
    const triangle = new Triangle(), closest = new Vector3(), bary = new Vector3(), residual = new Vector3();
    const proxy = topologyGeometry(topology), normals = proxy.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      this.point.fromBufferAttribute(p, i);
      let best = Infinity, bestTriangle = 0;
      for (let k = 0; k < topology.triangles.length; k += 3) {
        const ids = topology.triangles;
        triangle.a.fromArray(topology.positions, ids[k] * 3); triangle.b.fromArray(topology.positions, ids[k + 1] * 3); triangle.c.fromArray(topology.positions, ids[k + 2] * 3);
        triangle.closestPointToPoint(this.point, closest);
        const distance = closest.distanceToSquared(this.point);
        if (distance < best) { best = distance; bestTriangle = k; }
      }
      const ids = topology.triangles;
      for (let j = 0; j < 3; j++) this.indices[i * 3 + j] = ids[bestTriangle + j];
      triangle.a.fromArray(topology.positions, ids[bestTriangle] * 3); triangle.b.fromArray(topology.positions, ids[bestTriangle + 1] * 3); triangle.c.fromArray(topology.positions, ids[bestTriangle + 2] * 3);
      triangle.closestPointToPoint(this.point, closest); triangle.getBarycoord(closest, bary);
      bary.toArray(this.weights, i * 3);
      this.tangent.subVectors(triangle.b, triangle.a).normalize();
      this.normal.set(0, 0, 0);
      for (let j = 0; j < 3; j++) this.normal.addScaledVector(this.a.fromBufferAttribute(normals, ids[bestTriangle + j]), this.weights[i * 3 + j]);
      this.normal.normalize(); this.bitangent.crossVectors(this.normal, this.tangent).normalize();
      this.tangent.crossVectors(this.bitangent, this.normal).normalize();
      residual.subVectors(this.point, closest);
      this.offsets[i * 3] = residual.dot(this.tangent); this.offsets[i * 3 + 1] = residual.dot(this.bitangent); this.offsets[i * 3 + 2] = residual.dot(this.normal);
    }
    proxy.dispose();
    if ("setUsage" in p) p.setUsage(DynamicDrawUsage);
  }

  update(positions: Float32Array, normals: Float32Array, scale: number, worldToLocal?: Matrix4) {
    const p = this.geometry.getAttribute("position");
    if (worldToLocal) this.local.copy(worldToLocal);
    for (let i = 0; i < p.count; i++) {
      const k = i * 3, ia = this.indices[k] * 3, ib = this.indices[k + 1] * 3, ic = this.indices[k + 2] * 3;
      this.a.fromArray(positions, ia); this.b.fromArray(positions, ib); this.c.fromArray(positions, ic);
      this.point.copy(this.a).multiplyScalar(this.weights[k]).addScaledVector(this.b, this.weights[k + 1]).addScaledVector(this.c, this.weights[k + 2]);
      this.tangent.subVectors(this.b, this.a).normalize();
      this.normal.fromArray(normals, ia).multiplyScalar(this.weights[k]);
      this.normal.addScaledVector(this.a.fromArray(normals, ib), this.weights[k + 1]);
      this.normal.addScaledVector(this.a.fromArray(normals, ic), this.weights[k + 2]).normalize();
      this.bitangent.crossVectors(this.normal, this.tangent).normalize(); this.tangent.crossVectors(this.bitangent, this.normal).normalize();
      this.point.addScaledVector(this.tangent, this.offsets[k] * scale).addScaledVector(this.bitangent, this.offsets[k + 1] * scale).addScaledVector(this.normal, this.offsets[k + 2] * scale);
      if (worldToLocal) this.point.applyMatrix4(this.local);
      p.setXYZ(i, this.point.x, this.point.y, this.point.z);
    }
    p.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}
