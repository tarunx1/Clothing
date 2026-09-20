import { BufferGeometry, Float32BufferAttribute, Mesh, SkinnedMesh, Vector3, type Object3D, Matrix4 } from "three";
import { GARMENT_QUALITY, type GarmentQuality } from "@/config/garmentPhysics";
import type { ClothTopology } from "./ClothConstraints";

/** Bake imported mesh transforms without mutating useGLTF's shared cache. */
export const isPhysicsMesh = (mesh: Mesh) => /physics|collision|proxy/i.test(mesh.name);

export function bakeGeometries(scene: Object3D, normalization: Matrix4, include: (mesh: Mesh) => boolean = () => true): BufferGeometry[] {
  scene.updateMatrixWorld(true);
  const result: BufferGeometry[] = [];
  scene.traverse((o) => {
    if (o instanceof Mesh && o.geometry.getAttribute("position") && include(o)) {
      const g = o.geometry.clone();
      // Preserve the authored rest pose of skinned/morphed garments too.
      if (o instanceof SkinnedMesh || o.morphTargetInfluences?.length) {
        if (o instanceof SkinnedMesh) o.skeleton.update();
        const p = g.getAttribute("position"), point = new Vector3();
        for (let i = 0; i < p.count; i++) { o.getVertexPosition(i, point); p.setXYZ(i, point.x, point.y, point.z); }
      }
      g.applyMatrix4(new Matrix4().multiplyMatrices(normalization, o.matrixWorld));
      result.push(g);
    }
  });
  return result;
}

/** Spatial clustering keeps simulation cost bounded, including a 50k+ render GLB.
 * The z resolution preserves separate front/back panels and thin sleeve surfaces.
 * Supply a sewn, indexed proxy GLB for production garment topology.
 */
export function createClothProxy(geometries: BufferGeometry[], quality: GarmentQuality, cell: number = GARMENT_QUALITY[quality].proxyCell): ClothTopology {
  const cells = new Map<string, number>();
  const sums: number[] = [], counts: number[] = [], triangles: number[] = [];
  const faces = new Set<string>();
  for (const geometry of geometries) {
    const p = geometry.getAttribute("position"), remap = new Uint32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const key = `${Math.round(x / cell)}:${Math.round(y / cell)}:${Math.round(z / (cell * 0.5))}`;
      let index = cells.get(key);
      if (index === undefined) { index = counts.length; cells.set(key, index); counts.push(0); sums.push(0, 0, 0); }
      sums[index * 3] += x; sums[index * 3 + 1] += y; sums[index * 3 + 2] += z; counts[index]++;
      remap[i] = index;
    }
    const index = geometry.index;
    const count = index?.count ?? p.count;
    for (let i = 0; i < count; i += 3) {
      const a = remap[index ? index.getX(i) : i], b = remap[index ? index.getX(i + 1) : i + 1], c = remap[index ? index.getX(i + 2) : i + 2];
      if (a === b || a === c || b === c) continue;
      const key = [a, b, c].sort((a, b) => a - b).join(":");
      if (faces.has(key)) continue;
      faces.add(key); triangles.push(a, b, c);
    }
  }
  // Remove unused vertices left by degenerate triangles.
  const used = new Set(triangles), remap = new Map<number, number>(), positions: number[] = [];
  for (const i of used) { remap.set(i, positions.length / 3); positions.push(sums[i * 3] / counts[i], sums[i * 3 + 1] / counts[i], sums[i * 3 + 2] / counts[i]); }
  if (positions.length > 2400 * 3 && cell < 0.5) return createClothProxy(geometries, quality, cell * 1.5);
  if (positions.length < 12 || positions.length > 2400 * 3) throw new Error("Invalid garment physics proxy");
  return { positions: new Float32Array(positions), triangles: new Uint32Array(triangles.map(i => remap.get(i)!)) };
}

export function topologyGeometry(topology: ClothTopology) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(topology.positions, 3));
  geometry.setIndex(Array.from(topology.triangles));
  geometry.computeVertexNormals();
  return geometry;
}
