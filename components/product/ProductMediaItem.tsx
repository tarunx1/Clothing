"use client";

import Image from "@/components/ui/StoreImage";
import { useState, useRef, useCallback } from "react";
import type { ProductImage } from "@/types/product";
import styles from "./product.module.css";

/**
 * Product media frame with interactive smooth texture zoom.
 * Moving the mouse over the garment zooms in (2.2x) to reveal
 * fine fabric weave, print details, and embroidery textures.
 */
export function ProductMediaItem({
  image,
  index,
  sizes,
  priority = false,
  eager = false,
  label,
}: {
  image: ProductImage;
  index: number;
  sizes: string;
  priority?: boolean;
  eager?: boolean;
  label?: string;
}) {
  const [status, setStatus] = useState<"pending" | "done" | "failed">(priority ? "done" : "pending");
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const figureRef = useRef<HTMLElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (!figureRef.current) return;
    const rect = figureRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  }, []);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setMousePos({ x: 50, y: 50 });
  }, []);

  return (
    <figure
      ref={figureRef}
      className={styles.media}
      data-media-index={index}
      data-reveal={status === "failed" ? undefined : status}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {status === "failed" ? (
        <span className={styles.mediaMissing}>Image unavailable</span>
      ) : (
        <div
          className={styles.zoomContainer}
          style={{
            transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
            transform: isHovered ? "scale(2.25)" : "scale(1)",
            transition: isHovered
              ? "transform 0.15s cubic-bezier(0.2, 0, 0.2, 1)"
              : "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
          }}
        >
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes={sizes}
            preload={priority}
            loading={priority || eager ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            className={styles.zoomImage}
            onLoad={() => setStatus("done")}
            onError={() => setStatus("failed")}
          />
        </div>
      )}

      {/* Texture Zoom Lens Badge */}
      <div className={`${styles.zoomBadge} ${isHovered ? styles.zoomBadgeActive : ""}`} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
          <path d="M11 8v6M8 11h6" />
        </svg>
        <span>TEXTURE ZOOM 2.2×</span>
      </div>

      {label ? <figcaption className={styles.mediaCaption}>{label}</figcaption> : null}
    </figure>
  );
}
