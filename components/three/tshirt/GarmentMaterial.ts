"use client";

import { useEffect } from "react";
import { Color, MeshPhysicalMaterial, MeshStandardMaterial, SRGBColorSpace, TextureLoader, Vector2, type Material, type Texture } from "three";
import type { GarmentAssets } from "@/config/garmentPhysics";

export function cottonMaterial(source: Material): MeshStandardMaterial {
  const material = source instanceof MeshStandardMaterial ? source.clone() : new MeshPhysicalMaterial();
  if (!material.map && !/print|logo|ink|label/i.test(material.name)) material.color.copy(new Color("#202020"));
  material.metalness = 0; material.roughness = Math.max(material.roughness, 0.9);
  material.envMapIntensity = 0.65;
  if (material instanceof MeshPhysicalMaterial) {
    material.clearcoat = 0; material.sheen = 0.12; material.sheenRoughness = 0.95;
    material.sheenColor.set("#353535"); material.specularIntensity = 0.2;
  }
  return material;
}

/** Optional maps are server-discovered, then loaded once per asset set. A failed
 * request leaves existing GLB/procedural maps intact and cannot suspend the shirt.
 */
export function useCottonTextures(materials: MeshStandardMaterial[], assets: GarmentAssets) {
  useEffect(() => {
    let cancelled = false;
    const textures: Texture[] = [], loader = new TextureLoader();
    for (const [kind, url] of Object.entries(assets.textures)) {
      loader.load(url, texture => {
        if (cancelled) { texture.dispose(); return; }
        texture.flipY = false;
        if (kind === "basecolor") texture.colorSpace = SRGBColorSpace;
        textures.push(texture);
        for (const material of materials) {
          if (kind === "basecolor") material.map = texture;
          if (kind === "normal") { material.normalMap = texture; material.normalScale = new Vector2(0.16, 0.16); }
          if (kind === "roughness") material.roughnessMap = texture;
          if (kind === "ao") { material.aoMap = texture; material.aoMapIntensity = 0.65; }
          material.needsUpdate = true;
        }
      }, undefined, () => {
        if (process.env.NODE_ENV !== "production") console.warn(`[garment] Optional ${kind} map unavailable; using existing cotton material`);
      });
    }
    return () => { cancelled = true; textures.forEach(t => t.dispose()); };
  }, [assets, materials]);
}
