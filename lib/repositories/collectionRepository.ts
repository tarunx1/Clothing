import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Collection } from "@/types/collection";

export async function findVisibleCollections(): Promise<Collection[]> {
  const records = await prisma.collection.findMany({
    where: { enabled: true },
    include: { images: { orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });
  return records.map((record) => ({
    id: record.slug,
    slug: record.slug,
    name: record.name,
    shortDescription: record.shortDescription,
    description: record.description,
    order: record.order,
    enabled: record.enabled,
    featured: record.featured,
    images: record.images.map((image) => ({ id: image.id, src: image.src, alt: image.alt, order: image.order })),
  }));
}
