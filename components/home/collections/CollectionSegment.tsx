"use client";

import { memo, useCallback, useRef, type MouseEvent, type PointerEvent, type RefObject } from "react";
import { explorerConfig } from "@/config/site";
import { formatIndex } from "@/lib/collections";
import { usePointerRollGesture } from "@/hooks/usePointerRollGesture";
import type { Collection } from "@/types/collection";
import { CollectionFilmRoll } from "./CollectionFilmRoll";
import type { CollectionCursorHandle } from "./CollectionCursor";

export type InteractionSource = "pointer" | "touch" | "keyboard";

export interface CollectionSegmentProps {
  collection: Collection;
  /** 1-based display position. */
  position: number;
  imageIndex: number;
  isActive: boolean;
  isHovered: boolean;
  loadImages: boolean;
  reducedMotion: boolean;
  /** Fine pointer with hover: enables cursor label and gesture rolls. */
  pointerMode: boolean;
  sizes: string;
  cursorRef: RefObject<CollectionCursorHandle | null>;
  isAnimating: (collectionId: string) => boolean;
  onActivate: (collectionId: string, source: InteractionSource) => void;
  onHoverChange: (collectionId: string | null) => void;
  onRequestNext: (collectionId: string, source: InteractionSource) => boolean;
  onRollComplete: (collectionId: string) => void;
}

const { copy } = explorerConfig;

/**
 * One collection frame, rendered from data. It holds no selection state:
 * the explorer decides what is active and which image is showing.
 */
export const CollectionSegment = memo(function CollectionSegment({
  collection,
  position,
  imageIndex,
  isActive,
  isHovered,
  loadImages,
  reducedMotion,
  pointerMode,
  sizes,
  cursorRef,
  isAnimating,
  onActivate,
  onHoverChange,
  onRequestNext,
  onRollComplete,
}: CollectionSegmentProps) {
  const { id, name, images } = collection;
  const count = images.length;
  const lastPointerType = useRef<string>("mouse");

  const busy = useCallback(() => isAnimating(id), [isAnimating, id]);
  const requestNextFromGesture = useCallback(() => {
    onRequestNext(id, "pointer");
  }, [onRequestNext, id]);
  const setProgress = useCallback((p: number) => cursorRef.current?.setProgress(p), [cursorRef]);
  const handleRollComplete = useCallback(() => onRollComplete(id), [onRollComplete, id]);

  const gesture = usePointerRollGesture({
    enabled: pointerMode && count > 1,
    isBusy: busy,
    onThreshold: requestNextFromGesture,
    onProgress: setProgress,
  });

  const handlePointerEnter = (event: PointerEvent<HTMLButtonElement>) => {
    lastPointerType.current = event.pointerType;
    if (!pointerMode || event.pointerType !== "mouse") return;
    gesture.onPointerEnter(event);
    cursorRef.current?.move(event.clientX, event.clientY);
    cursorRef.current?.show();
    onHoverChange(id);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!pointerMode || event.pointerType !== "mouse") return;
    cursorRef.current?.move(event.clientX, event.clientY);
    gesture.onPointerMove(event);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse") return;
    gesture.onPointerLeave();
    cursorRef.current?.hide();
    onHoverChange(null);
  };

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // Enter / Space produce a click with detail 0: activate only.
    if (event.detail === 0) return onActivate(id, "keyboard");
    if (lastPointerType.current === "touch" || lastPointerType.current === "pen") {
      // Tap: first make the collection active, then each tap rolls.
      return isActive ? void onRequestNext(id, "touch") : onActivate(id, "touch");
    }
    onRequestNext(id, "pointer");
  };

  const handleNextButton = () => {
    onRequestNext(id, "keyboard");
  };

  const shown = count ? (imageIndex % count) + 1 : 0;

  return (
    <li
      className="collection-segment"
      data-collection-id={id}
      data-active={isActive || undefined}
      data-hovered={isHovered || undefined}
    >
      {position > 1 ? <span aria-hidden="true" data-anim="explorer-separator" className="collection-segment__rule" /> : null}
      <div data-anim="explorer-segment" className="collection-segment__inner">
        <div className="collection-segment__label">
          <span className="collection-segment__index">{formatIndex(position)}</span>
          <span className="collection-segment__name">{name}</span>
          <button
            type="button"
            className="collection-segment__counter"
            onClick={handleNextButton}
            disabled={count < 2}
            aria-label={count ? `${copy.nextImage}: ${name}, showing ${shown} of ${count}` : `${name}: ${copy.missingImage}`}
          >
            {count ? `${formatIndex(shown)}/${formatIndex(count)}` : "—"}
          </button>
        </div>

        <div className="collection-segment__frame">
          <CollectionFilmRoll
            images={images}
            activeIndex={imageIndex}
            sizes={sizes}
            loadImages={loadImages}
            reducedMotion={reducedMotion}
            onRollComplete={handleRollComplete}
          />
          <button
            type="button"
            className="collection-segment__surface"
            data-pointer-mode={pointerMode || undefined}
            aria-pressed={isActive}
            aria-label={`${name} collection`}
            onPointerDown={(event) => {
              lastPointerType.current = event.pointerType;
            }}
            onPointerEnter={handlePointerEnter}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onClick={handleClick}
          />
        </div>
      </div>
    </li>
  );
});
