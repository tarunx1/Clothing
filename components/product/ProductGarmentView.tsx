"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { NeutralToneMapping } from "three";
import { shirtConfig } from "@/config/site";
import { productConfig } from "@/config/product";
import { GARMENT_QUALITY, type GarmentAssets } from "@/config/garmentPhysics";
import { useStorePreferences } from "@/components/settings/StorePreferences";
import { createStudioMotion, setGarmentRotation, type HeroMotion } from "@/lib/heroMotion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { TShirtModel } from "@/components/three/TShirtModel";
import { GarmentRig } from "@/components/three/tshirt/GarmentRig";
import { GarmentLighting } from "@/components/three/tshirt/GarmentLighting";
import { detectQuality, downgradeQuality, GarmentPerformance, type SceneQuality } from "@/components/three/tshirt/GarmentQuality";
import styles from "./product.module.css";

const noExtraAssets: GarmentAssets = { proxyAvailable: false, textures: {} };
/** Radians per second at release; the glide decays at 4/s, so at most ~1.5 rad extra. */
const MAX_GLIDE = 6;

interface Spin {
  target: number;
  velocity: number;
  dragging: boolean;
  lastX: number;
  lastTime: number;
}

/** Integrates the release glide and returns the eased angle for this frame. */
function stepSpin(s: Spin, current: number, delta: number, reducedMotion: boolean): number {
  if (!s.dragging && !reducedMotion) {
    s.target += s.velocity * delta;
    s.velocity *= Math.exp(-delta * 4);
  }
  return reducedMotion ? s.target : current + (s.target - current) * (1 - Math.exp(-delta * 10));
}

/** Eases the garment toward the dragged angle, with a short, damped glide after release. */
function DragRotation({ motion, spin, reducedMotion }: { motion: HeroMotion; spin: { current: Spin }; reducedMotion: boolean }) {
  useFrame((_, delta) => {
    setGarmentRotation(motion, stepSpin(spin.current, motion.scroll.rotY, delta, reducedMotion));
  });
  return null;
}

/**
 * Interactive garment for the product gallery. Reuses the homepage garment
 * system (rig, lighting, model loader, cloth physics) in a centred "studio"
 * layout. Drag horizontally (or use arrow keys) to turn it; the cloth reacts
 * to the turn and to the cursor. Only renders while on screen.
 */
export default function ProductGarmentView({ glb, productName }: { glb: string; productName: string }) {
  const reducedMotion = useReducedMotion();
  const preferences = useStorePreferences();
  const [quality, setQuality] = useState<SceneQuality>(() => {
    const requested = window.matchMedia("(max-width: 767px)").matches ? preferences.mobileQuality : preferences.desktopQuality;
    if (requested === "high" || requested === "medium" || requested === "low") return { tier: requested, dpr: [...GARMENT_QUALITY[requested].dpr] as [number, number] };
    return detectQuality();
  });
  const [motion] = useState(createStudioMotion);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const spin = useRef<Spin>({ target: 0, velocity: 0, dragging: false, lastX: 0, lastTime: 0 });

  useEffect(() => {
    const element = wrapper.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "200px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (failed) return null;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    Object.assign(spin.current, { dragging: true, velocity: 0, lastX: event.clientX, lastTime: event.timeStamp });
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const s = spin.current;
    if (!s.dragging) return;
    const width = event.currentTarget.clientWidth || 1;
    const delta = ((event.clientX - s.lastX) / width) * Math.PI * 1.6;
    const dt = Math.max((event.timeStamp - s.lastTime) / 1000, 1 / 240);
    s.target += delta;
    // Bounded glide: a quick flick turns it a little further, never spins it.
    s.velocity = Math.max(-MAX_GLIDE, Math.min(MAX_GLIDE, delta / dt));
    s.lastX = event.clientX;
    s.lastTime = event.timeStamp;
  };
  const endDrag = () => {
    spin.current.dragging = false;
    setDragging(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    spin.current.velocity = 0;
    spin.current.target += event.key === "ArrowRight" ? Math.PI / 8 : -Math.PI / 8;
  };
  const reset = () => Object.assign(spin.current, { target: 0, velocity: 0 });

  return (
    <div
      ref={wrapper}
      className={styles.viewer}
      data-dragging={dragging || undefined}
      tabIndex={0}
      role="group"
      aria-roledescription={productConfig.copy.viewer3d}
      aria-label={`${productName}, interactive 3D view. Drag or use the left and right arrow keys to rotate.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    >
      <Canvas
        frameloop={visible ? "always" : "never"}
        dpr={quality.dpr}
        camera={{ fov: shirtConfig.camera.fov, position: [0, 0, shirtConfig.camera.z], near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => { gl.toneMapping = NeutralToneMapping; }}
        aria-hidden="true"
      >
        <GarmentPerformance onSlow={() => setQuality(downgradeQuality)} />
        <GarmentLighting motion={motion} shadows={false} />
        <DragRotation motion={motion} spin={spin} reducedMotion={reducedMotion} />
        <GarmentRig motion={motion} reducedMotion={reducedMotion} layout={shirtConfig.layouts.studio}>
          <TShirtModel
            modelAvailable
            modelPath={glb.startsWith("/models/") && preferences.cdn?.assetBaseUrl ? `${preferences.cdn.assetBaseUrl.replace(/\/$/, "")}${glb}` : glb}
            quality={quality.tier}
            assets={noExtraAssets}
            onReady={() => undefined}
            onModelError={() => setFailed(true)}
          />
        </GarmentRig>
      </Canvas>
      <div className={styles.viewerBar}>
        <span className={styles.viewerLabel}>{productConfig.copy.rotateHint}</span>
        <button type="button" onClick={reset} onPointerDown={(event) => event.stopPropagation()}>{productConfig.copy.resetView}</button>
      </div>
    </div>
  );
}
