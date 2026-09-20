"use client";

import { useImperativeHandle, useRef, useSyncExternalStore, type Ref } from "react";
import { createPortal } from "react-dom";
import { explorerConfig } from "@/config/site";
import { gsap, useGSAP } from "@/lib/gsap";

export interface CollectionCursorHandle {
  show: () => void;
  hide: () => void;
  move: (x: number, y: number) => void;
  /** 0 → 1 progress of a deliberate pointer stroke. */
  setProgress: (progress: number) => void;
}

const noopSubscribe = () => () => undefined;

/**
 * Desktop-only editorial cursor label. Positioned with GSAP quickTo (no React
 * state per move) and portalled to <body> so pinned transforms never offset it.
 */
export function CollectionCursor({ ref }: { ref?: Ref<CollectionCursorHandle> }) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const movers = useRef<{ x: gsap.QuickToFunc; y: gsap.QuickToFunc } | null>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;
      gsap.set(root, { autoAlpha: 0, xPercent: -50, yPercent: -50 });
      movers.current = {
        x: gsap.quickTo(root, "x", { duration: 0.22, ease: "power3.out" }),
        y: gsap.quickTo(root, "y", { duration: 0.22, ease: "power3.out" }),
      };
    },
    { dependencies: [mounted] },
  );

  useImperativeHandle(
    ref,
    () => ({
      show: () => gsap.to(rootRef.current, { autoAlpha: 1, duration: 0.25, ease: "power2.out", overwrite: "auto" }),
      hide: () => gsap.to(rootRef.current, { autoAlpha: 0, duration: 0.2, ease: "power2.in", overwrite: "auto" }),
      move: (x, y) => {
        if (!movers.current) return;
        movers.current.x(x);
        movers.current.y(y);
      },
      setProgress: (progress) => {
        if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
      },
    }),
    [],
  );

  if (!mounted) return null;
  return createPortal(
    <div ref={rootRef} aria-hidden="true" className="collection-cursor">
      <span className="collection-cursor__label">{explorerConfig.copy.cursor}</span>
      <span className="collection-cursor__track">
        <span ref={barRef} className="collection-cursor__bar" />
      </span>
    </div>,
    document.body,
  );
}
