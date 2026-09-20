import "server-only";
import type { AdminActor } from "@/lib/admin/authorization";
import { recordAudit } from "@/lib/admin/audit";
import { AdminError } from "@/lib/admin/errors";
import { invalidateStorefront, storefrontTargets } from "@/lib/admin/revalidate";
import { assertSameSet, deleteIfUnreferenced, orderedIdsSchema } from "@/lib/admin/services/shared";
import { collectionFormSchema, mediaItemSchema } from "@/lib/admin/validation";
import { explorerConfig } from "@/config/site";
import { prisma } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/transaction";
import { isAcceptableMediaUrl } from "@/lib/storage";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

const MAX_FEATURED = explorerConfig.maxCollections;

export async function listCollectionsForAdmin() {
  const records = await prisma.collection.findMany({
    orderBy: { order: "asc" },
    include: { images: { orderBy: { order: "asc" }, take: 1 }, _count: { select: { products: true, images: true } } },
  });
  return records.map((collection) => ({
    id: collection.id,
    name: collection.name,
    slug: collection.slug,
    enabled: collection.enabled,
    featured: collection.featured,
    order: collection.order,
    productCount: collection._count.products,
    imageCount: collection._count.images,
    cover: collection.images[0] ? { src: collection.images[0].src, alt: collection.images[0].alt } : null,
    updatedAt: collection.updatedAt,
  }));
}

export const getCollectionEditor = (id: string) =>
  prisma.collection.findUnique({ where: { id }, include: { images: { orderBy: { order: "asc" } }, _count: { select: { products: true } } } });

async function assertFeaturedCapacity(tx: Prisma.TransactionClient, exceptId?: string) {
  const featured = await tx.collection.count({ where: { featured: true, ...(exceptId ? { id: { not: exceptId } } : {}) } });
  if (featured >= MAX_FEATURED) {
    throw new AdminError("INVALID_STATE", `Only ${MAX_FEATURED} collections can be featured on the homepage. Unfeature one first.`, "featured");
  }
}

async function assertSlugFree(tx: Prisma.TransactionClient, slug: string, exceptId?: string) {
  const other = await tx.collection.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (other && other.id !== exceptId) throw new AdminError("CONFLICT", `Slug is already used by “${other.name}”.`, "slug");
}

export async function createCollection(actor: AdminActor, values: unknown) {
  const input = collectionFormSchema.parse(values);
  const collection = await withSerializableRetry(async (tx) => {
    await assertSlugFree(tx, input.slug);
    if (input.featured) await assertFeaturedCapacity(tx);
    const last = await tx.collection.aggregate({ _max: { order: true } });
    const created = await tx.collection.create({ data: { ...input, order: (last._max.order ?? 0) + 1 } });
    await recordAudit(tx, actor, "COLLECTION_CREATED", "collection", created.id, { name: created.name, slug: created.slug });
    return created;
  });
  invalidateStorefront(storefrontTargets.collections());
  return { id: collection.id };
}

export async function updateCollection(actor: AdminActor, id: string, values: unknown) {
  const input = collectionFormSchema.parse(values);
  await withSerializableRetry(async (tx) => {
    const existing = await tx.collection.findUnique({ where: { id } });
    if (!existing) throw new AdminError("NOT_FOUND", "This collection no longer exists.");
    await assertSlugFree(tx, input.slug, id);
    if (input.featured && !existing.featured) await assertFeaturedCapacity(tx, id);
    await tx.collection.update({ where: { id }, data: input });
    const changed = (Object.keys(input) as (keyof typeof input)[]).filter((key) => input[key] !== existing[key]);
    await recordAudit(tx, actor, "COLLECTION_UPDATED", "collection", id, { changed });
  });
  invalidateStorefront(storefrontTargets.collections());
}

/** Quick toggles from the collections list (optimistic in the UI, confirmed here). */
export async function setCollectionFlags(actor: AdminActor, id: string, flags: unknown) {
  const input = z.object({ enabled: z.boolean().optional(), featured: z.boolean().optional() }).parse(flags);
  const result = await withSerializableRetry(async (tx) => {
    const existing = await tx.collection.findUnique({ where: { id } });
    if (!existing) throw new AdminError("NOT_FOUND", "This collection no longer exists.");
    if (input.featured && !existing.featured) await assertFeaturedCapacity(tx, id);
    const updated = await tx.collection.update({ where: { id }, data: input });
    await recordAudit(tx, actor, "COLLECTION_UPDATED", "collection", id, { changed: Object.keys(input), ...input });
    return { enabled: updated.enabled, featured: updated.featured };
  });
  invalidateStorefront(storefrontTargets.collections());
  return result;
}

/** Collections with products cannot be deleted (products need a collection); disable instead. */
export async function deleteCollection(actor: AdminActor, id: string) {
  const collection = await prisma.collection.findUnique({ where: { id }, include: { images: true, _count: { select: { products: true } } } });
  if (!collection) throw new AdminError("NOT_FOUND", "This collection no longer exists.");
  if (collection._count.products > 0) {
    throw new AdminError("INVALID_STATE", `“${collection.name}” still has ${collection._count.products} product${collection._count.products === 1 ? "" : "s"}. Move them to another collection or disable the collection instead.`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.collection.delete({ where: { id } });
    await recordAudit(tx, actor, "COLLECTION_DELETED", "collection", id, { name: collection.name, slug: collection.slug });
  });
  for (const image of collection.images) await deleteIfUnreferenced(image.src);
  invalidateStorefront(storefrontTargets.collections());
}

/** The order here drives the homepage explorer and shop filters. */
export async function reorderCollections(actor: AdminActor, orderedIds: unknown) {
  const ids = orderedIdsSchema.parse(orderedIds);
  await prisma.$transaction(async (tx) => {
    const all = await tx.collection.findMany({ select: { id: true } });
    assertSameSet(all.map((collection) => collection.id), ids);
    for (const [index, id] of ids.entries()) await tx.collection.update({ where: { id }, data: { order: index + 1 } });
    await recordAudit(tx, actor, "COLLECTIONS_REORDERED", "collection", null, { order: ids });
  });
  invalidateStorefront(storefrontTargets.collections());
}

// ---------- Reel images ----------

export async function addCollectionImages(actor: AdminActor, collectionId: string, items: unknown) {
  const list = mediaItemSchema.array().min(1).max(20).parse(items);
  for (const item of list) if (!(await isAcceptableMediaUrl(item.url))) throw new AdminError("VALIDATION", "One of the images is not an uploaded file.");
  const created = await prisma.$transaction(async (tx) => {
    const max = await tx.collectionImage.aggregate({ where: { collectionId }, _max: { order: true } });
    const start = (max._max.order ?? 0) + 1;
    const rows = [];
    for (const [index, item] of list.entries()) {
      rows.push(await tx.collectionImage.create({ data: { collectionId, src: item.url, alt: item.alt || "Collection image", order: start + index } }));
    }
    await recordAudit(tx, actor, "COLLECTION_MEDIA_UPDATED", "collection", collectionId, { added: rows.length });
    return rows;
  });
  invalidateStorefront(storefrontTargets.collections());
  return created.map((image) => ({ id: image.id, src: image.src, alt: image.alt, order: image.order }));
}

export async function updateCollectionImage(actor: AdminActor, imageId: string, values: unknown) {
  const { alt } = z.object({ alt: z.string().trim().min(1, "Describe the image").max(200) }).parse(values);
  await prisma.$transaction(async (tx) => {
    const image = await tx.collectionImage.update({ where: { id: imageId }, data: { alt } });
    await recordAudit(tx, actor, "COLLECTION_MEDIA_UPDATED", "collection", image.collectionId, { updated: imageId });
  });
  invalidateStorefront(storefrontTargets.collections());
}

export async function removeCollectionImage(actor: AdminActor, imageId: string) {
  const image = await prisma.collectionImage.findUnique({ where: { id: imageId } });
  if (!image) return;
  await prisma.$transaction(async (tx) => {
    await tx.collectionImage.delete({ where: { id: imageId } });
    await recordAudit(tx, actor, "COLLECTION_MEDIA_UPDATED", "collection", image.collectionId, { removed: imageId });
  });
  await deleteIfUnreferenced(image.src);
  invalidateStorefront(storefrontTargets.collections());
}

export async function reorderCollectionImages(actor: AdminActor, collectionId: string, orderedIds: unknown) {
  const ids = orderedIdsSchema.parse(orderedIds);
  await prisma.$transaction(async (tx) => {
    const images = await tx.collectionImage.findMany({ where: { collectionId }, select: { id: true } });
    assertSameSet(images.map((image) => image.id), ids);
    for (const [index, id] of ids.entries()) await tx.collectionImage.update({ where: { id }, data: { order: -(index + 1) } });
    for (const [index, id] of ids.entries()) await tx.collectionImage.update({ where: { id }, data: { order: index + 1 } });
    await recordAudit(tx, actor, "COLLECTION_MEDIA_UPDATED", "collection", collectionId, { reordered: ids.length });
  });
  invalidateStorefront(storefrontTargets.collections());
}
