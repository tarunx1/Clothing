import "server-only";
import { getSecret, getSettings } from "@/lib/settings/settingsService";
import { createRazorpayProvider, razorpayReference, razorpayWebhookMatches, type RazorpayCredentials } from "./razorpay/server";
import type { PaymentProvider, PaymentProviderId } from "./types";

export type PaymentMode = "test" | "live";
const PROVIDERS = ["razorpay", "stripe", "paypal"] as const;
type AnyProvider = (typeof PROVIDERS)[number];

/** Providers with a checkout adapter in this codebase. Others can be configured but are never routed to. */
export const CHECKOUT_ADAPTERS: readonly AnyProvider[] = ["razorpay"];

let credentialOverride: Partial<Record<PaymentMode, RazorpayCredentials>> | null = null;
let providerOverride: PaymentProvider | null = null;

/**
 * Razorpay credentials for a mode: Admin → Settings → Payments first, then the
 * deployment environment (RAZORPAY_*) as a fallback, but only when the key's
 * prefix matches the mode so test keys never serve live payments.
 */
export async function razorpayCredentials(mode?: PaymentMode): Promise<RazorpayCredentials | null> {
  const settings = await getSettings("payments.razorpay");
  const resolved: PaymentMode = mode ?? settings.mode;
  if (credentialOverride) return credentialOverride[resolved] ?? null;
  const [keySecret, webhookSecret] = await Promise.all([
    getSecret("payments.razorpay", resolved === "live" ? "liveKeySecret" : "testKeySecret"),
    getSecret("payments.razorpay", resolved === "live" ? "liveWebhookSecret" : "testWebhookSecret"),
  ]);
  const keyId = resolved === "live" ? settings.liveKeyId : settings.testKeyId;
  if (keyId && keySecret) return { mode: resolved, keyId, keySecret, webhookSecret: webhookSecret ?? "" };
  const envKey = process.env.RAZORPAY_KEY_ID ?? "";
  if (envKey.startsWith(resolved === "live" ? "rzp_live_" : "rzp_test_") && process.env.RAZORPAY_KEY_SECRET) {
    return { mode: resolved, keyId: envKey, keySecret: process.env.RAZORPAY_KEY_SECRET, webhookSecret: webhookSecret ?? process.env.RAZORPAY_WEBHOOK_SECRET ?? "" };
  }
  return null;
}

export async function credentialSource(mode: PaymentMode): Promise<"settings" | "environment" | "none"> {
  if (credentialOverride) return credentialOverride[mode] ? "settings" : "none";
  const settings = await getSettings("payments.razorpay");
  const keyId = mode === "live" ? settings.liveKeyId : settings.testKeyId;
  if (keyId && (await getSecret("payments.razorpay", mode === "live" ? "liveKeySecret" : "testKeySecret"))) return "settings";
  return (process.env.RAZORPAY_KEY_ID ?? "").startsWith(mode === "live" ? "rzp_live_" : "rzp_test_") && process.env.RAZORPAY_KEY_SECRET ? "environment" : "none";
}

async function providerFor(id: PaymentProviderId, mode: PaymentMode): Promise<PaymentProvider | null> {
  if (providerOverride) return providerOverride.id === id ? providerOverride : null;
  if (id !== "razorpay") return null;
  const credentials = await razorpayCredentials(mode);
  return credentials ? createRazorpayProvider(credentials) : null;
}

/**
 * Picks the payment provider for a checkout: first matching routing rule, then
 * priority order. Only enabled providers with an installed adapter and complete
 * credentials for their current mode qualify.
 */
export async function resolveCheckoutProvider(context: { country?: string | null; currency: string }): Promise<PaymentProvider | null> {
  if (providerOverride) return providerOverride;
  const routing = await getSettings("payments.routing");
  const candidates = async (id: AnyProvider) => {
    if (!CHECKOUT_ADAPTERS.includes(id)) return null;
    const settings = await getSettings(`payments.${id}` as "payments.razorpay");
    if (!settings.enabled) return null;
    return providerFor(id as PaymentProviderId, settings.mode);
  };
  for (const rule of routing.rules) {
    const countryOk = !rule.countries.length || (context.country && rule.countries.includes(context.country.toUpperCase()));
    const currencyOk = !rule.currencies.length || rule.currencies.includes(context.currency.toUpperCase());
    if (countryOk && currencyOk) {
      const provider = await candidates(rule.provider);
      if (provider) return provider;
    }
  }
  for (const id of routing.priority as AnyProvider[]) {
    const provider = await candidates(id);
    if (provider) return provider;
  }
  return null;
}

/** The provider instance that owns an existing payment (its recorded provider and mode). */
export async function providerForPayment(payment: { provider: string; mode: string | null }): Promise<PaymentProvider | null> {
  return providerFor(payment.provider as PaymentProviderId, payment.mode === "live" ? "live" : "test");
}

/** Provider order id from a browser callback, before any verification. */
export const referenceFromCallback = (input: unknown) => razorpayReference(input);

/** Finds which mode's webhook secret signed this body. Returns null when none match. */
export async function providerForWebhook(rawBody: string, headers: Headers): Promise<PaymentProvider | null> {
  if (providerOverride) return providerOverride;
  for (const mode of ["live", "test"] as const) {
    const credentials = await razorpayCredentials(mode);
    if (credentials?.webhookSecret && razorpayWebhookMatches(rawBody, headers, credentials.webhookSecret)) return createRazorpayProvider(credentials);
  }
  return null;
}

export async function isWebhookConfigured() {
  if (providerOverride || credentialOverride) return true;
  const [test, live] = await Promise.all([razorpayCredentials("test"), razorpayCredentials("live")]);
  return Boolean(test?.webhookSecret || live?.webhookSecret);
}

/** Test seams: fixed credentials or a whole mock provider. Never used by application code. */
export function setPaymentCredentialsForTesting(credentials: Partial<Record<PaymentMode, RazorpayCredentials>> | null) {
  credentialOverride = credentials;
}
export function setPaymentProviderForTesting(provider: PaymentProvider | null) {
  providerOverride = provider;
}
