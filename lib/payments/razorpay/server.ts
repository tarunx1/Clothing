import "server-only";
import { z } from "zod";
import {
  PaymentProviderError,
  PaymentVerificationError,
  type NormalizedWebhookEvent,
  type PaymentProvider,
  type ProviderPayment,
  type ProviderPaymentState,
} from "@/lib/payments/types";
import { isValidCheckoutSignature, isValidWebhookSignature } from "./verify";

const API = "https://api.razorpay.com/v1";

export interface RazorpayCredentials {
  mode: "test" | "live";
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

const paymentSchema = z.object({
  id: z.string(),
  order_id: z.string().nullable(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.string(),
  error_code: z.string().nullable().optional(),
  error_description: z.string().nullable().optional(),
});

const callbackSchema = z.object({
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(256),
});

const webhookSchema = z.object({
  event: z.string(),
  payload: z.object({ payment: z.object({ entity: paymentSchema }).optional() }).passthrough(),
});

const stateFor = (status: string): ProviderPaymentState => {
  switch (status) {
    case "captured": return "succeeded";
    case "authorized": return "authorized";
    case "failed": return "failed";
    case "refunded": return "refunded";
    default: return "pending";
  }
};

function normalize(entity: z.infer<typeof paymentSchema>): ProviderPayment {
  return {
    providerOrderId: entity.order_id ?? "",
    providerPaymentId: entity.id,
    amount: BigInt(entity.amount),
    currency: entity.currency,
    state: stateFor(entity.status),
    failureCode: entity.error_code ?? null,
    failureMessage: entity.error_description ?? null,
  };
}

async function request<T>(credentials: RazorpayCredentials, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const { keyId, keySecret } = credentials;
  if (!keyId || !keySecret) throw new PaymentProviderError("Razorpay credentials are not configured.");
  const response = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      "content-type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    // Only the status leaves this function; provider error bodies can echo request details.
    throw new PaymentProviderError(`Razorpay request failed (${response.status}).`, response.status);
  }
  return response.json() as Promise<T>;
}

/** Pulls the provider order id from a browser callback without trusting it (signature is checked later). */
export const razorpayReference = (input: unknown) =>
  input && typeof input === "object" && typeof (input as Record<string, unknown>).razorpay_order_id === "string" ? String((input as Record<string, unknown>).razorpay_order_id).slice(0, 64) : null;

/** Tries a webhook body against a signing secret without parsing it. */
export const razorpayWebhookMatches = (rawBody: string, headers: Headers, webhookSecret: string) => isValidWebhookSignature(rawBody, headers.get("x-razorpay-signature") ?? "", webhookSecret);

/** Razorpay adapter bound to one credential set (test or live). */
export const createRazorpayProvider = (credentials: RazorpayCredentials): PaymentProvider => ({
  id: "razorpay",
  mode: credentials.mode,

  isConfigured() {
    return Boolean(credentials.keyId && credentials.keySecret);
  },

  async createPaymentSession(session) {
    const order = await request<{ id: string; amount: number; currency: string }>(credentials, "/orders", {
      method: "POST",
      body: {
        amount: Number(session.amount),
        currency: session.currency,
        receipt: session.orderNumber,
        notes: { order_number: session.orderNumber },
      },
    });
    return { providerOrderId: order.id, amount: BigInt(order.amount), currency: order.currency };
  },

  clientInit(session, request) {
    return {
      provider: "razorpay",
      publicKey: credentials.keyId,
      reference: session.providerOrderId,
      amount: Number(session.amount),
      currency: session.currency,
      merchantName: request.merchantName,
      hiddenMethods: request.hiddenMethods ?? [],
      themeColor: request.themeColor,
      timeoutSeconds: request.timeoutSeconds ?? 15 * 60,
      description: `Order ${request.orderNumber}`,
      prefill: { name: request.customer.name, email: request.customer.email, ...(request.customer.phone ? { phone: request.customer.phone } : {}) },
    };
  },

  verifyPayment(input) {
    const parsed = callbackSchema.safeParse(input);
    if (!parsed.success) throw new PaymentVerificationError();
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;
    if (!isValidCheckoutSignature(orderId, paymentId, signature, credentials.keySecret)) throw new PaymentVerificationError();
    return { providerOrderId: orderId, providerPaymentId: paymentId, signature };
  },

  async fetchPayment(providerPaymentId) {
    return normalize(paymentSchema.parse(await request(credentials, `/payments/${encodeURIComponent(providerPaymentId)}`)));
  },

  async listOrderPayments(providerOrderId) {
    const body = z.object({ items: z.array(paymentSchema) }).parse(await request(credentials, `/orders/${encodeURIComponent(providerOrderId)}/payments`));
    return body.items.map(normalize);
  },

  async capturePayment(providerPaymentId, amount, currency) {
    const body = await request(credentials, `/payments/${encodeURIComponent(providerPaymentId)}/capture`, {
      method: "POST",
      body: { amount: Number(amount), currency },
    });
    return normalize(paymentSchema.parse(body));
  },

  parseWebhook(rawBody, headers): NormalizedWebhookEvent {
    const signature = headers.get("x-razorpay-signature") ?? "";
    if (!isValidWebhookSignature(rawBody, signature, credentials.webhookSecret)) throw new PaymentVerificationError("Webhook signature could not be verified.");
    const body = webhookSchema.parse(JSON.parse(rawBody));
    const entity = body.payload.payment?.entity;
    // Razorpay sends a unique id per event; retries of the same event reuse it.
    const eventId = headers.get("x-razorpay-event-id") || `${body.event}:${entity?.id ?? "unknown"}`;
    const payment = entity ? normalize(entity) : undefined;
    const kind = !payment
      ? "ignored"
      : body.event === "payment.captured" || body.event === "order.paid"
        ? "payment.succeeded"
        : body.event === "payment.authorized"
          ? "payment.authorized"
          : body.event === "payment.failed"
            ? "payment.failed"
            : "ignored";
    return { eventId, eventType: body.event, kind, payment };
  },

  async refundPayment(providerPaymentId, amount) {
    const refund = await request<{ id: string }>(credentials, `/payments/${encodeURIComponent(providerPaymentId)}/refund`, {
      method: "POST",
      body: amount === undefined ? {} : { amount: Number(amount) },
    });
    return { refundId: refund.id };
  },
});

/**
 * Server-side credential check for Admin → Test connection: lists one order.
 * 200 means the key pair is valid for its mode; nothing is created.
 */
export async function testRazorpayCredentials(credentials: Pick<RazorpayCredentials, "keyId" | "keySecret">) {
  const response = await fetch(`${API}/orders?count=1`, {
    headers: { authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString("base64")}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  return response.status;
}
