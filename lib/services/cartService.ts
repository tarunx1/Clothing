import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/transaction";
import { DomainError } from "@/lib/errors";
import { validateRequestedQuantity } from "@/lib/domain/order";
import { getSettings } from "@/lib/settings/settingsService";
import { getInventoryPolicy, sellableQuantity } from "@/lib/services/storePolicy";
import type { CartMutationResult } from "@/types/cart";
import type { BagLine, CurrencyCode } from "@/types/product";

const cartInclude = {
  items: {
    include: { variant: { include: { inventory: true, product: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.CartInclude;

type CartRecord = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
const major = (minor: bigint) => Number(minor) / 100;

/** Stock policy and per-item cap from Settings → Inventory / Checkout. */
async function cartLimits() {
  const [policy, checkout] = await Promise.all([getInventoryPolicy(), getSettings("checkout")]);
  return { allowed: (inventory: { quantity: number; reservedQuantity: number } | null) => Math.min(sellableQuantity(inventory, policy), checkout.maxQuantityPerItem) };
}

function quote(record: CartRecord): CartMutationResult {
  const lines = record.items.map((item) => ({ productId: item.variant.product.slug, variantId: item.variant.sku, quantity: item.quantity }));
  const subtotalMinor = record.items.reduce(
    (sum, item) => sum + (item.variant.price ?? item.variant.product.basePrice) * BigInt(item.quantity),
    BigInt(0),
  );
  return {
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: major(subtotalMinor),
    currency: (record.items[0]?.variant.product.currency ?? "INR") as CurrencyCode,
  };
}

async function activeCart(sessionId: string): Promise<CartRecord> {
  return prisma.cart.upsert({
    where: { sessionId },
    update: { status: "ACTIVE" },
    create: { sessionId, status: "ACTIVE" },
    include: cartInclude,
  });
}

export async function getCart(sessionId: string): Promise<CartMutationResult> {
  return quote(await activeCart(sessionId));
}

export async function syncCart(sessionId: string, inputLines: BagLine[]): Promise<CartMutationResult> {
  const merged = new Map<string, BagLine>();
  for (const line of inputLines) {
    const current = merged.get(line.variantId);
    merged.set(line.variantId, { ...line, quantity: (current?.quantity ?? 0) + line.quantity });
  }
  const limits = await cartLimits();
  return withSerializableRetry(async (tx) => {
    const cart = await tx.cart.upsert({
      where: { sessionId },
      update: { status: "ACTIVE" },
      create: { sessionId, status: "ACTIVE" },
    });
    const lines = [...merged.values()];
    const variants = await tx.productVariant.findMany({
      where: { sku: { in: lines.map((line) => line.variantId) }, enabled: true, product: { enabled: true } },
      include: { inventory: true, product: true },
    });
    const bySku = new Map(variants.map((variant) => [variant.sku, variant]));
    const data = lines.map((line) => {
      const variant = bySku.get(line.variantId);
      if (!variant || variant.product.slug !== line.productId) throw new DomainError("VARIANT_NOT_FOUND", "A bag item is no longer available.");
      validateRequestedQuantity(line.quantity, limits.allowed(variant.inventory));
      return { cartId: cart.id, variantId: variant.id, quantity: line.quantity };
    });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    if (data.length) await tx.cartItem.createMany({ data });
    const record = await tx.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude });
    return quote(record);
  });
}

export async function addCartItem(sessionId: string, line: BagLine): Promise<CartMutationResult> {
  const limits = await cartLimits();
  return withSerializableRetry(async (tx) => {
    const cart = await tx.cart.upsert({ where: { sessionId }, update: { status: "ACTIVE" }, create: { sessionId, status: "ACTIVE" } });
    const variant = await tx.productVariant.findFirst({
      where: { sku: line.variantId, enabled: true, product: { slug: line.productId, enabled: true } },
      include: { inventory: true },
    });
    if (!variant) throw new DomainError("VARIANT_NOT_FOUND", "This product option is no longer available.");
    const existing = await tx.cartItem.findUnique({ where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } } });
    const quantity = (existing?.quantity ?? 0) + line.quantity;
    validateRequestedQuantity(quantity, limits.allowed(variant.inventory));
    await tx.cartItem.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } },
      update: { quantity },
      create: { cartId: cart.id, variantId: variant.id, quantity },
    });
    return quote(await tx.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude }));
  });
}

export async function updateCartItem(sessionId: string, variantSku: string, quantity: number): Promise<CartMutationResult> {
  const limits = await cartLimits();
  return withSerializableRetry(async (tx) => {
    const cart = await tx.cart.findUnique({ where: { sessionId } });
    if (!cart) throw new DomainError("CART_NOT_FOUND", "Your bag could not be found.");
    const variant = await tx.productVariant.findUnique({ where: { sku: variantSku }, include: { inventory: true } });
    if (!variant) throw new DomainError("VARIANT_NOT_FOUND", "This product option is no longer available.");
    validateRequestedQuantity(quantity, limits.allowed(variant.inventory));
    await tx.cartItem.update({ where: { cartId_variantId: { cartId: cart.id, variantId: variant.id } }, data: { quantity } });
    return quote(await tx.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude }));
  });
}

export async function removeCartItem(sessionId: string, variantSku: string): Promise<CartMutationResult> {
  const cart = await prisma.cart.findUnique({ where: { sessionId } });
  if (!cart) throw new DomainError("CART_NOT_FOUND", "Your bag could not be found.");
  const variant = await prisma.productVariant.findUnique({ where: { sku: variantSku } });
  if (variant) await prisma.cartItem.deleteMany({ where: { cartId: cart.id, variantId: variant.id } });
  return quote(await prisma.cart.findUniqueOrThrow({ where: { id: cart.id }, include: cartInclude }));
}
