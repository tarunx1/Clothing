import type { CurrencyCode } from "@/types/product";

/** Providers the store can route payments through. Add new gateways here. */
export type PaymentProviderId = "razorpay";

/** Normalized provider-side payment state. Gateway-specific states never leave the adapter. */
export type ProviderPaymentState = "pending" | "authorized" | "succeeded" | "failed" | "refunded";

export interface PaymentSessionRequest {
  orderNumber: string;
  merchantName: string;
  /** Methods switched off in Settings → Payments (provider-specific names). */
  hiddenMethods?: string[];
  themeColor?: string;
  timeoutSeconds?: number;
  amount: bigint;
  currency: CurrencyCode;
  customer: { name: string; email: string; phone?: string | null };
}

/** Provider order/session created server-side for a single order total. */
export interface ProviderSession {
  providerOrderId: string;
  amount: bigint;
  currency: string;
}

/** Customer-safe checkout initialization data. Contains no secrets. */
export interface ClientPaymentInit {
  provider: PaymentProviderId;
  publicKey: string;
  reference: string;
  amount: number;
  currency: string;
  merchantName: string;
  description: string;
  prefill: { name: string; email: string; phone?: string };
  hiddenMethods: string[];
  themeColor?: string;
  /** The window closes itself before the stock reservation lapses. */
  timeoutSeconds: number;
}

/** Result of verifying a browser callback signature. Not a payment success by itself. */
export interface VerifiedCallback {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

/** Authoritative payment state fetched from the provider API. */
export interface ProviderPayment {
  providerOrderId: string;
  providerPaymentId: string;
  amount: bigint;
  currency: string;
  state: ProviderPaymentState;
  failureCode?: string | null;
  failureMessage?: string | null;
}

export type WebhookEventKind = "payment.authorized" | "payment.succeeded" | "payment.failed" | "ignored";

export interface NormalizedWebhookEvent {
  eventId: string;
  eventType: string;
  kind: WebhookEventKind;
  payment?: ProviderPayment;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  /** Credential set this instance uses. Test and live never share an instance. */
  readonly mode: "test" | "live";
  /** True when the server has every credential this provider needs. */
  isConfigured(): boolean;
  createPaymentSession(request: PaymentSessionRequest): Promise<ProviderSession>;
  clientInit(session: ProviderSession, request: PaymentSessionRequest): ClientPaymentInit;
  /** Checks the browser callback signature. Throws PaymentVerificationError when invalid. */
  verifyPayment(input: unknown): VerifiedCallback;
  fetchPayment(providerPaymentId: string): Promise<ProviderPayment>;
  listOrderPayments(providerOrderId: string): Promise<ProviderPayment[]>;
  capturePayment(providerPaymentId: string, amount: bigint, currency: string): Promise<ProviderPayment>;
  /** Verifies the webhook signature over the raw body and normalizes the event. */
  parseWebhook(rawBody: string, headers: Headers): NormalizedWebhookEvent;
  refundPayment?(providerPaymentId: string, amount?: bigint): Promise<{ refundId: string }>;
}

export class PaymentVerificationError extends Error {
  constructor(message = "Payment signature could not be verified.") {
    super(message);
    this.name = "PaymentVerificationError";
  }
}

export class PaymentProviderError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
