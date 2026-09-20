"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Matrix4, type BufferGeometry } from "three";
import { GARMENT_RESUME_EVENT, type GarmentQuality } from "@/config/garmentPhysics";
import { useGarmentRig } from "@/components/three/tshirt/GarmentRig";
import { ClothSimulation } from "@/components/three/tshirt/physics/ClothSimulation";
import { ClothMeshBinding } from "@/components/three/tshirt/physics/ClothMeshBinding";
import { topologyGeometry } from "@/components/three/tshirt/physics/ClothProxy";
import type { ClothTopology } from "@/components/three/tshirt/physics/ClothConstraints";

export function useGarmentPhysics(topology: ClothTopology, geometries: BufferGeometry[], quality: GarmentQuality) {
  const rigRef = useGarmentRig();
  const lifecycle = useRef({ initialized: false, resume: false });
  const telemetry = useRef({ frames: 0, totalMs: 0 });
  const gl = useThree(s => s.gl);
  const resources = useMemo(() => ({
    simulation: new ClothSimulation(topology, quality),
    bindings: geometries.map(g => new ClothMeshBinding(g, topology)),
    proxy: topologyGeometry(topology),
    lastTarget: new Matrix4(),
  }), [topology, geometries, quality]);

  useEffect(() => {
    lifecycle.current.initialized = false;
    const resume = () => { if (!document.hidden) lifecycle.current.resume = true; };
    const restored = () => { lifecycle.current.resume = true; };
    document.addEventListener("visibilitychange", resume);
    gl.domElement.addEventListener("webglcontextrestored", restored);
    // Rendering was parked while the Collection Explorer covered the stage.
    gl.domElement.addEventListener(GARMENT_RESUME_EVENT, restored);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      gl.domElement.removeEventListener("webglcontextrestored", restored);
      gl.domElement.removeEventListener(GARMENT_RESUME_EVENT, restored);
      resources.proxy.dispose();
    };
  }, [resources, gl, rigRef]);

  useFrame((_, delta) => {
    const started = process.env.NODE_ENV !== "production" ? performance.now() : 0;
    const rig = rigRef.current;
    if (document.hidden || gl.getContext().isContextLost()) return;
    const { simulation, proxy } = resources;
    const changed = !rig.target.equals(resources.lastTarget);
    if (!lifecycle.current.initialized || lifecycle.current.resume || (rigRef.current.reducedMotion && changed)) {
      // Resuming happens while the shirt is still invisible: drape briefly and let it settle live.
      const quick = lifecycle.current.initialized && lifecycle.current.resume && !rigRef.current.reducedMotion;
      simulation.reset(rig.target, true, quick ? simulation.config.resumeWarmupSteps : simulation.config.warmupSteps);
      lifecycle.current.initialized = true; lifecycle.current.resume = false;
    } else if (rigRef.current.reducedMotion) return;
    else {
      simulation.advance(delta, rig.target, rig.scrollVelocity);
    }
    const displayPositions = simulation.interpolate();
    const p = proxy.getAttribute("position");
    (p.array as Float32Array).set(displayPositions); p.needsUpdate = true;
    proxy.computeVertexNormals();
    const normals = proxy.getAttribute("normal").array as Float32Array;
    for (const binding of resources.bindings) binding.update(displayPositions, normals, simulation.anchors.scale);
    resources.lastTarget.copy(rig.target);
    if (process.env.NODE_ENV !== "production") {
      const stats = telemetry.current;
      stats.frames++;
      stats.totalMs += performance.now() - started;
      // Batched development-only QA counters; no React or DOM writes per frame.
      if (stats.frames === 1 || stats.frames % 30 === 0) {
        gl.domElement.setAttribute("data-cloth-vertices", String(simulation.inverseMass.length));
        gl.domElement.setAttribute("data-cloth-resets", String(simulation.resets));
        gl.domElement.setAttribute("data-cloth-quality", quality);
        gl.domElement.setAttribute("data-cloth-time", simulation.time.toFixed(3));
        gl.domElement.setAttribute("data-cloth-frame-ms", (stats.totalMs / stats.frames).toFixed(2));
      }
    }
  }, -1);
}
