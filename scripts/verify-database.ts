import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verify() {
  const [collections, products, variants, inventory, deliveryMethods] = await Promise.all([
    prisma.collection.count({ where: { enabled: true } }),
    prisma.product.count({ where: { enabled: true } }),
    prisma.productVariant.count({ where: { enabled: true } }),
    prisma.inventory.count(),
    prisma.deliveryMethod.count({ where: { enabled: true } }),
  ]);
  if (collections !== 5 || products !== 5 || variants < 20 || inventory !== variants || deliveryMethods !== 2) {
    throw new Error(`Unexpected seed counts: ${JSON.stringify({ collections, products, variants, inventory, deliveryMethods })}`);
  }
  const product = await prisma.product.findUnique({
    where: { slug: "sculpture-tee" },
    include: { collection: true, images: true, variants: { include: { color: true, size: true, inventory: true } }, relatedFrom: true },
  });
  if (!product || product.collection.slug !== "greek" || product.images.length !== 3 || product.relatedFrom.length !== 2) {
    throw new Error("Seeded product relations are incomplete.");
  }
  console.log(JSON.stringify({ collections, products, variants, inventory, deliveryMethods, sculptureImages: product.images.length, sculptureRelated: product.relatedFrom.length }));
}

verify().finally(() => prisma.$disconnect());
