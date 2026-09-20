"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Matrix4, Mesh, Vector3, type Object3D } from "three";
import { shirtConfig } from "@/config/site";
import { type GarmentAssets, type GarmentQuality } from "@/config/garmentPhysics";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { useModelReady } from "./useModelReady";
import { FallbackShirt } from "./fallback/FallbackShirt";
import { createClothProxy, bakeGeometries, isPhysicsMesh } from "./tshirt/physics/ClothProxy";
import { cottonMaterial, useCottonTextures } from "./tshirt/GarmentMaterial";
import { useGarmentPhysics } from "@/hooks/useGarmentPhysics";
import { useOptionalPhysicsProxy } from "./tshirt/useOptionalPhysicsProxy";

export interface TShirtModelProps {
  modelAvailable: boolean;
  quality: GarmentQuality;
  assets: GarmentAssets;
  onReady: () => void;
  /** GLB to load when `modelAvailable`; defaults to the homepage garment. */
  modelPath?: string;
  /**
   * When set, a GLB that fails to load renders nothing and reports the error
   * instead of substituting the procedural stand-in (a product view must not
   * show a different garment).
   */
  onModelError?: () => void;
}

export function TShirtModel(props: TShirtModelProps) {
  const fallback = props.onModelError ? null : <FallbackShirt quality={props.quality} assets={props.assets} onReady={props.onReady} />;
  if (!props.modelAvailable) return fallback;
  return (
    <ModelErrorBoundary fallback={fallback} onError={props.onModelError}>
      <Suspense fallback={null}>
        <GLBShirt {...props} />
      </Suspense>
    </ModelErrorBoundary>
  );
}

function GLBShirt(props: TShirtModelProps) {
  const { scene } = useGLTF(props.modelPath ?? shirtConfig.modelPath);
  const proxy = useOptionalPhysicsProxy(props.assets.proxyAvailable);
  if (!proxy.ready) return null;
  return <SimulatedGLB {...props} scene={scene} proxyScene={proxy.scene} />;
}

/** Imported render geometry, UVs, collar, hems and material groups are preserved.
 * Baked animation is deliberately not played over the physical vertex positions.
 * Proxy and render GLBs must share source coordinates, +Y up and +Z front.
 */
function SimulatedGLB({ scene, proxyScene, quality, assets, onReady }: TShirtModelProps & { scene: Object3D; proxyScene?: Object3D }) {
  const resource = useMemo(() => {
    const box = new Box3().setFromObject(scene), center = box.getCenter(new Vector3()), size = box.getSize(new Vector3());
    const scale = 1 / Math.max(size.x, size.y, size.z, 0.001);
    const fit = new Matrix4().makeScale(scale, scale, scale).multiply(new Matrix4().makeTranslation(-center.x, -center.y, -center.z));
    const geometries = bakeGeometries(scene, fit, mesh => !isPhysicsMesh(mesh));
    const materials: ReturnType<typeof cottonMaterial>[][] = [];
    scene.traverse(o => {
      if (o instanceof Mesh && o.geometry.getAttribute("position") && !isPhysicsMesh(o)) materials.push((Array.isArray(o.material) ? o.material : [o.material]).map(cottonMaterial));
    });
    let topology;
    if (proxyScene) {
      const proxyGeometries = bakeGeometries(proxyScene, fit);
      try { topology = createClothProxy(proxyGeometries, quality); }
      catch { if (process.env.NODE_ENV !== "production") console.warn("[garment] Invalid supplied proxy; deriving one from render geometry"); }
      finally { proxyGeometries.forEach(g => g.dispose()); }
    }
    if (!topology) {
      const embedded = bakeGeometries(scene, fit, isPhysicsMesh);
      try { if (embedded.length) topology = createClothProxy(embedded, quality); }
      catch { if (process.env.NODE_ENV !== "production") console.warn("[garment] Embedded proxy invalid; deriving cloth topology"); }
      finally { embedded.forEach(g => g.dispose()); }
    }
    topology ??= createClothProxy(geometries, quality);
    return { geometries, materials, topology, textureMaterials: materials.flat() };
  }, [scene, proxyScene, quality]);
  useGarmentPhysics(resource.topology, resource.geometries, quality);
  useCottonTextures(resource.textureMaterials, assets);
  useModelReady(onReady);
  useEffect(() => () => {
    resource.geometries.forEach(g => g.dispose()); resource.materials.flat().forEach(m => m.dispose());
  }, [resource]);
  return <group>{resource.geometries.map((geometry, i) => <mesh key={i} geometry={geometry} material={resource.materials[i].length === 1 ? resource.materials[i][0] : resource.materials[i]} castShadow receiveShadow />)}</group>;
}
