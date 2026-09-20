"use client";

import { useEffect, useState } from "react";
import { Mesh, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { physicsProxyPath } from "@/config/garmentPhysics";

/** Optional proxy failures are ordinary asset fallbacks, not React errors. */
export function useOptionalPhysicsProxy(available: boolean) {
  const [result, setResult] = useState<{ ready: boolean; scene?: Object3D }>({ ready: !available });
  useEffect(() => {
    if (!available) return;
    let cancelled = false, loaded: Object3D | undefined;
    const dispose = (scene: Object3D) => scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => material.dispose());
    });
    new GLTFLoader().load(physicsProxyPath, gltf => {
      if (cancelled) { dispose(gltf.scene); return; }
      loaded = gltf.scene;
      setResult({ ready: true, scene: gltf.scene });
    }, undefined, () => {
      if (cancelled) return;
      if (process.env.NODE_ENV !== "production") console.warn("[garment] Optional physics GLB unavailable; deriving proxy from the actual garment");
      setResult({ ready: true });
    });
    return () => { cancelled = true; if (loaded) dispose(loaded); };
  }, [available]);
  return result;
}
