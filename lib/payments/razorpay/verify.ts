import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqualHex(expected: string, received: string) {
  if (!/^[a-f0-9]+$/i.test(received)) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Razorpay Checkout signature: HMAC-SHA256(`order_id|payment_id`, key secret). */
export function isValidCheckoutSignature(providerOrderId: string, providerPaymentId: string, signature: string, keySecret: string) {
  if (!keySecret || !providerOrderId || !providerPaymentId || !signature) return false;
  const expected = createHmac("sha256", keySecret).update(`${providerOrderId}|${providerPaymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Razorpay webhook signature: HMAC-SHA256(raw request body, webhook secret). */
export function isValidWebhookSignature(rawBody: string, signature: string, webhookSecret: string) {
  if (!webhookSecret || !signature) return false;
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
