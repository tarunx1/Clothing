import { existsSync } from "node:fs";
import path from "node:path";
import type { Product } from "@/types/product";

/*
 * Server-only asset checks, so a missing image or 3D file never renders a
 * broken frame or triggers a 404. Remote URLs (a future CDN) pass through;
 * the client error state covers those.
 */
const exists = (src: string, folder: "images" | "models") => {
  if (!src.startsWith(`/${folder}/`)) return true;
  // Statically scoped folders keep build tracing small.
  return folder === "images"
    ? existsSync(path.join(process.cwd(), "public/images", src.slice("/images/".length)))
    : existsSync(path.join(process.cwd(), "public/models", src.slice("/models/".length)));
};

/** The product with unavailable media removed and `model3d` cleared when its file is missing. */
export function withAvailableMedia(product: Product): Product {
  return {
    ...product,
    images: product.images.filter((image) => exists(image.src, "images")),
    model3d: product.model3d && exists(product.model3d.glb, "models") ? product.model3d : undefined,
  };
}
