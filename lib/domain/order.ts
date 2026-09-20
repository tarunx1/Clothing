import { DomainError } from "@/lib/errors";
import type { CurrencyCode } from "@/types/product";
import type { OrderItemSnapshot, OrderTotals } from "@/types/order";

export function validateRequestedQuantity(quantity: number, available: number): number {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainError("INVALID_QUANTITY", "Quantity must be a positive whole number.");
  }
  if (quantity > available) {
    throw new DomainError("OUT_OF_STOCK", "The requested quantity is no longer available.", { available });
  }
  return quantity;
}

export const calculateLineTotal = (unitPrice: number, quantity: number) => unitPrice * quantity;

export function calculateOrderTotals(
  subtotal: number,
  shipping: number,
  currency: CurrencyCode,
  tax = 0,
  discount = 0,
): OrderTotals {
  return { subtotal, shipping, tax, discount, total: subtotal + shipping + tax - discount, currency };
}

export function snapshotOrderItem(input: Omit<OrderItemSnapshot, "lineTotal">): OrderItemSnapshot {
  return { ...input, lineTotal: calculateLineTotal(input.unitPrice, input.quantity) };
}
