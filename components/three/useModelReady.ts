"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

/**
 * Pre-compiles every shader in the scene, then reports readiness. The hero
 * intro waits for this, so the entrance never stutters on first-frame
 * shader compilation. Deferred by a frame so React's development
 * mount → unmount → mount cycle settles before compilation starts.
 */
export function useModelReady(onReady: () => void): void {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    let cancelled = false;
    const done = () => {
      if (!cancelled) onReady();
    };
    const frame = requestAnimationFrame(() => {
      if (cancelled) return;
      if (gl.extensions.has("KHR_parallel_shader_compile")) gl.compileAsync(scene, camera).then(done, done);
      else { gl.compile(scene, camera); done(); }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [gl, scene, camera, onReady]);
}
