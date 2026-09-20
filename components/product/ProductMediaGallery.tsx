"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ProductImage } from "@/types/product";
import { ProductMediaItem } from "./ProductMediaItem";
import styles from "./product.module.css";

type Entry = { kind: "image"; image: ProductImage; index: number } | { kind: "model" };
type Group = { kind: "full"; entry: Entry } | { kind: "pair"; entries: [Entry, Entry] };

const FULL = "(max-width: 767px) 100vw, (max-width: 1023px) 55vw, 60vw";
const PAIR = "(max-width: 767px) 100vw, (max-width: 1023px) 55vw, 30vw";
const scaled = (sizes: string, zoom = 1) => (zoom > 1 ? sizes.replace(/(\d+)vw/g, (_, n) => `${Math.round(Number(n) * zoom)}vw`) : sizes);

/** Editorial rhythm: one large frame, then alternating pairs and full frames; 3D is always full. */
function layout(entries: Entry[]): Group[] {
  const groups: Group[] = [];
  for (let i = 0; i < entries.length; ) {
    const entry = entries[i];
    const next = entries[i + 1];
    const wantsPair = groups.length % 2 === 1;
    if (wantsPair && entry.kind === "image" && next?.kind === "image") {
      groups.push({ kind: "pair", entries: [entry, next] });
      i += 2;
    } else {
      groups.push({ kind: "full", entry });
      i += 1;
    }
  }
  return groups;
}

interface ProductMediaGalleryProps {
  images: ProductImage[];
  productName: string;
  /** Rendered as one full-width item when provided (desktop/tablet). */
  modelView?: ReactNode;
}

/**
 * Desktop/tablet: stacked large imagery. Phones: the same DOM becomes a
 * native scroll-snap strip with a position indicator (CSS only, no carousel JS).
 */
export function ProductMediaGallery({ images, productName, modelView }: ProductMediaGalleryProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const entries: Entry[] = images.map((image, index) => ({ kind: "image", image, index }));
  if (modelView) entries.splice(Math.min(3, entries.length), 0, { kind: "model" });
  const groups = layout(entries);

  // Phones: track which frame is predominantly visible for the indicator.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const frames = Array.from(track.querySelectorAll<HTMLElement>("[data-media-index]"));
    const observer = new IntersectionObserver(
      (items) => {
        for (const item of items) {
          if (item.isIntersecting && item.intersectionRatio > 0.6) setActive(Number((item.target as HTMLElement).dataset.mediaIndex));
        }
      },
      { root: track, threshold: [0.6] },
    );
    frames.forEach((frame) => observer.observe(frame));
    return () => observer.disconnect();
  }, [images]);

  const render = (entry: Entry, sizes: string) =>
    entry.kind === "model" ? (
      <div key="model" data-desktop-only>{modelView}</div>
    ) : (
      <ProductMediaItem
        key={entry.image.id}
        index={entry.index}
        image={entry.image}
        sizes={scaled(sizes, entry.image.zoom)}
        priority={entry.index === 0}
        eager={entry.index !== 0 && entry.image.src === images[0]?.src}
      />
    );

  if (!images.length && !modelView) {
    return (
      <div className={styles.gallery}>
        <figure className={styles.media}><span className={styles.mediaMissing}>Imagery coming soon</span></figure>
      </div>
    );
  }

  return (
    <section className={styles.gallery} aria-label={`${productName} imagery`}>
      <div ref={trackRef} className={styles.galleryTrack}>
        {groups.map((group, i) =>
          group.kind === "full" ? (
            render(group.entry, FULL)
          ) : (
            <div key={`pair-${i}`} className={styles.pair}>
              {group.entries.map((entry) => render(entry, PAIR))}
            </div>
          ),
        )}
      </div>
      {images.length > 1 ? (
        <div className={styles.indicator} aria-hidden="true">
          <span>{String(active + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}</span>
          <span className={styles.indicatorTrack}>
            <span className={styles.indicatorFill} style={{ width: `${100 / images.length}%`, transform: `translateX(${active * 100}%)` }} />
          </span>
        </div>
      ) : null}
    </section>
  );
}
