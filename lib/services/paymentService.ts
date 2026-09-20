import "server-only";
import { paymentConfig } from "@/config/payment";
import { prisma } from "@/lib/db/prisma";
import { withSerializableRetry } from "@/lib/db/transaction";
import { DomainError } from "@/lib/errors";
import { providerForPayment, providerForWebhook, referenceFromCallback, resolveCheckoutProvider } from "@/lib/payments/provider";
import { PaymentVerificationError, type ClientPaymentInit, type PaymentProvider, type ProviderPayment } from "@/lib/payments/types";
import { sendOrderConfirmation } from "@/lib/services/emailService";
import { getSettings } from "@/lib/settings/settingsService";
import { emitStoreEvent } from "@/lib/webhooks/dispatcher";
import { notifyOrderPaid } from "@/lib/notifications/notificationService";
import {
  commitOrderInventory,
  expireAbandonedOrders,
  isPaidStatus,
  prepareOrderForPayment,
  releaseOrderReservation,
} from "@/lib/services/orderService";
import type { CurrencyCode } from "@/types/product";

const major = (minor: bigint) => Number(minor) / 100;
const trimMessage = (value?: string | null) => (value ? value.slice(0, 240) : null);

export interface PaymentSessionResult {
  init: ClientPaymentInit;
  orderNumber: string;
  quote: { subtotal: number; shipping: number; tax: number; total: number; currency: CurrencyCode };
}

export type PaymentOutcome =
  | { status: "confirmed"; confirmationPath: string }
  | { status: "processing"; confirmationPath: string }
  | { status: "cancelled" };

/**
 * Validates and prices the order server-side, holds stock, and opens (or reuses)
 * a provider order for the server-calculated total. Only safe init data returns.
 */
export async function createCheckoutPaymentSession(sessionId: string, values: unknown, now = new Date()): Promise<PaymentSessionResult> {
  await expireAbandonedOrders(now).catch((error) => console.error("[payments] Reservation sweep failed", error));

  const order = await prepareOrderForPayment(sessionId, values, now);
  const provider = await resolveCheckoutProvider({ country: order.countryCode, currency: order.currency });
  if (!provider) {
    await withSerializableRetry((tx) => releaseOrderReservation(tx, order.orderId));
    throw new DomainError("PAYMENT_UNAVAILABLE", "Payment is temporarily unavailable.");
  }
  const [{ storeName }, methods, branding, inventory] = await Promise.all([getSettings("general"), getSettings("payments.methods"), getSettings("branding"), getSettings("inventory")]);
  const hiddenMethods = (["card", "upi", "netbanking", "wallet", "emi"] as const).filter((method) => !methods[method]).flatMap((method) => (method === "emi" ? ["emi", "paylater"] : [method]));
  const request = {
    orderNumber: order.orderNumber,
    merchantName: storeName,
    hiddenMethods,
    themeColor: branding.primaryColor,
    // The payment window closes a few minutes before the stock hold lapses.
    timeoutSeconds: Math.max(300, Math.min(15 * 60, (inventory.reservationMinutes - 5) * 60)),
    amount: order.total,
    currency: order.currency,
    customer: { name: order.customerName, email: order.email, phone: order.phone },
  };
  const reusable = await prisma.payment.findFirst({
    where: {
      orderId: order.orderId,
      provider: provider.id,
      mode: provider.mode,
      status: "CREATED",
      amount: order.total,
      currency: order.currency,
      createdAt: { gte: new Date(now.getTime() - paymentConfig.sessionReuseMinutes * 60_000) },
    },
    orderBy: { createdAt: "desc" },
  });

  let session;
  if (reusable) {
    session = { providerOrderId: reusable.providerOrderId, amount: reusable.amount, currency: reusable.currency };
  } else {
    try {
      session = await provider.createPaymentSession(request);
    } catch (error) {
      console.error("[payments] Provider session creation failed", error instanceof Error ? error.message : error);
      throw new DomainError("PAYMENT_UNAVAILABLE", "Payment could not be started. Try again.");
    }
    if (session.amount !== order.total || session.currency !== order.currency) {
      console.error("[payments] Provider session amount mismatch", { orderNumber: order.orderNumber });
      throw new DomainError("PAYMENT_UNAVAILABLE", "Payment could not be started. Try again.");
    }
    const created = session;
    await prisma.$transaction([
      prisma.payment.updateMany({ where: { orderId: order.orderId, status: { in: ["CREATED", "PENDING"] } }, data: { status: "CANCELLED" } }),
      prisma.payment.create({
        data: { orderId: order.orderId, provider: provider.id, mode: provider.mode, providerOrderId: created.providerOrderId, amount: order.total, currency: order.currency, status: "CREATED" },
      }),
    ]);
  }
  return {
    init: provider.clientInit(session, request),
    orderNumber: order.orderNumber,
    quote: { subtotal: major(order.subtotal), shipping: major(order.shippingAmount), tax: major(order.taxAmount), total: major(order.total), currency: order.currency },
  };
}

/**
 * The single, idempotent path to PAID. In one Serializable transaction it
 * reconciles the provider's amount/currency with the stored payment and order,
 * then marks Payment SUCCEEDED + Order PAID, commits inventory once, and
 * converts the draft and cart. Replays return the existing result unchanged.
 */
export async function finalizeSuccessfulPayment(payment: ProviderPayment & { signature?: string }) {
  if (payment.state !== "succeeded") throw new DomainError("PAYMENT_MISMATCH", "Payment has not succeeded.");
  const { statusAfterPayment } = await getSettings("orders");
  const result = await withSerializableRetry(async (tx) => {
    const record = await tx.payment.findUnique({ where: { providerOrderId: payment.providerOrderId }, include: { order: { include: { checkoutDraft: true } } } });
    if (!record) throw new DomainError("PAYMENT_MISMATCH", "Unknown payment.");
    const { order } = record;
    if (record.amount !== payment.amount || record.currency !== payment.currency || order.total !== payment.amount || order.currency !== payment.currency) {
      console.error("[payments] Amount/currency mismatch; order not marked paid", { orderNumber: order.orderNumber, providerOrderId: payment.providerOrderId });
      throw new DomainError("PAYMENT_MISMATCH", "Payment amount does not match the order.");
    }
    if (isPaidStatus(order.status)) {
      if (record.providerPaymentId && record.providerPaymentId !== payment.providerPaymentId) {
        console.error("[payments] Second captured payment on a paid order; refund required", { orderNumber: order.orderNumber });
      }
      return { orderId: order.id, orderNumber: order.orderNumber, publicToken: order.publicToken, newlyPaid: false };
    }
    const now = new Date();
    await tx.payment.update({
      where: { id: record.id },
      data: {
        status: "SUCCEEDED",
        providerPaymentId: payment.providerPaymentId,
        providerSignature: payment.signature ?? record.providerSignature,
        failureCode: null,
        failureMessage: null,
        succeededAt: now,
      },
    });
    await tx.payment.updateMany({ where: { orderId: order.id, id: { not: record.id }, status: { in: ["CREATED", "PENDING"] } }, data: { status: "CANCELLED" } });
    await commitOrderInventory(tx, order.id);
    await tx.order.update({ where: { id: order.id }, data: { status: statusAfterPayment === "PROCESSING" ? "PROCESSING" : "PAID", paidAt: now } });
    await tx.checkoutDraft.update({ where: { id: order.checkoutDraftId }, data: { status: "CONVERTED" } });
    // Detaching the session gives the shopper a fresh, empty bag on their next request.
    await tx.cart.update({ where: { id: order.checkoutDraft.cartId }, data: { status: "CHECKED_OUT", sessionId: null } });
    return { orderId: order.id, orderNumber: order.orderNumber, publicToken: order.publicToken, newlyPaid: true };
  });
  if (result.newlyPaid) {
    // Exactly once per order: emails, team notices, low-stock checks and outbound webhooks.
    await sendOrderConfirmation(result.orderId).catch((error) => console.error("[email] Confirmation failed", error));
    await notifyOrderPaid(result.orderId).catch((error) => console.error("[notifications] Paid-order notices failed", error));
    await emitStoreEvent("ORDER_PAID", { orderNumber: result.orderNumber, total: Number(payment.amount) / 100, currency: payment.currency }).catch(() => undefined);
  }
  return result;
}

/** Records a failed attempt. The order keeps its hold so the customer can retry in the same window. */
export async function recordFailedAttempt(payment: ProviderPayment) {
  await prisma.payment.updateMany({
    where: { providerOrderId: payment.providerOrderId, status: { in: ["CREATED", "PENDING", "FAILED"] } },
    data: { status: "FAILED", providerPaymentId: null, failureCode: trimMessage(payment.failureCode), failureMessage: trimMessage(payment.failureMessage) },
  });
}

async function settleProviderPayment(provider: PaymentProvider, remote: ProviderPayment, signature?: string): Promise<"succeeded" | "failed" | "pending"> {
  let current = remote;
  if (current.state === "authorized") {
    const record = await prisma.payment.findUnique({ where: { providerOrderId: current.providerOrderId }, include: { order: true } });
    if (!record || record.amount !== current.amount || record.currency !== current.currency || record.order.total !== current.amount) {
      console.error("[payments] Authorized amount mismatch; not capturing", { providerOrderId: current.providerOrderId });
      throw new DomainError("PAYMENT_MISMATCH", "Payment amount does not match the order.");
    }
    try {
      current = await provider.capturePayment(current.providerPaymentId, record.amount, record.currency);
    } catch (error) {
      // Auto-capture may have won the race; trust only a fresh provider read.
      current = await provider.fetchPayment(current.providerPaymentId);
      if (current.state === "authorized") throw error;
    }
  }
  if (current.state === "succeeded") {
    await finalizeSuccessfulPayment({ ...current, signature });
    return "succeeded";
  }
  if (current.state === "failed") {
    await recordFailedAttempt(current);
    return "failed";
  }
  return "pending";
}

/**
 * Browser callback after the provider UI reports success. The signature is
 * verified, then the payment is re-read from the provider API; the callback
 * alone never marks anything paid.
 */
export async function verifyClientPayment(input: unknown): Promise<PaymentOutcome> {
  // The payment's own provider and mode decide which secret verifies the signature.
  const reference = referenceFromCallback(input);
  const record = reference ? await prisma.payment.findUnique({ where: { providerOrderId: reference }, include: { order: true } }) : null;
  const provider = record ? await providerForPayment(record) : null;
  if (!record || !provider || record.provider !== provider.id) throw new DomainError("PAYMENT_VERIFICATION_FAILED", "Payment verification failed.");
  let callback;
  try {
    callback = provider.verifyPayment(input);
  } catch (error) {
    if (error instanceof PaymentVerificationError) console.warn("[payments] Rejected callback with invalid signature");
    throw new DomainError("PAYMENT_VERIFICATION_FAILED", "Payment verification failed.");
  }
  const confirmationPath = paymentConfig.confirmationPath(record.order.publicToken);
  if (isPaidStatus(record.order.status)) return { status: "confirmed", confirmationPath };

  let remote;
  try {
    remote = await provider.fetchPayment(callback.providerPaymentId);
  } catch (error) {
    // Signature is valid but the provider is unreachable: the webhook will settle it.
    console.error("[payments] Provider lookup failed during verification", error instanceof Error ? error.message : error);
    return { status: "processing", confirmationPath };
  }
  if (remote.providerOrderId !== callback.providerOrderId) {
    console.error("[payments] Callback payment belongs to another provider order", { providerOrderId: callback.providerOrderId });
    throw new DomainError("PAYMENT_VERIFICATION_FAILED", "Payment verification failed.");
  }
  let settled;
  try {
    settled = await settleProviderPayment(provider, remote, callback.signature);
  } catch (error) {
    if (error instanceof DomainError && error.code === "PAYMENT_MISMATCH") throw new DomainError("PAYMENT_VERIFICATION_FAILED", "Payment verification failed.");
    if (error instanceof DomainError) throw error;
    console.error("[payments] Settlement deferred to webhook", error instanceof Error ? error.message : error);
    return { status: "processing", confirmationPath };
  }
  if (settled === "failed") throw new DomainError("PAYMENT_FAILED", "Payment could not be completed.");
  return { status: settled === "succeeded" ? "confirmed" : "processing", confirmationPath };
}

/**
 * Customer closed the provider UI. Reconciles with the provider first (a
 * payment may have completed at the last second), otherwise marks the attempt
 * failed/cancelled, flags the order PAYMENT_FAILED, and releases held stock.
 * The cart is untouched so the customer can retry.
 */
export async function cancelCheckoutPayment(sessionId: string, reference: string): Promise<PaymentOutcome> {
  const record = await prisma.payment.findUnique({ where: { providerOrderId: reference }, include: { order: { include: { checkoutDraft: { include: { cart: true } } } } } });
  if (!record) return { status: "cancelled" };
  const provider = await providerForPayment(record);
  if (record.order.checkoutDraft.cart.sessionId !== sessionId && !isPaidStatus(record.order.status)) {
    throw new DomainError("FORBIDDEN", "This payment belongs to another session.");
  }
  const confirmationPath = paymentConfig.confirmationPath(record.order.publicToken);
  if (isPaidStatus(record.order.status)) return { status: "confirmed", confirmationPath };

  let attempts: ProviderPayment[] = [];
  try {
    if (provider) attempts = await provider.listOrderPayments(reference);
  } catch (error) {
    console.error("[payments] Provider lookup failed during cancellation", error instanceof Error ? error.message : error);
  }
  const live = attempts.find((attempt) => attempt.state === "succeeded") ?? attempts.find((attempt) => attempt.state === "authorized");
  if (live && provider) {
    const settled = await settleProviderPayment(provider, live);
    if (settled === "succeeded") return { status: "confirmed", confirmationPath };
  }
  const failed = attempts.find((attempt) => attempt.state === "failed");
  return withSerializableRetry(async (tx) => {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: record.id }, include: { order: true } });
    if (isPaidStatus(payment.order.status)) return { status: "confirmed" as const, confirmationPath };
    if (payment.status !== "SUCCEEDED" && payment.status !== "REFUNDED") {
      await tx.payment.update({
        where: { id: payment.id },
        data: failed || payment.status === "FAILED"
          ? { status: "FAILED", failureCode: trimMessage(failed?.failureCode) ?? payment.failureCode, failureMessage: trimMessage(failed?.failureMessage) ?? payment.failureMessage }
          : { status: "CANCELLED" },
      });
    }
    await releaseOrderReservation(tx, payment.orderId);
    if (payment.order.status === "AWAITING_PAYMENT") await tx.order.update({ where: { id: payment.orderId }, data: { status: "PAYMENT_FAILED" } });
    return { status: "cancelled" as const };
  });
}

/**
 * Provider webhook. Signature is checked over the raw body; each provider event
 * id is processed once. Only identifiers are stored, never the payload.
 */
export async function handlePaymentWebhook(rawBody: string, headers: Headers): Promise<{ duplicate: boolean }> {
  // Whichever mode's secret signed the body identifies the credential set (test and live never mix).
  const provider = await providerForWebhook(rawBody, headers);
  if (!provider) throw new PaymentVerificationError("Webhook signature could not be verified.");
  const event = provider.parseWebhook(rawBody, headers);
  const key = { provider_eventId: { provider: provider.id, eventId: event.eventId } };
  const logged = await prisma.webhookEvent.upsert({ where: key, update: {}, create: { provider: provider.id, eventId: event.eventId, eventType: event.eventType } });
  if (logged.processedAt) return { duplicate: true };

  const payment = event.payment;
  const known = payment?.providerOrderId ? await prisma.payment.findUnique({ where: { providerOrderId: payment.providerOrderId }, select: { id: true, mode: true } }) : null;
  if (known && known.mode && known.mode !== provider.mode) {
    console.error("[payments] Webhook mode does not match the payment's mode; ignored", { eventId: event.eventId });
  } else if (payment && known && event.kind !== "ignored") {
    try {
      if (event.kind === "payment.failed") await recordFailedAttempt(payment);
      else await settleProviderPayment(provider, payment);
    } catch (error) {
      if (!(error instanceof DomainError && error.code === "PAYMENT_MISMATCH")) throw error;
      // Mismatches are logged in the service and must not be retried into PAID.
    }
  }
  await prisma.webhookEvent.update({ where: key, data: { processedAt: new Date() } });
  return { duplicate: false };
}
