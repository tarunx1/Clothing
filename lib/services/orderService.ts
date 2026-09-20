import "server-only";
import { randomBytes } from "node:crypto";
import type { OrderStatus, Prisma } from "@prisma/client";
import { PAID_ORDER_STATUSES, paymentConfig } from "@/config/payment";
import { prisma } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/transaction";
import { DomainError } from "@/lib/errors";
import { buildCheckoutSchema } from "@/lib/checkout/rules";
import { getSettings } from "@/lib/settings/settingsService";
import { getCheckoutPolicy, getInventoryPolicy } from "@/lib/services/storePolicy";
import { emitStoreEvent } from "@/lib/webhooks/dispatcher";
import { checkoutCartInclude, upsertValidatedDraft } from "@/lib/services/checkoutService";
import { commitReservedStock, commitUnreservedStock, releaseStock, reserveStock } from "@/lib/services/inventoryService";
import type { CurrencyCode } from "@/types/product";

export const isPaidStatus = (status: OrderStatus) => (PAID_ORDER_STATUSES as readonly OrderStatus[]).includes(status);

/** 192 bits of randomness, URL-safe. Grants read access to one order's confirmation. */
export const createPublicToken = () => randomBytes(24).toString("base64url");
export const isPublicTokenShape = (value: string) => /^[A-Za-z0-9_-]{32}$/.test(value);
/** Random, unguessable order numbers with the prefix from Settings → Orders. */
const createOrderNumber = (prefix: string) => `${prefix}-${randomBytes(6).toString("hex").toUpperCase()}`;

export interface PreparedOrder {
  orderId: string;
  orderNumber: string;
  publicToken: string;
  email: string;
  customerName: string;
  phone: string | null;
  subtotal: bigint;
  shippingAmount: bigint;
  taxAmount: bigint;
  total: bigint;
  currency: CurrencyCode;
  countryCode: string;
}

/**
 * CONTINUE TO PAYMENT, server side. In one Serializable transaction:
 * reload the cart, release this order's previous hold, revalidate and price
 * every line from the database, snapshot items + address, upsert the single
 * order for this checkout as AWAITING_PAYMENT, and reserve stock.
 * Retries reuse the same order, so repeated attempts never duplicate orders.
 */
export async function prepareOrderForPayment(sessionId: string, values: unknown, now = new Date()): Promise<PreparedOrder> {
  const [checkoutPolicy, inventoryPolicy, orderSettings] = await Promise.all([getCheckoutPolicy(), getInventoryPolicy(), getSettings("orders")]);
  const input = buildCheckoutSchema(checkoutPolicy.rules).parse(values);
  const prepared = await withSerializableRetry(async (tx) => {
    const cartRef = await tx.cart.findUnique({ where: { sessionId }, select: { id: true, status: true } });
    if (!cartRef || cartRef.status !== "ACTIVE") throw new DomainError("SESSION_EXPIRED", "Your checkout session has expired. Refresh and try again.");
    const openDraft = await tx.checkoutDraft.findFirst({
      where: { cartId: cartRef.id, status: { in: ["OPEN", "VALIDATED"] } },
      orderBy: { createdAt: "desc" },
      include: { order: true },
    });
    const existing = openDraft?.order ?? null;
    if (existing && isPaidStatus(existing.status)) {
      throw new DomainError("ORDER_ALREADY_PAID", "This order has already been paid.", { confirmationPath: paymentConfig.confirmationPath(existing.publicToken) });
    }
    if (existing) await releaseOrderReservation(tx, existing.id);

    const cart = await tx.cart.findUniqueOrThrow({ where: { id: cartRef.id }, include: checkoutCartInclude });
    const { draft, lines, totals, address } = await upsertValidatedDraft(tx, cart, input, openDraft?.id, { checkout: checkoutPolicy, inventory: inventoryPolicy });
    const orderData = {
      email: draft.email,
      status: "AWAITING_PAYMENT" as const,
      currency: totals.currency,
      subtotal: totals.subtotal,
      shippingAmount: totals.shippingAmount,
      taxAmount: totals.taxAmount,
      discountAmount: BigInt(0),
      total: totals.total,
      reservationStatus: "RESERVED" as const,
      reservationExpiresAt: new Date(now.getTime() + inventoryPolicy.reservationMinutes * 60_000),
    };
    let order;
    if (existing) {
      await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
      order = await tx.order.update({
        where: { id: existing.id },
        data: {
          ...orderData,
          items: { create: lines },
          shippingAddress: { upsert: { update: address, create: address } },
        },
      });
    } else {
      order = await tx.order.create({
        data: {
          ...orderData,
          checkoutDraftId: draft.id,
          orderNumber: createOrderNumber(orderSettings.numberPrefix),
          publicToken: createPublicToken(),
          items: { create: lines },
          shippingAddress: { create: address },
        },
      });
    }
    await reserveStock(tx, lines, inventoryPolicy.enforceStock);
    return {
      created: !existing,
      orderId: order.id,
      orderNumber: order.orderNumber,
      publicToken: order.publicToken,
      email: order.email,
      customerName: `${address.firstName} ${address.lastName}`.trim(),
      phone: address.phone,
      subtotal: order.subtotal,
      shippingAmount: order.shippingAmount,
      taxAmount: order.taxAmount,
      total: order.total,
      currency: order.currency,
      countryCode: address.countryCode,
    };
  });
  const { created, ...order } = prepared;
  if (created) await emitStoreEvent("ORDER_CREATED", { orderNumber: order.orderNumber, total: Number(order.total) / 100, currency: order.currency }).catch(() => undefined);
  return order;
}

/** Returns an order's held stock. Safe to call repeatedly. */
export async function releaseOrderReservation(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (order.reservationStatus !== "RESERVED") return false;
  await releaseStock(tx, order.items);
  await tx.order.update({ where: { id: orderId }, data: { reservationStatus: "RELEASED", reservationExpiresAt: null } });
  return true;
}

/** Converts an order's stock to sold exactly once, whatever its reservation state. */
export async function commitOrderInventory(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  if (order.reservationStatus === "COMMITTED") return false;
  if (order.reservationStatus === "RESERVED") await commitReservedStock(tx, order.items);
  else await commitUnreservedStock(tx, order.items);
  await tx.order.update({ where: { id: orderId }, data: { reservationStatus: "COMMITTED", reservationExpiresAt: null } });
  return true;
}

/**
 * Releases stock held by abandoned checkouts. Called lazily before new payment
 * sessions and by `scripts/expire-reservations.mts` on a schedule.
 */
export async function expireAbandonedOrders(now = new Date(), limit = 50) {
  const stale = await prisma.order.findMany({
    where: { reservationStatus: "RESERVED", reservationExpiresAt: { lt: now }, status: { in: ["AWAITING_PAYMENT", "PAYMENT_FAILED"] } },
    select: { id: true },
    take: limit,
  });
  let expired = 0;
  for (const { id } of stale) {
    const changed = await withSerializableRetry(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({ where: { id } });
      if (order.reservationStatus !== "RESERVED" || isPaidStatus(order.status) || !order.reservationExpiresAt || order.reservationExpiresAt >= now) return false;
      await releaseOrderReservation(tx, id);
      await tx.order.update({ where: { id }, data: { status: "EXPIRED" } });
      await tx.payment.updateMany({ where: { orderId: id, status: { in: ["CREATED", "PENDING"] } }, data: { status: "CANCELLED" } });
      return true;
    });
    if (changed) expired += 1;
  }
  // Settings → Orders: cancel orders that stayed unpaid longer than the configured window.
  const { autoCancelUnpaidHours } = await getSettings("orders");
  if (autoCancelUnpaidHours > 0) {
    const cancelBefore = new Date(now.getTime() - autoCancelUnpaidHours * 3_600_000);
    const unpaid = await prisma.order.findMany({ where: { status: { in: ["AWAITING_PAYMENT", "PAYMENT_FAILED", "EXPIRED"] }, createdAt: { lt: cancelBefore } }, select: { id: true, orderNumber: true }, take: limit });
    for (const { id, orderNumber } of unpaid) {
      await withSerializableRetry(async (tx) => {
        const order = await tx.order.findUniqueOrThrow({ where: { id } });
        if (isPaidStatus(order.status) || order.status === "CANCELLED") return;
        await releaseOrderReservation(tx, id);
        await tx.payment.updateMany({ where: { orderId: id, status: { in: ["CREATED", "PENDING"] } }, data: { status: "CANCELLED" } });
        await tx.order.update({ where: { id }, data: { status: "CANCELLED" } });
      });
      await emitStoreEvent("ORDER_CANCELLED", { orderNumber, reason: "unpaid" }).catch(() => undefined);
    }
  }
  const cutoff = new Date(now.getTime() - paymentConfig.webhookRetentionDays * 86_400_000);
  await prisma.webhookEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return expired;
}

export interface OrderConfirmation {
  orderNumber: string;
  status: "confirmed" | "processing" | "unpaid";
  email: string;
  currency: CurrencyCode;
  subtotal: number;
  shipping: number;
  tax: number;
  /** Tax already inside the prices (shown as “included”, not added). */
  taxIncluded: boolean;
  total: number;
  items: { key: string; productName: string; sku: string; sizeName: string; colorName: string; unitPrice: number; quantity: number; lineTotal: number; imageUrl: string | null }[];
  shipTo: { name: string; address1: string; address2: string | null; city: string; region: string; postalCode: string; countryCode: string } | null;
}

const major = (minor: bigint) => Number(minor) / 100;

/** Customer-facing order view built purely from order snapshots. No database ids leave this function. */
export async function getOrderConfirmation(publicToken: string): Promise<OrderConfirmation | null> {
  if (!isPublicTokenShape(publicToken)) return null;
  const order = await prisma.order.findUnique({
    where: { publicToken },
    include: { items: { orderBy: { createdAt: "asc" } }, shippingAddress: true },
  });
  if (!order) return null;
  const status = isPaidStatus(order.status) ? "confirmed" : order.status === "AWAITING_PAYMENT" ? "processing" : "unpaid";
  const address = order.shippingAddress;
  return {
    orderNumber: order.orderNumber,
    status,
    email: order.email,
    currency: order.currency,
    subtotal: major(order.subtotal),
    shipping: major(order.shippingAmount),
    tax: major(order.taxAmount),
    taxIncluded: order.taxAmount > BigInt(0) && order.total === order.subtotal + order.shippingAmount - order.discountAmount,
    total: major(order.total),
    items: order.items.map((item, index) => ({
      key: `${item.sku}-${index}`,
      productName: item.productName,
      sku: item.sku,
      sizeName: item.sizeName,
      colorName: item.colorName,
      unitPrice: major(item.unitPrice),
      quantity: item.quantity,
      lineTotal: major(item.lineTotal),
      imageUrl: item.imageUrl,
    })),
    shipTo: address
      ? { name: `${address.firstName} ${address.lastName}`, address1: address.address1, address2: address.address2, city: address.city, region: address.region, postalCode: address.postalCode, countryCode: address.countryCode }
      : null,
  };
}
