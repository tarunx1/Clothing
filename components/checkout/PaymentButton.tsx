"use client";

import { checkoutConfig } from "@/config/checkout";
import type { PaymentPhase } from "./usePaymentFlow";
import styles from "./checkout.module.css";

const labels: Record<Exclude<PaymentPhase, "idle">, string> = checkoutConfig.copy.paymentPhases;

interface PaymentButtonProps {
  phase: PaymentPhase;
  validating: boolean;
  retry: boolean;
}

/**
 * Submit control for the checkout form. It stays focusable while busy
 * (aria-disabled instead of disabled) so keyboard focus is never lost.
 */
export function PaymentButton({ phase, validating, retry }: PaymentButtonProps) {
  const busy = phase !== "idle" || validating;
  const label = phase !== "idle" ? labels[phase] : retry ? checkoutConfig.copy.retry : checkoutConfig.copy.submit;
  return (
    <button
      type="submit"
      className={styles.submit}
      aria-disabled={busy || undefined}
      aria-describedby="checkout-payment-status"
      data-busy={busy || undefined}
      onClick={(event) => { if (busy) event.preventDefault(); }}
    >
      <span>{label}</span>
      {busy ? <span className={styles.spinner} aria-hidden="true" /> : <svg viewBox="0 0 20 12" aria-hidden="true"><path d="M1 6h17M13 1l5 5-5 5" /></svg>}
    </button>
  );
}
