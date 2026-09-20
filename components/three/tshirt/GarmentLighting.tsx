"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { MathUtils, type AmbientLight, type DirectionalLight } from "three";
import type { HeroMotion } from "@/lib/heroMotion";
import { shirtConfig } from "@/config/site";

/** Studio lighting that becomes a dark, rim-lit set as the page turns black. */
export function GarmentLighting({ motion, shadows }: { motion: HeroMotion; shadows: boolean }) {
  const ambient = useRef<AmbientLight>(null);
  const key = useRef<DirectionalLight>(null);
  const fill = useRef<DirectionalLight>(null);
  const rimLeft = useRef<DirectionalLight>(null);
  const rimRight = useRef<DirectionalLight>(null);

  useFrame(({ scene }) => {
    const d = motion.scroll.dark;
    // Handoff to the Collection Explorer: every light falls away with the shirt.
    const f = 1 - motion.scroll.exit * shirtConfig.exit.lightFalloff;
    if (ambient.current) ambient.current.intensity = MathUtils.lerp(0.35, 0.20, d) * f;
    if (key.current) key.current.intensity = MathUtils.lerp(3.4, 3.0, d) * f;
    if (fill.current) fill.current.intensity = MathUtils.lerp(0.9, 0.65, d) * f;
    if (rimLeft.current) rimLeft.current.intensity = MathUtils.lerp(0.5, 4.2, d) * f;
    if (rimRight.current) rimRight.current.intensity = MathUtils.lerp(0.35, 3.4, d) * f;
    scene.environmentIntensity = MathUtils.lerp(0.7, 0.5, d) * f;
  });

  // Soft, partial self-shadowing: sleeves shade the torso without hard CG edges.
  return (
    <>
      <ambientLight ref={ambient} intensity={0.5} />
      <directionalLight castShadow={shadows} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0002} shadow-normalBias={0.008} shadow-radius={6} shadow-intensity={0.55} shadow-camera-left={-3} shadow-camera-right={3} shadow-camera-top={3} shadow-camera-bottom={-3} ref={key} position={[-5, 3.5, 3.2]} intensity={3.4} />
      <directionalLight ref={fill} position={[4, -1.5, 3]} intensity={0.9} />
      <directionalLight ref={rimLeft} position={[-4.5, 2.5, -4]} intensity={0.5} />
      <directionalLight ref={rimRight} position={[5, 3.5, -3.5]} intensity={0.35} />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={1.6} scale={[8, 3]} position={[0, 5, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1} scale={[3, 6]} position={[-5, 1, 2]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={0.5} scale={[3, 6]} position={[5, 0, -1]} rotation-y={-Math.PI / 2} />
      </Environment>
    </>
  );
}

