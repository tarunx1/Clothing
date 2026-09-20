import type { OrderStatus } from "@prisma/client";

/**
 * Every status change an admin may make. Payment-driven states (PAID,
 * PAYMENT_FAILED, EXPIRED) are only ever set by the payment service; refunds
 * arrive with the refund feature. Anything not listed is refused.
 */
export const ADMIN_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  DRAFT: [],
  AWAITING_PAYMENT: ["CANCELLED"],
  PAYMENT_FAILED: ["CANCELLED"],
  EXPIRED: [],
  PAID: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export const canTransitionOrder = (from: OrderStatus, to: OrderStatus) => ADMIN_ORDER_TRANSITIONS[from].includes(to);

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: "Draft",
  AWAITING_PAYMENT: "Awaiting payment",
  PAYMENT_FAILED: "Payment failed",
  EXPIRED: "Expired",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

/** Fulfilment stage shown in order lists, derived from the order status. */
export function fulfilmentLabel(status: OrderStatus) {
  switch (status) {
    case "PAID": return "Unfulfilled";
    case "PROCESSING": return "Processing";
    case "SHIPPED": return "Shipped";
    case "DELIVERED": return "Delivered";
    case "CANCELLED": return "Cancelled";
    default: return "—";
  }
}
