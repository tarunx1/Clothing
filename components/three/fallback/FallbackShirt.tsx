"use client";

import { useEffect, useMemo } from "react";
import { Color, MeshPhysicalMaterial, MeshStandardMaterial, Vector2, DoubleSide } from "three";
import { shirtConfig } from "@/config/site";
import { GARMENT_QUALITY } from "@/config/garmentPhysics";
import { useGarmentPhysics } from "@/hooks/useGarmentPhysics";
import { useCottonTextures } from "../tshirt/GarmentMaterial";
import type { GarmentAssets, GarmentQuality } from "@/config/garmentPhysics";
import { useModelReady } from "../useModelReady";
import { buildPrintGeometry, buildShirtGeometry, buildShirtPhysicsTopology } from "./shirtGeometry";
import { createBackPrint, createChestPrint, createKnitNormalMap } from "./fabricTextures";

export interface FallbackShirtProps {
  quality: GarmentQuality;
  assets: GarmentAssets;
  onReady: () => void;
}

/**
 * TEMPORARY stand-in used until /public/models/tshirt.glb exists.
 * Renders a unit-sized shirt (largest dimension = 1) centred on the origin,
 * matching the contract of the GLB implementation in TShirtModel.tsx.
 */
export function FallbackShirt({ quality, onReady, assets: availableAssets }: FallbackShirtProps) {
  const assets = useMemo(() => {
    const geometry = buildShirtGeometry(quality === "high" ? "high" : "low");
    const { size } = geometry.bounds;

    const knit = createKnitNormalMap(quality === "high" ? 512 : 256);
    knit.repeat.set(26, 22);

    // Matte jersey: no gloss, a soft grazing sheen from the fibres, visible knit.
    const cotton = new MeshPhysicalMaterial({
      color: new Color(shirtConfig.color),
      roughness: 0.96,
      metalness: 0,
      vertexColors: true,
      side: DoubleSide,
      normalMap: knit,
      normalScale: new Vector2(0.12, 0.12),
      sheen: 0.18,
      sheenRoughness: 0.95,
      sheenColor: new Color("#353535"),
      specularIntensity: 0.2,
      envMapIntensity: 0.65,
    });
    const collarMaterial = cotton.clone();
    collarMaterial.vertexColors = false;
    collarMaterial.normalScale = new Vector2(0.18, 0.18);

    const backPrint = createBackPrint(shirtConfig.printColor, shirtConfig.backPrint);
    const chestPrint = createChestPrint(shirtConfig.printColor, shirtConfig.backPrint.title);
    const printMaterial = (map: typeof backPrint.texture) =>
      new MeshStandardMaterial({
        map,
        // A touch of self-light keeps the ink legible once the set goes dark.
        emissiveMap: map,
        emissive: new Color("#ffffff"),
        emissiveIntensity: 0.18,
        transparent: true,
        depthWrite: false,
        roughness: 1,
        metalness: 0,
        side: DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
    const backPrintMaterial = printMaterial(backPrint.texture);
    const chestPrintMaterial = printMaterial(chestPrint.texture);

    const backWidth = 0.44;
    const backPrintGeometry = buildPrintGeometry(geometry.surface, {
      width: backWidth,
      height: backWidth * (620 / 1024),
      centerX: 0,
      centerY: 0.2,
      side: -1,
    });
    const chestPrintGeometry = buildPrintGeometry(geometry.surface, {
      width: 0.1,
      height: 0.1 * (160 / 512),
      centerX: 0.17,
      centerY: 0.27,
      side: 1,
    });

    const renderGeometries = [geometry.body, geometry.collar, geometry.rims, backPrintGeometry, chestPrintGeometry];
    for (const g of renderGeometries) g.scale(1 / size, 1 / size, 1 / size);
    const topology = buildShirtPhysicsTopology(GARMENT_QUALITY[quality].proxyCell);

    return {
      geometry,
      topology,
      renderGeometries,
      textureMaterials: [cotton, collarMaterial],
      materials: { cotton, collarMaterial, backPrintMaterial, chestPrintMaterial },
      prints: { backPrintGeometry, chestPrintGeometry },
      textures: [knit, backPrint.texture, chestPrint.texture],
    };
  }, [quality]);

  useEffect(
    () => () => {
      assets.geometry.body.dispose();
      assets.geometry.collar.dispose();
      assets.geometry.rims.dispose();
      Object.values(assets.prints).forEach((g) => g.dispose());
      Object.values(assets.materials).forEach((m) => m.dispose());
      assets.textures.forEach((t) => t.dispose());
    },
    [assets],
  );

  useGarmentPhysics(assets.topology, assets.renderGeometries, quality);
  useCottonTextures(assets.textureMaterials, availableAssets);

  useModelReady(onReady);

  const { materials, prints, geometry } = assets;
  return (
    <group>
      <mesh castShadow receiveShadow geometry={geometry.body} material={materials.cotton} />
      <mesh castShadow receiveShadow geometry={geometry.collar} material={materials.collarMaterial} />
      <mesh geometry={geometry.rims} material={materials.collarMaterial} />
      <mesh geometry={prints.backPrintGeometry} material={materials.backPrintMaterial} renderOrder={1} />
      <mesh geometry={prints.chestPrintGeometry} material={materials.chestPrintMaterial} renderOrder={1} />
    </group>
  );
}
