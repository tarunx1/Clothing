"use client";

import type { ClientPaymentInit } from "@/lib/payments/types";
import type { ProviderCheckoutResult } from "@/lib/payments/client";

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (response: { error?: { description?: string } }) => void): void;
}
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

let scriptPromise: Promise<RazorpayConstructor> | null = null;

function loadScript(): Promise<RazorpayConstructor> {
  const existing = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
  if (existing) return Promise.resolve(existing);
  scriptPromise ??= new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      const loaded = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
      if (loaded) resolve(loaded);
      else reject(new Error("Payment window unavailable."));
    };
    script.onerror = () => {
      scriptPromise = null;
      script.remove();
      reject(new Error("Payment window unavailable."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Opens Razorpay Checkout and settles once: success payload, or dismissal. */
export async function openCheckout(init: ClientPaymentInit): Promise<ProviderCheckoutResult> {
  const Razorpay = await loadScript();
  return new Promise((resolve) => {
    let settled = false;
    let lastFailure: string | undefined;
    const finish = (result: ProviderCheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const checkout = new Razorpay({
      key: init.publicKey,
      order_id: init.reference,
      amount: init.amount,
      currency: init.currency,
      name: init.merchantName,
      description: init.description,
      prefill: { name: init.prefill.name, email: init.prefill.email, contact: init.prefill.phone },
      theme: { color: init.themeColor ?? "#0a0a0a" },
      // Methods switched off in Settings → Payments are hidden in the window.
      ...(init.hiddenMethods.length ? { config: { display: { hide: init.hiddenMethods.map((method) => ({ method })), preferences: { show_default_blocks: true } } } } : {}),
      timeout: init.timeoutSeconds,
      retry: { enabled: true },
      modal: { escape: true, backdropclose: false, ondismiss: () => finish({ type: "dismissed", failed: Boolean(lastFailure) }) },
      handler: (response: Record<string, string>) => finish({ type: "completed", payload: response }),
    });
    // The window stays open after a failed attempt so the customer can retry inside it.
    checkout.on("payment.failed", (response) => { lastFailure = response.error?.description ?? "failed"; });
    checkout.open();
  });
}
