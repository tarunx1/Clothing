"use client";

import type { ClientPaymentInit, PaymentProviderId } from "@/lib/payments/types";
import type { CheckoutFormValues } from "@/types/checkout";
import type { CurrencyCode } from "@/types/product";

/** Provider-neutral outcome of the hosted payment window. */
export type ProviderCheckoutResult =
  | { type: "completed"; payload: Record<string, string> }
  | { type: "dismissed"; failed: boolean };

export type PaymentErrorKind = "unavailable" | "verification" | "stock" | "session" | "incomplete" | "rate" | "invalid";

export class PaymentFlowError extends Error {
  constructor(public readonly kind: PaymentErrorKind, message = kind) {
    super(message);
    this.name = "PaymentFlowError";
  }
}

export interface PaymentSession {
  init: ClientPaymentInit;
  orderNumber: string;
  quote: { subtotal: number; shipping: number; tax: number; total: number; currency: CurrencyCode };
}

export type PaymentOutcome =
  | { status: "confirmed"; confirmationPath: string }
  | { status: "processing"; confirmationPath: string }
  | { status: "cancelled" };

/** Browser adapters are loaded on demand so no provider script ships until payment starts. */
const adapters: Record<PaymentProviderId, () => Promise<{ openCheckout: (init: ClientPaymentInit) => Promise<ProviderCheckoutResult> }>> = {
  razorpay: () => import("./razorpay/client"),
};

const errorKinds: Record<string, PaymentErrorKind> = {
  OUT_OF_STOCK: "stock",
  VARIANT_NOT_FOUND: "stock",
  INVALID_QUANTITY: "stock",
  CART_NOT_FOUND: "session",
  SESSION_EXPIRED: "session",
  FORBIDDEN: "session",
  PAYMENT_VERIFICATION_FAILED: "verification",
  PAYMENT_FAILED: "incomplete",
  RATE_LIMITED: "rate",
  INVALID_REQUEST: "invalid",
};

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "same-origin" });
  } catch {
    throw new PaymentFlowError("unavailable");
  }
  const data = (await response.json().catch(() => null)) as (T & { error?: { code?: string; details?: { confirmationPath?: string } } }) | null;
  if (response.ok && data) return data;
  const code = data?.error?.code ?? "";
  if (code === "ORDER_ALREADY_PAID" && data?.error?.details?.confirmationPath) {
    return { status: "confirmed", confirmationPath: data.error.details.confirmationPath } as T;
  }
  throw new PaymentFlowError(errorKinds[code] ?? "unavailable");
}

export function createPaymentSession(values: CheckoutFormValues) {
  return post<PaymentSession | PaymentOutcome>("/api/checkout/payment/session", values);
}

export function openProviderCheckout(init: ClientPaymentInit) {
  return adapters[init.provider]().then((adapter) => adapter.openCheckout(init));
}

export function confirmPayment(payload: Record<string, string>) {
  return post<PaymentOutcome>("/api/checkout/payment/verify", { payload });
}

export function cancelPayment(reference: string) {
  return post<PaymentOutcome>("/api/checkout/payment/cancel", { reference });
}
