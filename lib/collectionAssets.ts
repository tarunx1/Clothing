import { existsSync } from "node:fs";
import path from "node:path";
import type { Collection } from "@/types/collection";

/**
 * Server-only: removes local images whose files do not exist, so a missing
 * placeholder never produces a broken frame or a 404 request. Remote URLs
 * (a future CDN) are passed through and handled by the client error state.
 */
export function withAvailableImages(collections: Collection[]): Collection[] {
  return collections.map((collection) => ({
    ...collection,
    images: collection.images.filter((image) => {
      if (!image.src.startsWith("/images/")) return true;
      // Statically scoped to public/images so the build only traces that folder.
      return existsSync(path.join(process.cwd(), "public/images", image.src.slice("/images/".length)));
    }),
  }));
}
