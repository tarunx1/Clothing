import "server-only";
import { Prisma, type ProductImageType } from "@prisma/client";
import type { AdminActor } from "@/lib/admin/authorization";
import { recordAudit } from "@/lib/admin/audit";
import { AdminError } from "@/lib/admin/errors";
import type { ListParams } from "@/lib/admin/listParams";
import { invalidateStorefront, storefrontTargets } from "@/lib/admin/revalidate";
import {
  colorFormSchema,
  linesToList,
  mediaItemSchema,
  productFormSchema,
  productImageUpdateSchema,
  SKU_PATTERN,
  toMinorUnits,
  variantMatrixSchema,
} from "@/lib/admin/validation";
import { prisma } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/transaction";
import { isAcceptableMediaUrl } from "@/lib/storage";
import { assertSameSet, deleteIfUnreferenced, orderedIdsSchema } from "@/lib/admin/services/shared";
import { emitStoreEvent } from "@/lib/webhooks/dispatcher";

export const PRODUCT_SORTS = ["newest", "oldest", "name", "price-asc", "price-desc"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

const productOrder: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }],
  oldest: [{ createdAt: "asc" }],
  name: [{ name: "asc" }],
  "price-asc": [{ basePrice: "asc" }, { name: "asc" }],
  "price-desc": [{ basePrice: "desc" }, { name: "asc" }],
};

/** Product ids by total available stock (enabled variants only). */
async function productIdsByStock(status: string, threshold: number): Promise<string[] | null> {
  const having =
    status === "out" ? Prisma.sql`<= 0`
      : status === "low" ? Prisma.sql`BETWEEN 1 AND ${threshold}`
        : status === "in" ? Prisma.sql`> ${threshold}`
          : null;
  if (!having) return null;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id FROM products p
    LEFT JOIN product_variants v ON v.product_id = p.id AND v.enabled
    LEFT JOIN inventory i ON i.variant_id = v.id
    GROUP BY p.id
    HAVING COALESCE(SUM(GREATEST(i.quantity - i.reserved_quantity, 0)), 0) ${having}`;
  return rows.map((row) => row.id);
}

export async function listProducts(params: ListParams<ProductSort>, lowStockThreshold: number) {
  const { search, filters } = params;
  const where: Prisma.ProductWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
      { variants: { some: { sku: { contains: search, mode: "insensitive" } } } },
    ];
  }
  if (filters.collection) where.collection = { slug: filters.collection };
  if (filters.status === "enabled") where.enabled = true;
  if (filters.status === "disabled") where.enabled = false;
  if (filters.featured === "yes") where.featured = true;
  const stockIds = filters.stock ? await productIdsByStock(filters.stock, lowStockThreshold) : null;
  if (stockIds) where.id = { in: stockIds };

  const [total, records] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: productOrder[params.sort],
      skip: params.skip,
      take: params.limit,
      include: {
        collection: { select: { name: true } },
        images: { orderBy: { order: "asc" }, take: 1, select: { src: true, alt: true } },
        variants: { select: { enabled: true, inventory: { select: { quantity: true, reservedQuantity: true } } } },
      },
    }),
  ]);
  const rows = records.map((product) => {
    const enabledVariants = product.variants.filter((variant) => variant.enabled);
    const available = enabledVariants.reduce((sum, variant) => sum + Math.max(0, (variant.inventory?.quantity ?? 0) - (variant.inventory?.reservedQuantity ?? 0)), 0);
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      collection: product.collection.name,
      enabled: product.enabled,
      featured: product.featured,
      price: Number(product.basePrice) / 100,
      currency: product.currency,
      variantCount: product.variants.length,
      enabledVariantCount: enabledVariants.length,
      available,
      stockStatus: available <= 0 ? ("out" as const) : available <= lowStockThreshold ? ("low" as const) : ("in" as const),
      image: product.images[0] ?? null,
      updatedAt: product.updatedAt,
    };
  });
  return { rows, total };
}

export async function getProductEditor(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { order: "asc" } },
      variants: { include: { inventory: true }, orderBy: [{ color: { name: "asc" } }, { size: { order: "asc" } }] },
      _count: { select: { orderItems: true } },
    },
  });
  return product;
}

export const getCatalogOptions = async () => {
  const [collections, colors, sizes] = await Promise.all([
    prisma.collection.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, slug: true, enabled: true } }),
    prisma.color.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, hex: true, enabled: true } }),
    prisma.size.findMany({ orderBy: { order: "asc" }, select: { id: true, name: true, slug: true, enabled: true } }),
  ]);
  return { collections, colors, sizes };
};

function productData(input: ReturnType<typeof productFormSchema.parse>) {
  return {
    name: input.name,
    slug: input.slug,
    subtitle: input.subtitle || null,
    description: input.description,
    details: input.details || null,
    collectionId: input.collectionId,
    basePrice: toMinorUnits(input.basePrice),
    currency: input.currency,
    material: input.material || null,
    gsm: input.gsm ? Number(input.gsm) : null,
    fit: input.fit || null,
    fitAdvice: input.fitAdvice || null,
    fitNotes: linesToList(input.fitNotes),
    print: input.print || null,
    care: linesToList(input.care),
    model3dUrl: input.model3dUrl || null,
    featured: input.featured,
    enabled: input.enabled,
  };
}

async function assertSlugAvailable(slug: string, exceptId?: string) {
  const other = await prisma.product.findUnique({ where: { slug }, select: { id: true, name: true } });
  if (other && other.id !== exceptId) throw new AdminError("CONFLICT", `Slug is already used by “${other.name}”.`, "slug");
}

export async function isProductSlugAvailable(slug: string, exceptId?: string) {
  const other = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
  return !other || other.id === exceptId;
}

export async function createProduct(actor: AdminActor, values: unknown) {
  const input = productFormSchema.parse(values);
  await assertSlugAvailable(input.slug);
  const product = await prisma.$transaction(async (tx) => {
    const last = await tx.product.aggregate({ _max: { releaseOrder: true } });
    const created = await tx.product.create({ data: { ...productData(input), releaseOrder: (last._max.releaseOrder ?? 0) + 1 } });
    await recordAudit(tx, actor, "PRODUCT_CREATED", "product", created.id, { name: created.name, slug: created.slug });
    return created;
  });
  invalidateStorefront(storefrontTargets.product(product.slug));
  return { id: product.id, slug: product.slug };
}

export async function updateProduct(actor: AdminActor, id: string, values: unknown) {
  const input = productFormSchema.parse(values);
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AdminError("NOT_FOUND", "This product no longer exists.");
  await assertSlugAvailable(input.slug, id);
  const data = productData(input);
  const changed = (Object.keys(data) as (keyof typeof data)[]).filter((key) => JSON.stringify(data[key], (_k, v) => (typeof v === "bigint" ? v.toString() : v)) !== JSON.stringify(existing[key], (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data });
    await recordAudit(tx, actor, "PRODUCT_UPDATED", "product", id, { changed });
  });
  invalidateStorefront(storefrontTargets.product(input.slug, existing.slug));
  await emitStoreEvent("PRODUCT_UPDATED", { slug: input.slug, changed });
  return { id, slug: input.slug, changed };
}

export async function setProductEnabled(actor: AdminActor, id: string, enabled: boolean) {
  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id }, data: { enabled } });
    await recordAudit(tx, actor, "PRODUCT_UPDATED", "product", id, { changed: ["enabled"], enabled });
    return updated;
  });
  invalidateStorefront(storefrontTargets.product(product.slug));
  return { enabled: product.enabled };
}

/** Products that appear in orders keep their history: they can only be disabled. */
export async function deleteProduct(actor: AdminActor, id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: { images: true, _count: { select: { orderItems: true } } } });
  if (!product) throw new AdminError("NOT_FOUND", "This product no longer exists.");
  if (product._count.orderItems > 0) {
    throw new AdminError("INVALID_STATE", `“${product.name}” appears in ${product._count.orderItems} order line${product._count.orderItems === 1 ? "" : "s"}. Disable it instead to keep order history intact.`);
  }
  await prisma.$transaction(async (tx) => {
    await tx.cartItem.deleteMany({ where: { variant: { productId: id } } });
    await tx.product.delete({ where: { id } });
    await recordAudit(tx, actor, "PRODUCT_DELETED", "product", id, { name: product.name, slug: product.slug });
  });
  for (const image of product.images) await deleteIfUnreferenced(image.src);
  if (product.model3dUrl) await deleteIfUnreferenced(product.model3dUrl);
  invalidateStorefront(storefrontTargets.product(product.slug));
}

/** Creates, updates and disables variants from the colour × size matrix in one transaction. */
export async function saveVariantMatrix(actor: AdminActor, productId: string, values: unknown) {
  const { rows } = variantMatrixSchema.parse(values);
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { variants: true } });
  if (!product) throw new AdminError("NOT_FOUND", "This product no longer exists.");
  const existing = new Map(product.variants.map((variant) => [`${variant.colorId}:${variant.sizeId}`, variant]));
  const seen = new Map<string, number>();
  rows.forEach((row, index) => {
    const known = existing.has(`${row.colorId}:${row.sizeId}`);
    if (!row.active && !known) return;
    if (!SKU_PATTERN.test(row.sku)) throw new AdminError("VALIDATION", "Use capital letters, numbers and hyphens (e.g. IMP-BLK-L).", `rows.${index}.sku`);
    if (seen.has(row.sku)) throw new AdminError("CONFLICT", "SKU is repeated in this matrix.", `rows.${index}.sku`);
    seen.set(row.sku, index);
    const price = row.price ? toMinorUnits(row.price) : product.basePrice;
    if (row.compareAtPrice && toMinorUnits(row.compareAtPrice) <= price) {
      throw new AdminError("VALIDATION", "Compare-at price must be higher than the selling price.", `rows.${index}.compareAtPrice`);
    }
  });
  const clashes = await prisma.productVariant.findMany({ where: { sku: { in: [...seen.keys()] }, productId: { not: productId } }, select: { sku: true } });
  if (clashes.length) throw new AdminError("CONFLICT", "SKU already exists.", `rows.${seen.get(clashes[0].sku)}.sku`);

  const summary = { created: 0, updated: 0, disabled: 0 };
  await withSerializableRetry(async (tx) => {
    // Free SKUs being swapped between this product's own variants before reassigning them.
    const moving = product.variants.filter((variant) => {
      const row = rows.find((candidate) => candidate.colorId === variant.colorId && candidate.sizeId === variant.sizeId);
      return row && row.sku !== variant.sku;
    });
    for (const variant of moving) await tx.productVariant.update({ where: { id: variant.id }, data: { sku: `__tmp-${variant.id}` } });
    for (const row of rows) {
      const current = existing.get(`${row.colorId}:${row.sizeId}`);
      const data = {
        sku: row.sku,
        price: row.price ? toMinorUnits(row.price) : null,
        compareAtPrice: row.compareAtPrice ? toMinorUnits(row.compareAtPrice) : null,
      };
      if (current) {
        await tx.productVariant.update({ where: { id: current.id }, data: { ...data, enabled: row.active } });
        if (current.enabled && !row.active) summary.disabled += 1;
        else summary.updated += 1;
      } else if (row.active) {
        const stock = Number(row.initialStock || 0);
        const created = await tx.productVariant.create({
          data: { ...data, productId, colorId: row.colorId, sizeId: row.sizeId, enabled: true, inventory: { create: { quantity: stock } } },
        });
        if (stock > 0) {
          await tx.inventoryAdjustment.create({ data: { variantId: created.id, quantityDelta: stock, quantityBefore: 0, quantityAfter: stock, reason: "RESTOCK", note: "Initial stock", adminId: actor.id } });
        }
        summary.created += 1;
      }
    }
    await recordAudit(tx, actor, "VARIANTS_UPDATED", "product", productId, summary);
  });
  invalidateStorefront(storefrontTargets.product(product.slug));
  return summary;
}

export async function createColor(actor: AdminActor, values: unknown) {
  const input = colorFormSchema.parse(values);
  const color = await prisma.$transaction(async (tx) => {
    const created = await tx.color.create({ data: { name: input.name, slug: input.slug, hex: input.hex.toLowerCase() } });
    await recordAudit(tx, actor, "COLOR_CREATED", "color", created.id, { name: created.name, hex: created.hex });
    return created;
  });
  return { id: color.id, name: color.name, slug: color.slug, hex: color.hex, enabled: color.enabled };
}

// ---------- Product media ----------

async function productSlug(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { slug: true } });
  if (!product) throw new AdminError("NOT_FOUND", "This product no longer exists.");
  return product.slug;
}

export async function addProductImages(actor: AdminActor, productId: string, items: unknown) {
  const list = mediaItemSchema.array().min(1).max(20).parse(items);
  for (const item of list) if (!(await isAcceptableMediaUrl(item.url))) throw new AdminError("VALIDATION", "One of the images is not an uploaded file.");
  const slug = await productSlug(productId);
  const created = await prisma.$transaction(async (tx) => {
    const count = await tx.productImage.count({ where: { productId } });
    const max = await tx.productImage.aggregate({ where: { productId }, _max: { order: true } });
    const start = (max._max.order ?? -1) + 1;
    const rows = [];
    for (const [index, item] of list.entries()) {
      rows.push(await tx.productImage.create({
        data: { productId, src: item.url, alt: item.alt || "Product image", order: start + index, type: (count === 0 && index === 0 ? "FRONT" : "OTHER") as ProductImageType },
      }));
    }
    await recordAudit(tx, actor, "PRODUCT_MEDIA_UPDATED", "product", productId, { added: rows.length });
    return rows;
  });
  invalidateStorefront(storefrontTargets.product(slug));
  return created.map((image) => ({ id: image.id, src: image.src, alt: image.alt, type: image.type, colorId: image.colorId, order: image.order }));
}

export async function updateProductImage(actor: AdminActor, imageId: string, values: unknown) {
  const input = productImageUpdateSchema.parse(values);
  const image = await prisma.$transaction(async (tx) => {
    const updated = await tx.productImage.update({
      where: { id: imageId },
      data: { alt: input.alt, type: input.type, colorId: input.colorId || null },
      include: { product: { select: { slug: true } } },
    });
    await recordAudit(tx, actor, "PRODUCT_MEDIA_UPDATED", "product", updated.productId, { updated: imageId });
    return updated;
  });
  invalidateStorefront(storefrontTargets.product(image.product.slug));
  return { id: image.id, alt: image.alt, type: image.type, colorId: image.colorId };
}

export async function removeProductImage(actor: AdminActor, imageId: string) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId }, include: { product: { select: { slug: true } } } });
  if (!image) return;
  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } });
    await recordAudit(tx, actor, "PRODUCT_MEDIA_UPDATED", "product", image.productId, { removed: imageId });
  });
  await deleteIfUnreferenced(image.src);
  invalidateStorefront(storefrontTargets.product(image.product.slug));
}

/** Persists an explicit order. Two passes avoid tripping the (product, order, colour) unique index. */
export async function reorderProductImages(actor: AdminActor, productId: string, orderedIds: unknown) {
  const ids = orderedIdsSchema.parse(orderedIds);
  const slug = await productSlug(productId);
  await prisma.$transaction(async (tx) => {
    const images = await tx.productImage.findMany({ where: { productId }, select: { id: true } });
    assertSameSet(images.map((image) => image.id), ids);
    for (const [index, id] of ids.entries()) await tx.productImage.update({ where: { id }, data: { order: -(index + 1) } });
    for (const [index, id] of ids.entries()) await tx.productImage.update({ where: { id }, data: { order: index } });
    await recordAudit(tx, actor, "PRODUCT_MEDIA_UPDATED", "product", productId, { reordered: ids.length });
  });
  invalidateStorefront(storefrontTargets.product(slug));
}
