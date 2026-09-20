"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { checkoutConfig } from "@/config/checkout";
import type { PaymentErrorKind } from "@/lib/payments/client";
import type { PaymentPhase } from "./usePaymentFlow";
import styles from "./checkout.module.css";

/** Announces payment progress politely and errors assertively, moving focus to critical errors. */
export function PaymentStatus({ phase, error }: { phase: PaymentPhase; error: PaymentErrorKind | null }) {
  const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);
  const message = error ? checkoutConfig.copy.paymentErrors[error] : null;
  return (
    <>
      <p id="checkout-payment-status" className="sr-only" role="status">
        {phase !== "idle" ? checkoutConfig.copy.paymentPhases[phase] : ""}
      </p>
      <div ref={alertRef} className={styles.paymentError} role="alert" tabIndex={-1} hidden={!message}>
        {message ? (
          <>
            <strong>{message.title}</strong>
            <p>
              {message.body}
              {error === "stock" ? <> <Link href={checkoutConfig.editBagHref}>{checkoutConfig.copy.reviewBag}</Link></> : null}
            </p>
          </>
        ) : null}
      </div>
    </>
  );
}
