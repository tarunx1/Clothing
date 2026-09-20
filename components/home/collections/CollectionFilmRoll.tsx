"use client";

import Image from "@/components/ui/StoreImage";
import { memo, useEffect, useLayoutEffect, useRef, useState, type Ref } from "react";
import { explorerConfig } from "@/config/site";
import { gsap } from "@/lib/gsap";
import type { CollectionImage } from "@/types/collection";

export interface CollectionFilmRollProps {
  images: readonly CollectionImage[];
  /** Frame to show. Changing it rolls the strip forward to that frame. */
  activeIndex: number;
  onRollComplete?: () => void;
  /** `sizes` for next/image, matching the rendered frame width. */
  sizes: string;
  /** Defer network requests until the scene approaches. */
  loadImages?: boolean;
  reducedMotion?: boolean;
}

const { roll, copy } = explorerConfig;

/**
 * A vertical strip of two frames: the current frame and the next one parked
 * directly beneath it (already requested and decoded). A roll translates the
 * whole strip by exactly one frame height, so both frames move as one piece
 * of film: no gap, no seam, no crossfade. When the roll lands, React moves the
 * incoming frame into the resting slot and the strip resets in the same
 * commit, before paint.
 *
 * The component knows nothing about collections, only images and motion.
 */
export const CollectionFilmRoll = memo(function CollectionFilmRoll({
  images,
  activeIndex,
  onRollComplete,
  sizes,
  loadImages = true,
  reducedMotion = false,
}: CollectionFilmRollProps) {
  const count = images.length;
  const target = count ? ((activeIndex % count) + count) % count : 0;
  const [restIndex, setRestIndex] = useState(target);
  const stripRef = useRef<HTMLDivElement>(null);
  const incomingRef = useRef<HTMLDivElement>(null);
  const settledIndex = useRef(restIndex);

  const rest = count ? Math.min(restIndex, count - 1) : 0;
  const rolling = count > 1 && target !== rest;
  const current = images[rest];
  const next = count > 1 ? images[rolling ? target : (rest + 1) % count] : null;

  useLayoutEffect(() => {
    if (!rolling) return;
    const strip = stripRef.current;
    const incoming = incomingRef.current;
    const ctx = gsap.context(() => undefined);
    let cancelled = false;
    const finish = () => setRestIndex(target);

    const start = () =>
      ctx.add(() => {
        if (!strip || !incoming || !loadImages) {
          gsap.delayedCall(0, finish);
        } else if (reducedMotion) {
          gsap.fromTo(
            incoming,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: roll.reducedMotionFade, ease: "power1.inOut", onComplete: finish },
          );
        } else {
          gsap.set(strip, { willChange: "transform" });
          gsap.fromTo(
            strip,
            { yPercent: 0 },
            { yPercent: -100, duration: roll.duration, ease: roll.ease, force3D: true, onComplete: finish },
          );
        }
      });

    // Never roll a black frame into view: wait briefly for the decode.
    const img = incoming?.querySelector("img");
    const decoded =
      img && !img.complete
        ? Promise.race([img.decode().catch(() => undefined), new Promise((r) => setTimeout(r, roll.decodeTimeoutMs))])
        : Promise.resolve();
    decoded.then(() => {
      if (!cancelled) start();
    });

    return () => {
      cancelled = true;
      // Reverting resets the strip to 0 in the same commit that re-slots the frames.
      ctx.revert();
    };
  }, [rolling, target, loadImages, reducedMotion]);

  useEffect(() => {
    if (settledIndex.current === restIndex) return;
    settledIndex.current = restIndex;
    onRollComplete?.();
  }, [restIndex, onRollComplete]);

  if (!current) {
    return (
      <div className="film-roll">
        <div className="film-frame film-frame--empty">
          <span>{copy.missingImage}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="film-roll">
      <div ref={stripRef} className="film-strip">
        <FilmFrame key={current.id} image={current} slot="current" sizes={sizes} load={loadImages} />
        {next ? (
          <FilmFrame
            key={next.id}
            ref={incomingRef}
            image={next}
            slot="next"
            sizes={sizes}
            load={loadImages}
            reducedMotion={reducedMotion}
          />
        ) : null}
      </div>
    </div>
  );
});

interface FilmFrameProps {
  image: CollectionImage;
  slot: "current" | "next";
  sizes: string;
  load: boolean;
  reducedMotion?: boolean;
  ref?: Ref<HTMLDivElement>;
}

function FilmFrame({ image, slot, sizes, load, reducedMotion = false, ref }: FilmFrameProps) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      ref={ref}
      className="film-frame"
      data-slot={slot}
      data-transition={reducedMotion ? "fade" : "roll"}
      aria-hidden={slot === "next" ? true : undefined}
    >
      {load && !failed ? (
        <Image
          src={image.src}
          alt={slot === "current" ? image.alt : ""}
          fill
          sizes={sizes}
          loading="eager"
          fetchPriority={slot === "current" ? "auto" : "low"}
          decoding="async"
          draggable={false}
          className="film-frame__image"
          onError={() => setFailed(true)}
        />
      ) : null}
      {failed ? <span className="film-frame__missing">{copy.missingImage}</span> : null}
    </div>
  );
}
