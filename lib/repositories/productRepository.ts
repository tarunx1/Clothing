import "server-only";
import { Prisma, ProductImageType as DbImageType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { Product, ProductImageType } from "@/types/product";

const productInclude = {
  collection: { include: { images: { orderBy: { order: "asc" as const } } } },
  images: { include: { color: true }, orderBy: { order: "asc" as const } },
  variants: {
    include: { color: true, size: true, inventory: true },
    orderBy: [{ color: { name: "asc" as const } }, { size: { order: "asc" as const } }],
  },
  relatedFrom: { include: { relatedProduct: true }, orderBy: { order: "asc" as const } },
} satisfies Prisma.ProductInclude;

type ProductRecord = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

const imageType = (type: DbImageType): ProductImageType => type.toLowerCase() as ProductImageType;
const major = (minor: bigint) => Number(minor) / 100;

/** `sellable` turns stored inventory into purchasable units (Settings → Inventory decides). */
export function mapProduct(record: ProductRecord, sellable: (inventory: ProductRecord["variants"][number]["inventory"]) => number = (inventory) => Math.max(0, (inventory?.quantity ?? 0) - (inventory?.reservedQuantity ?? 0))): Product {
  return {
    id: record.slug,
    slug: record.slug,
    name: record.name,
    subtitle: record.subtitle ?? undefined,
    description: record.description,
    details: record.details ?? undefined,
    price: major(record.basePrice),
    compareAtPrice: record.variants[0]?.compareAtPrice ? major(record.variants[0].compareAtPrice) : undefined,
    currency: record.currency,
    collectionId: record.collection.slug,
    collection: {
      id: record.collection.slug,
      slug: record.collection.slug,
      name: record.collection.name,
      shortDescription: record.collection.shortDescription,
      description: record.collection.description,
      order: record.collection.order,
      enabled: record.collection.enabled,
      featured: record.collection.featured,
      images: record.collection.images.map((image) => ({ id: image.id, src: image.src, alt: image.alt, order: image.order })),
    },
    material: record.material ?? undefined,
    gsm: record.gsm ?? undefined,
    fit: record.fit ?? undefined,
    fitNotes: record.fitNotes,
    fitAdvice: record.fitAdvice ?? undefined,
    print: record.print ?? undefined,
    care: record.care,
    sizeChart: record.sizeChart ?? undefined,
    model3d: record.model3dUrl ? { glb: record.model3dUrl } : undefined,
    featured: record.featured,
    releaseOrder: record.releaseOrder,
    relatedIds: record.relatedFrom.map((relation) => relation.relatedProduct.slug),
    images: record.images.map((image) => ({
      id: image.id,
      src: image.src,
      alt: image.alt,
      type: imageType(image.type),
      order: image.order,
      color: image.color?.name,
      focalPoint: image.focalX != null && image.focalY != null ? { x: image.focalX, y: image.focalY } : undefined,
      zoom: image.zoom ?? undefined,
    })),
    variants: record.variants.map((variant) => ({
      id: variant.sku,
      sku: variant.sku,
      size: variant.size.name,
      color: variant.color.name,
      colorHex: variant.color.hex ?? undefined,
      price: major(variant.price ?? record.basePrice),
      compareAtPrice: variant.compareAtPrice == null ? undefined : major(variant.compareAtPrice),
      stock: sellable(variant.inventory),
      enabled: variant.enabled && variant.color.enabled && variant.size.enabled,
    })),
  };
}

export async function findEnabledProducts(sellable?: Parameters<typeof mapProduct>[1]): Promise<Product[]> {
  const records = await prisma.product.findMany({
    where: { enabled: true, collection: { enabled: true } },
    include: productInclude,
    orderBy: [{ featured: "desc" }, { releaseOrder: "desc" }],
  });
  return records.map((record) => mapProduct(record, sellable));
}

export async function findProductBySlug(slug: string, sellable?: Parameters<typeof mapProduct>[1]): Promise<Product | null> {
  const record = await prisma.product.findFirst({
    where: { slug, enabled: true, collection: { enabled: true } },
    include: productInclude,
  });
  return record ? mapProduct(record, sellable) : null;
}
