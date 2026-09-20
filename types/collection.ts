/**
 * Collection model for the landing-page Collection Explorer.
 * Shaped for a future admin panel: every visible piece of the explorer is
 * derived from these records (names, copy, order, visibility, imagery).
 */
export interface CollectionImage {
  id: string;
  /** Local path under /public or, later, a CDN URL. */
  src: string;
  alt: string;
  order: number;
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  images: CollectionImage[];
  order: number;
  enabled: boolean;
  featured?: boolean;
}
