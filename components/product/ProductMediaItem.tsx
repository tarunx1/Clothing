"use client";

import Image from "@/components/ui/StoreImage";
import { useState } from "react";
import type { ProductImage } from "@/types/product";
import styles from "./product.module.css";

/**
 * One gallery frame in a fixed aspect-ratio box (no layout shift). The first
 * image preloads and shows immediately (LCP); later ones lazy-load and fade in.
 * Close-ups crop the same photograph around a focal point.
 */
export function ProductMediaItem({ image, index, sizes, priority = false, eager = false, label }: { image: ProductImage; index: number; sizes: string; priority?: boolean; eager?: boolean; label?: string }) {
  const [status, setStatus] = useState<"pending" | "done" | "failed">(priority ? "done" : "pending");
  const focus = image.focalPoint ? `${image.focalPoint.x * 100}% ${image.focalPoint.y * 100}%` : "50% 30%";
  const zoom = image.zoom && image.zoom > 1 ? image.zoom : 1;

  return (
    <figure className={styles.media} data-media-index={index} data-reveal={status === "failed" ? undefined : status} data-zoomed={zoom > 1 || undefined}>
      {status === "failed" ? (
        <span className={styles.mediaMissing}>Image unavailable</span>
      ) : (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes={sizes}
          preload={priority}
          // Crops that reuse the hero's file load eagerly too (the file is already fetched).
          loading={priority || eager ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          style={{ objectPosition: focus, transform: zoom > 1 ? `scale(${zoom})` : undefined, transformOrigin: focus }}
          onLoad={() => setStatus("done")}
          onError={() => setStatus("failed")}
        />
      )}
      {label ? <figcaption className={styles.mediaCaption}>{label}</figcaption> : null}
    </figure>
  );
}
