import { PrismaClient, ProductImageType } from "@prisma/client";
import { collections } from "../data/collections";
import { products } from "../data/products";
import { productSizes } from "../types/product";

const prisma = new PrismaClient();
const toMinor = (amount: number) => BigInt(Math.round(amount * 100));
const toSlug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const imageTypes: Record<string, ProductImageType> = {
  front: ProductImageType.FRONT,
  back: ProductImageType.BACK,
  detail: ProductImageType.DETAIL,
  model: ProductImageType.MODEL,
  lifestyle: ProductImageType.LIFESTYLE,
  other: ProductImageType.OTHER,
};

/**
 * Bootstraps an empty development database. Existing catalog rows are never
 * overwritten: once the admin dashboard owns the data, re-running the seed must
 * not undo edits or reset stock (which would corrupt active reservations).
 */
async function seed() {
  await prisma.$transaction(async (tx) => {
    const collectionIds = new Map<string, string>();
    for (const collection of collections) {
      const record = await tx.collection.upsert({
        where: { slug: collection.slug },
        update: {},
        create: {
          name: collection.name,
          slug: collection.slug,
          shortDescription: collection.shortDescription,
          description: collection.description,
          order: collection.order,
          enabled: collection.enabled,
          featured: collection.featured ?? false,
        },
      });
      collectionIds.set(collection.id, record.id);
      if (await tx.collectionImage.count({ where: { collectionId: record.id } })) continue;
      await tx.collectionImage.createMany({
        data: collection.images.map((image) => ({
          collectionId: record.id,
          src: image.src,
          alt: image.alt,
          order: image.order,
        })),
      });
    }

    const colorIds = new Map<string, string>();
    const uniqueColors = new Map<string, { name: string; hex?: string }>();
    for (const product of products) {
      for (const variant of product.variants) uniqueColors.set(toSlug(variant.color), { name: variant.color, hex: variant.colorHex });
    }
    for (const [slug, color] of uniqueColors) {
      const record = await tx.color.upsert({
        where: { slug },
        update: { name: color.name, hex: color.hex, enabled: true },
        create: { slug, name: color.name, hex: color.hex, enabled: true },
      });
      colorIds.set(color.name, record.id);
    }

    const sizeIds = new Map<string, string>();
    for (const [order, name] of productSizes.entries()) {
      const slug = name.toLowerCase();
      const record = await tx.size.upsert({
        where: { slug },
        update: { name, order, enabled: true },
        create: { slug, name, order, enabled: true },
      });
      sizeIds.set(name, record.id);
    }

    const productIds = new Map<string, string>();
    for (const product of products) {
      const collectionId = collectionIds.get(product.collectionId);
      if (!collectionId) throw new Error(`Missing collection for ${product.slug}`);
      const record = await tx.product.upsert({
        where: { slug: product.slug },
        update: {},
        create: {
          name: product.name,
          slug: product.slug,
          subtitle: product.subtitle,
          description: product.description,
          details: product.details,
          basePrice: toMinor(product.price),
          currency: product.currency,
          collectionId,
          material: product.material,
          gsm: product.gsm,
          fit: product.fit,
          fitNotes: product.fitNotes ?? [],
          fitAdvice: product.fitAdvice,
          print: product.print,
          care: product.care ?? [],
          sizeChart: product.sizeChart,
          model3dUrl: product.model3d?.glb,
          featured: product.featured ?? false,
          enabled: true,
          releaseOrder: product.releaseOrder,
        },
      });
      productIds.set(product.id, record.id);

      const hasImages = (await tx.productImage.count({ where: { productId: record.id } })) > 0;
      if (!hasImages) await tx.productImage.createMany({
        data: product.images.map((image) => ({
          productId: record.id,
          src: image.src,
          alt: image.alt,
          type: imageTypes[image.type ?? "other"] ?? ProductImageType.OTHER,
          order: image.order,
          focalX: image.focalPoint?.x,
          focalY: image.focalPoint?.y,
          zoom: image.zoom,
        })),
      });

      for (const variant of product.variants) {
        const colorId = colorIds.get(variant.color);
        const sizeId = sizeIds.get(variant.size);
        if (!colorId || !sizeId) throw new Error(`Missing option for ${variant.sku}`);
        const variantRecord = await tx.productVariant.upsert({
          where: { sku: variant.sku },
          update: {},
          create: {
            productId: record.id,
            colorId,
            sizeId,
            sku: variant.sku,
            price: variant.price === product.price ? null : toMinor(variant.price),
            compareAtPrice: variant.compareAtPrice == null ? null : toMinor(variant.compareAtPrice),
            enabled: variant.enabled,
          },
        });
        await tx.inventory.upsert({
          where: { variantId: variantRecord.id },
          update: {},
          create: { variantId: variantRecord.id, quantity: variant.stock, reservedQuantity: 0 },
        });
      }
    }

    for (const product of products) {
      const productId = productIds.get(product.id);
      if (!productId) continue;
      const relations = (product.relatedIds ?? []).flatMap((relatedId, order) => {
        const relatedProductId = productIds.get(relatedId);
        return relatedProductId ? [{ productId, relatedProductId, order }] : [];
      });
      if (relations.length) await tx.productRelation.createMany({ data: relations, skipDuplicates: true });
    }

    await tx.deliveryMethod.upsert({
      where: { code: "STANDARD" },
      update: { name: "Standard", description: "Standard tracked delivery", price: BigInt(0), currency: "INR", enabled: true, estimatedMinDays: 3, estimatedMaxDays: 7 },
      create: { code: "STANDARD", name: "Standard", description: "Standard tracked delivery", price: BigInt(0), currency: "INR", enabled: true, estimatedMinDays: 3, estimatedMaxDays: 7 },
    });
    await tx.deliveryMethod.upsert({
      where: { code: "EXPRESS" },
      update: { name: "Express", description: "Priority tracked delivery", price: BigInt(45000), currency: "INR", enabled: true, estimatedMinDays: 1, estimatedMaxDays: 3 },
      create: { code: "EXPRESS", name: "Express", description: "Priority tracked delivery", price: BigInt(45000), currency: "INR", enabled: true, estimatedMinDays: 1, estimatedMaxDays: 3 },
    });
  });
}

seed()
  .then(() => console.log("Clothin catalog seed complete."))
  .finally(async () => prisma.$disconnect());
