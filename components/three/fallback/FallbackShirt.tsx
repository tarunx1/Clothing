"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, MeshPhysicalMaterial, MeshStandardMaterial, Vector2, DoubleSide, PointLight, Vector3, MathUtils } from "three";
import { shirtConfig } from "@/config/site";
import { GARMENT_QUALITY } from "@/config/garmentPhysics";
import { useGarmentPhysics } from "@/hooks/useGarmentPhysics";
import { useCottonTextures } from "../tshirt/GarmentMaterial";
import type { GarmentAssets, GarmentQuality } from "@/config/garmentPhysics";
import { useModelReady } from "../useModelReady";
import { buildPrintGeometry, buildShirtGeometry, buildShirtPhysicsTopology } from "./shirtGeometry";
import { createBackPrint, createChestPrint, createKnitNormalMap, createCottonRoughnessMap } from "./fabricTextures";

export interface FallbackShirtProps {
  quality: GarmentQuality;
  assets: GarmentAssets;
  onReady: () => void;
}

/**
 * Procedural luxury heavyweight t-shirt.
 * Features realistic 280 GSM cotton jersey weave with tactile micro-knit relief
 * that dynamically amplifies and highlights under cursor grazing light on hover.
 */
export function FallbackShirt({ quality, onReady, assets: availableAssets }: FallbackShirtProps) {
  const isHovered = useRef(false);
  const hoverFactor = useRef(0);
  const pointerTarget = useRef(new Vector3(0.18, 0.15, 0.5));
  const lightPosition = useRef(new Vector3(0.18, 0.15, 0.5));
  const inspectionLightRef = useRef<PointLight>(null);

  const assets = useMemo(() => {
    const geometry = buildShirtGeometry(quality === "high" ? "high" : "low");
    const { size } = geometry.bounds;

    const knit = createKnitNormalMap(quality === "high" ? 512 : 256);
    knit.repeat.set(28, 24);

    const roughness = createCottonRoughnessMap(quality === "high" ? 256 : 128);
    roughness.repeat.set(28, 24);

    // Luxury washed obsidian cotton jersey:
    // Soft organic fuzz sheen, authentic micro-loop normal depth, specular breakup.
    const cotton = new MeshPhysicalMaterial({
      color: new Color("#222222"),
      roughness: 0.92,
      roughnessMap: roughness,
      metalness: 0,
      vertexColors: true,
      side: DoubleSide,
      normalMap: knit,
      normalScale: new Vector2(0.48, 0.48),
      sheen: 0.68,
      sheenRoughness: 0.85,
      sheenColor: new Color("#3c3c3c"),
      specularIntensity: 0.35,
      envMapIntensity: 0.85,
    });

    const collarMaterial = cotton.clone();
    collarMaterial.vertexColors = false;
    collarMaterial.normalScale = new Vector2(0.55, 0.55);

    const backPrint = createBackPrint(shirtConfig.printColor, shirtConfig.backPrint);
    const chestPrint = createChestPrint(shirtConfig.printColor, shirtConfig.backPrint.title);
    const printMaterial = (map: typeof backPrint.texture) =>
      new MeshStandardMaterial({
        map,
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
      width: 0.095,
      height: 0.095 * (160 / 512),
      centerX: 0.16,
      centerY: 0.23,
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
      textures: [knit, roughness, backPrint.texture, chestPrint.texture],
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
      document.body.style.cursor = "default";
    },
    [assets],
  );

  useGarmentPhysics(assets.topology, assets.renderGeometries, quality);
  useCottonTextures(assets.textureMaterials, availableAssets);
  useModelReady(onReady);

  // Dynamic hover micro-texture amplification:
  // Smoothly ramps normal map relief, fiber sheen, and grazing specular light
  useFrame((_, delta) => {
    const target = isHovered.current ? 1 : 0;
    hoverFactor.current = MathUtils.damp(hoverFactor.current, target, 6, delta);
    const h = hoverFactor.current;

    const { cotton, collarMaterial } = assets.materials;
    const bodyNormal = MathUtils.lerp(0.48, 1.05, h);
    const collarNormal = MathUtils.lerp(0.55, 1.18, h);

    cotton.normalScale.set(bodyNormal, bodyNormal);
    collarMaterial.normalScale.set(collarNormal, collarNormal);
    cotton.sheen = MathUtils.lerp(0.68, 0.95, h);
    cotton.specularIntensity = MathUtils.lerp(0.35, 0.72, h);

    if (inspectionLightRef.current) {
      inspectionLightRef.current.intensity = h * 2.8;
      lightPosition.current.lerp(
        new Vector3(pointerTarget.current.x, pointerTarget.current.y, pointerTarget.current.z + 0.18),
        0.18,
      );
      inspectionLightRef.current.position.copy(lightPosition.current);
    }
  });

  const { materials, prints, geometry } = assets;

  const handlePointerOver = () => {
    isHovered.current = true;
    document.body.style.cursor = "crosshair";
  };

  const handlePointerOut = () => {
    isHovered.current = false;
    document.body.style.cursor = "default";
  };

  const handlePointerMove = (e: { point?: Vector3; stopPropagation: () => void }) => {
    e.stopPropagation();
    isHovered.current = true;
    if (e.point) {
      pointerTarget.current.copy(e.point);
    }
  };

  return (
    <group>
      {/* Dynamic grazing inspection light for micro-knit fiber texture */}
      <pointLight
        ref={inspectionLightRef}
        color="#ffffff"
        intensity={0}
        distance={2.4}
        decay={2}
        position={[0.18, 0.15, 0.45]}
      />

      <mesh
        castShadow
        receiveShadow
        geometry={geometry.body}
        material={materials.cotton}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerMove={handlePointerMove}
      />
      <mesh
        castShadow
        receiveShadow
        geometry={geometry.collar}
        material={materials.collarMaterial}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerMove={handlePointerMove}
      />
      <mesh geometry={geometry.rims} material={materials.collarMaterial} />
      <mesh geometry={prints.backPrintGeometry} material={materials.backPrintMaterial} renderOrder={1} />
      <mesh geometry={prints.chestPrintGeometry} material={materials.chestPrintMaterial} renderOrder={1} />
    </group>
  );
}
