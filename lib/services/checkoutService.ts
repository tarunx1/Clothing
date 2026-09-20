import "server-only";
import type { Prisma } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { validateRequestedQuantity } from "@/lib/domain/order";
import { methodsFor, shipsTo } from "@/lib/domain/shipping";
import { computeTax } from "@/lib/domain/tax";
import { formatMoney } from "@/lib/money";
import type { CheckoutSchemaValues } from "@/lib/validation/checkout";
import { sellableQuantity, type CheckoutPolicy, type InventoryPolicy } from "@/lib/services/storePolicy";

export const checkoutCartInclude = {
  items: {
    include: {
      variant: {
        include: {
          inventory: true,
          color: true,
          size: true,
          product: { include: { images: { orderBy: { order: "asc" as const } } } },
        },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.CartInclude;

export type CheckoutCart = Prisma.CartGetPayload<{ include: typeof checkoutCartInclude }>;

/** Server-priced snapshot of a cart line. Money is integer minor units. */
export interface PricedLine {
  productId: string;
  variantId: string;
  productName: string;
  sku: string;
  sizeName: string;
  colorName: string;
  unitPrice: bigint;
  quantity: number;
  lineTotal: bigint;
  imageUrl: string | null;
}

export interface CheckoutTotals {
  subtotal: bigint;
  shippingAmount: bigint;
  taxAmount: bigint;
  total: bigint;
  currency: CheckoutCart["items"][number]["variant"]["product"]["currency"];
}

/**
 * Revalidates every cart line against the database and prices it server-side.
 * Availability is `quantity - reservedQuantity`, so callers must release any
 * reservation the same order already holds before calling this.
 */
export function priceCart(cart: CheckoutCart, policy: Pick<InventoryPolicy, "enforceStock"> = { enforceStock: true }, maxQuantityPerItem = 99): { lines: PricedLine[]; subtotal: bigint; currency: CheckoutTotals["currency"] } {
  if (!cart.items.length) throw new DomainError("CART_NOT_FOUND", "Your bag is empty.");
  const currency = cart.items[0].variant.product.currency;
  const lines = cart.items.map((item) => {
    const { variant } = item;
    if (!variant.enabled || !variant.product.enabled) throw new DomainError("VARIANT_NOT_FOUND", "A bag item is no longer available.");
    if (variant.product.currency !== currency) throw new DomainError("CHECKOUT_INVALID", "Items with different currencies cannot be checked out together.");
    if (item.quantity > maxQuantityPerItem) throw new DomainError("CHECKOUT_INVALID", `You can order up to ${maxQuantityPerItem} of each item.`);
    validateRequestedQuantity(item.quantity, sellableQuantity(variant.inventory, policy));
    const unitPrice = variant.price ?? variant.product.basePrice;
    const image = variant.product.images.find((entry) => entry.colorId === variant.colorId) ?? variant.product.images[0];
    return {
      productId: variant.product.id,
      variantId: variant.id,
      productName: variant.product.name,
      sku: variant.sku,
      sizeName: variant.size.name,
      colorName: variant.color.name,
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * BigInt(item.quantity),
      imageUrl: image?.src ?? null,
    };
  });
  return { lines, subtotal: lines.reduce((sum, line) => sum + line.lineTotal, BigInt(0)), currency };
}

/**
 * Prices the cart and delivery from the store's settings (zones, free shipping,
 * tax, minimum order), then upserts the VALIDATED draft + address.
 */
export async function upsertValidatedDraft(tx: Prisma.TransactionClient, cart: CheckoutCart, input: CheckoutSchemaValues, draftId: string | undefined, policy: { checkout: CheckoutPolicy; inventory: Pick<InventoryPolicy, "enforceStock"> }) {
  const { rules, zones, freeShipping, tax } = policy.checkout;
  const { lines, subtotal, currency } = priceCart(cart, policy.inventory, rules.maxQuantityPerItem);
  const country = input.shippingAddress.country;
  if (!rules.allowedCountries.includes(country) || !shipsTo(zones, country)) throw new DomainError("CHECKOUT_INVALID", "We don’t ship to this address yet.");
  if (rules.minimumOrder > 0 && subtotal < BigInt(rules.minimumOrder)) {
    throw new DomainError("CHECKOUT_INVALID", `The minimum order is ${formatMoney(rules.minimumOrder / 100, currency)} before shipping.`);
  }
  const options = methodsFor({ zones, methods: policy.checkout.methods, freeShipping, country, region: input.shippingAddress.region, subtotal: Number(subtotal), currency });
  const option = options.find((candidate) => candidate.code === input.deliveryMethodId.toUpperCase());
  const delivery = option ? await tx.deliveryMethod.findFirst({ where: { code: option.code, enabled: true, currency } }) : null;
  if (!option || !delivery) throw new DomainError("CHECKOUT_INVALID", "Select an available delivery method.");
  const shippingAmount = BigInt(option.rate);
  const taxResult = computeTax(tax, { amount: Number(subtotal), country, region: input.shippingAddress.region });
  const taxAmount = BigInt(taxResult.amount);
  const totals: CheckoutTotals = { subtotal, shippingAmount, taxAmount, total: subtotal + shippingAmount + (taxResult.inclusive ? BigInt(0) : taxAmount), currency };
  const data = { email: input.contact.email, deliveryMethodId: delivery.id, status: "VALIDATED" as const, ...totals };
  const draft = draftId
    ? await tx.checkoutDraft.update({ where: { id: draftId }, data })
    : await tx.checkoutDraft.create({ data: { cartId: cart.id, ...data } });
  const address = shippingSnapshot(input);
  await tx.shippingAddress.upsert({ where: { checkoutDraftId: draft.id }, update: address, create: { checkoutDraftId: draft.id, ...address } });
  return { draft, lines, totals, address };
}

export function shippingSnapshot(input: CheckoutSchemaValues) {
  return {
    firstName: input.shippingAddress.firstName,
    lastName: input.shippingAddress.lastName,
    address1: input.shippingAddress.address1,
    address2: input.shippingAddress.address2 || null,
    city: input.shippingAddress.city,
    region: input.shippingAddress.region,
    postalCode: input.shippingAddress.postalCode,
    countryCode: input.shippingAddress.country,
    phone: input.shippingAddress.phone || input.contact.phone || null,
    company: input.shippingAddress.company || null,
  };
}
