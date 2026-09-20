import type { Collection } from "@/types/collection";

/** Enabled collections in display order, each with images in their own order. */
export function getVisibleCollections(source: readonly Collection[]): Collection[] {
  return source
    .filter((collection) => collection.enabled)
    .sort((a, b) => a.order - b.order)
    .map((collection) => ({
      ...collection,
      images: [...collection.images].sort((a, b) => a.order - b.order),
    }));
}

/**
 * Homepage explorer set: enabled + featured collections in admin order, capped
 * at the layout's capacity. If nothing is featured, the first enabled ones show
 * so the hero never loses its explorer.
 */
export function getHomepageCollections(source: readonly Collection[], max: number): Collection[] {
  const visible = getVisibleCollections(source);
  const featured = visible.filter((collection) => collection.featured);
  return (featured.length ? featured : visible).slice(0, max);
}

/** The middle collection opens the film sequence (index 2 of 5). */
export function getCenterCollectionId(visible: readonly Collection[]): string | null {
  if (visible.length === 0) return null;
  return visible[Math.floor((visible.length - 1) / 2)].id;
}

/** Future detail route. The page itself is not built in this phase. */
export const collectionHref = (slug: string) => `/collection/${slug}`;

export const formatIndex = (value: number) => String(value).padStart(2, "0");
