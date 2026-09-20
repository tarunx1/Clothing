/** Server-side payment timing and abuse limits. Values are safe to read on the client. */
export const paymentConfig = {
  /** How long stock stays reserved for an order awaiting payment. */
  reservationMinutes: 30,
  /** Provider checkout closes itself before the reservation lapses. */
  providerTimeoutSeconds: 15 * 60,
  /** A still-open provider order for the same amount is reused within this window. */
  sessionReuseMinutes: 20,
  /** Payment session creation attempts per client per window. */
  rateLimit: { limit: 8, windowMs: 10 * 60 * 1000 },
  /** Webhook delivery log retention; only identifiers are stored. */
  webhookRetentionDays: 30,
  confirmationPath: (publicToken: string) => `/order/confirmation/${publicToken}`,
} as const;

export const PAID_ORDER_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "REFUNDED"] as const;
