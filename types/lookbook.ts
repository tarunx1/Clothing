/** Temporary seed records; compatible with a future CMS collection. */
export interface LookbookImage {
  id: string;
  src: string;
  alt: string;
  lane: 1 | 2 | 3;
  order: number;
  position?: string;
  credit?: { photographer: string; url: string };
}
