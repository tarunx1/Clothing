"use client";

import { useCallback, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  MathUtils,
  NeutralToneMapping,
  PCFShadowMap,
} from "three";
import { shirtConfig } from "@/config/site";
import { gsap } from "@/lib/gsap";
import { type HeroMotion } from "@/lib/heroMotion";
import { TShirtModel } from "./TShirtModel";
import { detectQuality, downgradeQuality, GarmentPerformance } from "./tshirt/GarmentQuality";
import { GarmentRig } from "./tshirt/GarmentRig";
import { GarmentLighting } from "./tshirt/GarmentLighting";
import { GARMENT_QUALITY, GARMENT_RESUME_EVENT, type GarmentAssets } from "@/config/garmentPhysics";

export interface TShirtSceneProps {
  motion: HeroMotion;
  modelAvailable: boolean;
  onReady: () => void;
  assets: GarmentAssets;
  reducedMotion: boolean;
}

const { camera: cam } = shirtConfig;

/**
 * Renders on GSAP's ticker instead of R3F's own loop, so Lenis, ScrollTrigger
 * and every tween have written their values before the frame is drawn.
 * Once the shirt has fully receded into the Collection Explorer (exit = 1)
 * nothing is simulated or drawn; scrolling back resumes with a clean reset.
 */
function GsapFrameDriver({ motion }: { motion: HeroMotion }) {
  const advance = useThree((s) => s.advance);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    let visible = true;
    let parked = false;
    const canvas = gl.domElement;
    const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; });
    observer.observe(canvas);
    canvas.setAttribute("data-render-paused", "false");
    const tick = (time: number) => {
      const hidden = motion.scroll.exit >= 0.999;
      if (hidden !== parked) {
        parked = hidden;
        canvas.setAttribute("data-render-paused", String(hidden));
        // The cloth restarts from its rest pose while still invisible.
        if (!hidden) canvas.dispatchEvent(new Event(GARMENT_RESUME_EVENT));
      }
      if (!parked && visible && !document.hidden && !gl.getContext().isContextLost()) advance(time);
    };
    gsap.ticker.add(tick);
    return () => { gsap.ticker.remove(tick); observer.disconnect(); };
  }, [advance, gl, motion]);
  return null;
}

function CameraRig({ motion }: { motion: HeroMotion }) {
  useFrame(({ camera }) => {
    camera.position.z = MathUtils.lerp(cam.z, cam.scrollZ, motion.scroll.push);
  });
  return null;
}

export default function TShirtScene({ motion, modelAvailable, onReady, assets, reducedMotion }: TShirtSceneProps) {
  const [quality, setQuality] = useState(detectQuality);
  const downgrade = useCallback(() => setQuality(downgradeQuality), []);

  return (
    <Canvas
      frameloop="never"
      shadows={GARMENT_QUALITY[quality.tier].shadows ? { type: PCFShadowMap } : false}
      dpr={quality.dpr}
      camera={{ fov: cam.fov, position: [0, 0, cam.z], near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      resize={{ scroll: false, debounce: { scroll: 0, resize: 80 } }}
      onCreated={({ gl }) => {
        gl.toneMapping = NeutralToneMapping;
        gl.toneMappingExposure = 1;
      }}
      aria-hidden="true"
    >
      <GsapFrameDriver motion={motion} />
      <GarmentPerformance onSlow={downgrade} />
      <CameraRig motion={motion} />
      <GarmentLighting motion={motion} shadows={GARMENT_QUALITY[quality.tier].shadows} />
      <GarmentRig motion={motion} reducedMotion={reducedMotion}>
        <TShirtModel modelAvailable={modelAvailable} quality={quality.tier} onReady={onReady} assets={assets} />
      </GarmentRig>
    </Canvas>
  );
}
