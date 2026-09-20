import "server-only";
import type { OrderStatus, Prisma } from "@prisma/client";
import type { AdminActor } from "@/lib/admin/authorization";
import { recordAudit } from "@/lib/admin/audit";
import { AdminError } from "@/lib/admin/errors";
import type { ListParams } from "@/lib/admin/listParams";
import { invalidateStorefront } from "@/lib/admin/revalidate";
import { orderTransitionSchema, shipmentSchema } from "@/lib/admin/validation";
import { prisma } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/transaction";
import { canTransitionOrder, ORDER_STATUS_LABELS } from "@/lib/domain/orderStatus";
import { releaseOrderReservation } from "@/lib/services/orderService";
import { notifyOrderStatus } from "@/lib/notifications/notificationService";
import { z } from "zod";

export const ORDER_SORTS = ["newest", "oldest", "total-desc", "total-asc"] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];
export const ORDER_FILTERS = ["AWAITING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED", "PAYMENT_FAILED", "EXPIRED"] as const;

const orderBy: Record<OrderSort, Prisma.OrderOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  "total-desc": { total: "desc" },
  "total-asc": { total: "asc" },
};

export async function listOrders(params: ListParams<OrderSort>) {
  const where: Prisma.OrderWhereInput = { status: { not: "DRAFT" } };
  if (params.search) {
    where.OR = [
      { orderNumber: { contains: params.search, mode: "insensitive" } },
      { email: { contains: params.search, mode: "insensitive" } },
    ];
  }
  const status = params.filters.status as OrderStatus | undefined;
  if (status && (ORDER_FILTERS as readonly string[]).includes(status)) where.status = status;
  const [total, records] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: orderBy[params.sort],
      skip: params.skip,
      take: params.limit,
      include: {
        shippingAddress: { select: { firstName: true, lastName: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);
  return {
    total,
    rows: records.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: order.shippingAddress ? `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}` : "—",
      email: order.email,
      createdAt: order.createdAt,
      status: order.status,
      paymentStatus: order.payments[0]?.status ?? null,
      total: Number(order.total) / 100,
      currency: order.currency,
      itemCount: order._count.items,
    })),
  };
}

/** Admin order view. Line items come from OrderItem snapshots; payment data is limited to safe metadata. */
export async function getOrderDetail(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      shippingAddress: true,
      shipment: true,
      payments: {
        orderBy: { createdAt: "desc" },
        select: { id: true, provider: true, providerOrderId: true, providerPaymentId: true, amount: true, currency: true, status: true, failureCode: true, failureMessage: true, createdAt: true, succeededAt: true },
      },
    },
  });
  if (!order) return null;
  const history = await prisma.adminAuditLog.findMany({
    where: { entityType: "order", entityId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { admin: { select: { name: true } } },
  });
  return { order, history };
}

/**
 * Moves an order through the allowed lifecycle (lib/domain/orderStatus.ts).
 * `from` is the status the admin saw; a concurrent change is reported instead
 * of silently applied twice.
 */
export async function transitionOrder(actor: AdminActor, values: unknown) {
  const input = orderTransitionSchema.parse(values);
  const result = await withSerializableRetry(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { items: true } });
    if (!order) throw new AdminError("NOT_FOUND", "This order no longer exists.");
    if (order.status !== input.from) {
      throw new AdminError("CONFLICT", `This order is now “${ORDER_STATUS_LABELS[order.status]}”. Refresh to see the latest state.`);
    }
    if (!canTransitionOrder(order.status, input.to)) {
      throw new AdminError("INVALID_STATE", `An order that is “${ORDER_STATUS_LABELS[order.status]}” can't be marked “${ORDER_STATUS_LABELS[input.to]}”.`);
    }
    const now = new Date();
    let restocked = 0;
    if (input.to === "CANCELLED") {
      if (order.reservationStatus === "RESERVED") {
        await releaseOrderReservation(tx, order.id);
        await tx.payment.updateMany({ where: { orderId: order.id, status: { in: ["CREATED", "PENDING"] } }, data: { status: "CANCELLED" } });
      } else if (order.reservationStatus === "COMMITTED") {
        // Sold stock goes back on the shelf, each line recorded as a RETURN adjustment.
        for (const item of order.items) {
          if (!item.variantId) continue;
          const rows = await tx.$queryRaw<{ quantity: number }[]>`
            UPDATE inventory SET quantity = quantity + ${item.quantity}, updated_at = now()
            WHERE variant_id = ${item.variantId}::uuid RETURNING quantity`;
          if (!rows[0]) continue;
          await tx.inventoryAdjustment.create({
            data: { variantId: item.variantId, quantityDelta: item.quantity, quantityBefore: rows[0].quantity - item.quantity, quantityAfter: rows[0].quantity, reason: "RETURN", note: `Order ${order.orderNumber} cancelled`, adminId: actor.id },
          });
          restocked += item.quantity;
        }
        await tx.order.update({ where: { id: order.id }, data: { reservationStatus: "RELEASED" } });
      }
    }
    if (input.to === "SHIPPED") {
      const shipment = { carrier: input.carrier || null, trackingNumber: input.trackingNumber || null, trackingUrl: input.trackingUrl || null };
      await tx.shipment.upsert({ where: { orderId: order.id }, update: { ...shipment, shippedAt: now }, create: { orderId: order.id, ...shipment, shippedAt: now } });
    }
    if (input.to === "DELIVERED") {
      await tx.shipment.upsert({ where: { orderId: order.id }, update: { deliveredAt: now }, create: { orderId: order.id, deliveredAt: now } });
    }
    await tx.order.update({ where: { id: order.id }, data: { status: input.to } });
    await recordAudit(tx, actor, "ORDER_STATUS_CHANGED", "order", order.id, {
      orderNumber: order.orderNumber,
      from: order.status,
      to: input.to,
      ...(input.note ? { note: input.note } : {}),
      ...(restocked ? { restocked } : {}),
      ...(input.to === "SHIPPED" && input.trackingNumber ? { trackingNumber: input.trackingNumber } : {}),
    });
    return { status: input.to, restocked };
  });
  if (result.restocked) invalidateStorefront({ tags: ["catalog"], paths: ["/shop"] });
  // Customer emails/SMS and outbound webhooks, per Settings → Notifications.
  await notifyOrderStatus(input.orderId, input.to).catch((error) => console.error("[notifications] Status notice failed", error));
  return { status: result.status, restocked: result.restocked };
}

/** Corrects tracking details on an order that has already shipped. */
export async function updateShipment(actor: AdminActor, orderId: string, values: unknown) {
  const input = shipmentSchema.parse(values);
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: z.string().uuid().parse(orderId) }, select: { status: true, orderNumber: true } });
    if (!order) throw new AdminError("NOT_FOUND", "This order no longer exists.");
    if (order.status !== "SHIPPED" && order.status !== "DELIVERED") throw new AdminError("INVALID_STATE", "Tracking can be edited once the order has shipped.");
    const data = { carrier: input.carrier || null, trackingNumber: input.trackingNumber || null, trackingUrl: input.trackingUrl || null };
    await tx.shipment.upsert({ where: { orderId }, update: data, create: { orderId, ...data } });
    await recordAudit(tx, actor, "ORDER_STATUS_CHANGED", "order", orderId, { orderNumber: order.orderNumber, tracking: "updated" });
  });
}
