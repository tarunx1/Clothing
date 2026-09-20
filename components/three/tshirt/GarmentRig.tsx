"use client";

import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from "three";
import { garmentPhysics } from "@/config/garmentPhysics";
import { shirtConfig, type ShirtLayout } from "@/config/site";
import { cubicBezier, type HeroMotion } from "@/lib/heroMotion";

export interface GarmentRigState { target: Matrix4; scrollVelocity: number; reducedMotion: boolean }
const RigContext = createContext<RefObject<GarmentRigState> | null>(null);
export function useGarmentRig() {
  const rig = useContext(RigContext);
  if (!rig) throw new Error("Garment requires its suspension rig");
  return rig;
}

/** GSAP drives this invisible reference frame. Visible meshes are siblings in
 * world space and receive positions only from the cloth binding.
 */
export function GarmentRig({ motion, reducedMotion, layout: fixedLayout, children }: { motion: HeroMotion; reducedMotion: boolean; layout?: ShirtLayout; children: ReactNode }) {
  const rigRef = useRef({ target: new Matrix4(), scrollVelocity: 0, reducedMotion });
  const scratchRef = useRef({ position: new Vector3(), rotation: new Euler(0, 0, 0, "YXZ"), quaternion: new Quaternion(), scale: new Vector3(), curve: [0, 0, 0] as [number, number, number], lastRotation: motion.scroll.rotY });
  useFrame(({ size }, delta) => {
    const rig = rigRef.current, scratch = scratchRef.current;
    rig.reducedMotion = reducedMotion;
    const { entrance: e, scroll: s } = motion;
    const cam = shirtConfig.camera, aspect = size.width / Math.max(size.height, 1);
    // A fixed layout (product page) overrides the hero's responsive framing.
    const layout = fixedLayout ?? (aspect < shirtConfig.stackedAspect ? shirtConfig.layouts.stacked : shirtConfig.layouts.side);
    const tanHalfFov = Math.tan(MathUtils.degToRad(cam.fov) / 2);
    const baseHeight = 2 * tanHalfFov * cam.z, baseWidth = baseHeight * aspect;
    const [fx, fy, z] = cubicBezier(layout.path, e.t, scratch.curve);
    const depthHeight = 2 * tanHalfFov * (cam.z - z);
    // Handoff: sink deeper into the black (exit 0 → 1) before rendering pauses.
    scratch.position.set(fx * depthHeight * aspect + layout.scrollShiftX * baseWidth * s.push, fy * depthHeight + s.lift * baseHeight, z - s.exit * shirtConfig.exit.depth);
    scratch.rotation.set(e.rotX, layout.restRotationY + e.rotY + s.rotY, e.rotZ);
    scratch.quaternion.setFromEuler(scratch.rotation);
    const unit = Math.min(baseHeight * layout.heightFraction, baseWidth * layout.maxWidthFraction);
    rig.target.compose(scratch.position, scratch.quaternion, scratch.scale.setScalar(unit * e.scale * s.scale * (1 - s.exit * shirtConfig.exit.scale)));
    // Velocity of the existing scroll-controlled turn, including Lenis easing.
    const velocity = (s.rotY - scratch.lastRotation) / Math.max(delta, 1 / 240);
    rig.scrollVelocity = MathUtils.clamp(velocity, -garmentPhysics.maxScrollVelocity, garmentPhysics.maxScrollVelocity);
    scratch.lastRotation = s.rotY;
  }, -2);
  return <RigContext.Provider value={rigRef}>{children}</RigContext.Provider>;
}
