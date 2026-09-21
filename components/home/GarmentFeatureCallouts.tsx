"use client";

import { useEffect, useRef, useState } from "react";
import type { HeroMotion } from "@/lib/heroMotion";
import styles from "./garmentFeatureCallouts.module.css";

interface Feature {
  id: string;
  tag: string;
  title: string;
  desc: string;
  // Position coordinates: right percentage and top percentage
  cardPos: { right: number; top: number; align?: "left" | "right" };
  pinPos: { left: number; top: number };
}

const FEATURES: Feature[] = [
  {
    id: "collar",
    tag: "01 // COLLAR",
    title: "1.25\" Rib Neck",
    desc: "Twin-needle shape retention",
    cardPos: { right: 4, top: 18, align: "right" },
    pinPos: { left: 71.5, top: 27.5 },
  },
  {
    id: "shoulder",
    tag: "02 // CUT",
    title: "Dropped Shoulder",
    desc: "Anatomical relaxed drape",
    cardPos: { right: 4, top: 31, align: "right" },
    pinPos: { left: 83.5, top: 35 },
  },
  {
    id: "print",
    tag: "03 // GRAPHIC",
    title: "High-Density Print",
    desc: "Matte soft-hand ink",
    cardPos: { right: 4, top: 44, align: "right" },
    pinPos: { left: 76, top: 40 },
  },
  {
    id: "fabric",
    tag: "04 // WEAVE",
    title: "280 GSM Jersey",
    desc: "Combed organic cotton",
    cardPos: { right: 4, top: 57, align: "right" },
    pinPos: { left: 72, top: 53 },
  },
  {
    id: "hem",
    tag: "05 // FINISH",
    title: "Blind-Stitched Hem",
    desc: "Anti-roll twin needle",
    cardPos: { right: 4, top: 70, align: "right" },
    pinPos: { left: 71, top: 72 },
  },
];

interface GarmentFeatureCalloutsProps {
  motion: HeroMotion;
  sceneReady: boolean;
}

export function GarmentFeatureCallouts({ motion, sceneReady }: GarmentFeatureCalloutsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [lines, setLines] = useState<Array<{ id: string; x1: number; y1: number; x2: number; y2: number }>>([]);

  // Fade in after the shirt finishes its entrance settle animation
  useEffect(() => {
    if (!sceneReady) return;
    const timer = setTimeout(() => {
      setVisible(true);
    }, 1900); // Settles at 1.8s
    return () => clearTimeout(timer);
  }, [sceneReady]);

  // Hide callouts immediately on scroll down to keep "TURN AROUND" chapter clean
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const isScrolled = scrollY > 50 || motion.scroll.dark > 0.05 || motion.scroll.push > 0.05;
      if (isScrolled && visible) {
        setVisible(false);
      } else if (!isScrolled && !visible && sceneReady) {
        setVisible(true);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [motion, sceneReady, visible]);

  // Compute precise SVG arrow coordinates from card edge to pin center
  useEffect(() => {
    const updateLines = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const newLines = FEATURES.map((feat) => {
        const cardEl = containerRef.current?.querySelector(`[data-card-id="${feat.id}"]`) as HTMLElement | null;
        const pinEl = containerRef.current?.querySelector(`[data-pin-id="${feat.id}"]`) as HTMLElement | null;

        if (!cardEl || !pinEl) {
          return {
            id: feat.id,
            x1: rect.width - (feat.cardPos.right / 100) * rect.width - 148,
            y1: (feat.cardPos.top / 100) * rect.height,
            x2: (feat.pinPos.left / 100) * rect.width,
            y2: (feat.pinPos.top / 100) * rect.height,
          };
        }

        const cardRect = cardEl.getBoundingClientRect();
        const pinRect = pinEl.getBoundingClientRect();

        const pinX = pinRect.left + pinRect.width / 2 - rect.left;
        const pinY = pinRect.top + pinRect.height / 2 - rect.top;

        let cardX = 0;
        const cardY = cardRect.top + cardRect.height / 2 - rect.top;

        if (feat.cardPos.align === "left") {
          cardX = cardRect.right - rect.left;
        } else {
          cardX = cardRect.left - rect.left;
        }

        const dx = pinX - cardX;
        const dy = pinY - cardY;
        const dist = Math.hypot(dx, dy);
        const offset = Math.min(8, dist * 0.1);
        const nx = dist > 0 ? dx / dist : 0;
        const ny = dist > 0 ? dy / dist : 0;

        return {
          id: feat.id,
          x1: cardX,
          y1: cardY,
          x2: pinX - nx * offset,
          y2: pinY - ny * offset,
        };
      });

      setLines(newLines);
    };

    updateLines();
    const rafId = requestAnimationFrame(updateLines);
    const timerId = setTimeout(updateLines, 100);

    window.addEventListener("resize", updateLines);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      window.removeEventListener("resize", updateLines);
    };
  }, [visible]);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${visible ? styles.visible : styles.hidden}`}
      aria-label="Garment Architectural Features"
    >
      {/* SVG Leader Lines & Arrows */}
      <svg className={styles.arrowSvg} aria-hidden="true">
        <defs>
          <marker
            id="arrow-head"
            viewBox="0 0 8 8"
            refX="5"
            refY="4"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.2 L 6 4 L 0 6.8 z" className={styles.arrowHead} />
          </marker>
          <marker
            id="arrow-head-active"
            viewBox="0 0 8 8"
            refX="5"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 0.8 L 7 4 L 0 7.2 z"
              fill="#ffffff"
              stroke="rgba(0, 0, 0, 0.8)"
              strokeWidth="0.75"
            />
          </marker>
        </defs>
        {lines.map((line) => {
          const isActive = activeFeature === line.id;
          return (
            <g key={line.id}>
              {/* High-contrast under-shadow line for visibility over light background */}
              <line
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                className={styles.arrowShadow}
                style={{
                  opacity: isActive ? 0.85 : undefined,
                  strokeWidth: isActive ? 2.8 : undefined,
                }}
              />
              {/* Brilliant white dashed line for visibility over black t-shirt */}
              <line
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                className={styles.arrowLine}
                style={{
                  opacity: isActive ? 1 : undefined,
                  strokeWidth: isActive ? 1.3 : undefined,
                  strokeDasharray: isActive ? "none" : undefined,
                }}
                markerEnd={isActive ? "url(#arrow-head-active)" : "url(#arrow-head)"}
              />
            </g>
          );
        })}
      </svg>

      {/* Feature Callouts and Pins */}
      {FEATURES.map((feat) => {
        const isActive = activeFeature === feat.id;
        return (
          <div key={feat.id} className="contents">
            {/* Hotspot Pin on the Garment */}
            <div
              data-pin-id={feat.id}
              className={`${styles.pin} ${styles.featureItemDesktop}`}
              style={{ left: `${feat.pinPos.left}%`, top: `${feat.pinPos.top}%` }}
              onMouseEnter={() => setActiveFeature(feat.id)}
              onMouseLeave={() => setActiveFeature(null)}
              onClick={() => setActiveFeature(isActive ? null : feat.id)}
              role="button"
              tabIndex={0}
              aria-label={`Highlight ${feat.title}`}
            >
              <span className={styles.pinRing} />
            </div>

            {/* Callout Card */}
            <div
              data-card-id={feat.id}
              className={`${styles.featureItem} ${styles.featureItemDesktop} ${
                isActive ? styles.featureItemActive : ""
              }`}
              style={{ right: `${feat.cardPos.right}%`, top: `${feat.cardPos.top}%` }}
              onMouseEnter={() => setActiveFeature(feat.id)}
              onMouseLeave={() => setActiveFeature(null)}
              onClick={() => setActiveFeature(isActive ? null : feat.id)}
            >
              <div className={styles.calloutCard}>
                <div className={styles.tag}>
                  <span className={styles.tagDot} />
                  {feat.tag}
                </div>
                <h3 className={styles.title}>{feat.title}</h3>
                <p className={styles.desc}>{feat.desc}</p>
              </div>
            </div>
          </div>
        );
      })}

      {/* Interactive Texture Hint Badge */}
      <div className={styles.textureHint}>
        <span className={styles.textureHintDot} />
        <span>Hover Garment for Micro-Knit Texture</span>
      </div>
    </div>
  );
}
