import "server-only";
import { z } from "zod";
import { AdminError } from "@/lib/admin/errors";
import { prisma } from "@/lib/db/prisma";
import { deleteStoredUrl } from "@/lib/storage";

export const orderedIdsSchema = z.array(z.string().uuid()).min(1).max(200);

export function assertSameSet(current: string[], proposed: string[]) {
  if (current.length !== proposed.length || new Set(proposed).size !== proposed.length || !current.every((id) => proposed.includes(id))) {
    throw new AdminError("CONFLICT", "The list changed while you were editing. Refresh and try again.");
  }
}

/** Removes an uploaded file once nothing in the catalog or content points at it. */
export async function deleteIfUnreferenced(src: string) {
  const [products, collections, lookbook, models] = await Promise.all([
    prisma.productImage.count({ where: { src } }),
    prisma.collectionImage.count({ where: { src } }),
    prisma.lookbookImage.count({ where: { src } }),
    prisma.product.count({ where: { model3dUrl: src } }),
  ]);
  if (products + collections + lookbook + models === 0) await deleteStoredUrl(src);
}
