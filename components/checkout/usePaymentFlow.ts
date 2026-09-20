"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import {
  cancelPayment,
  confirmPayment,
  createPaymentSession,
  openProviderCheckout,
  PaymentFlowError,
  type PaymentErrorKind,
  type PaymentOutcome,
  type PaymentSession,
} from "@/lib/payments/client";
import type { CheckoutFormValues } from "@/types/checkout";

export type PaymentPhase = "idle" | "preparing" | "open" | "verifying" | "redirecting";

const isOutcome = (value: PaymentSession | PaymentOutcome): value is PaymentOutcome => "status" in value;

/**
 * Drives one payment attempt: server session → provider window → server
 * verification → confirmation. The ref guard makes repeat clicks inert, so a
 * single attempt can never open two provider sessions.
 */
export function usePaymentFlow(onQuote: (quote: PaymentSession["quote"]) => void) {
  const router = useRouter();
  const [phase, setPhase] = useState<PaymentPhase>("idle");
  const [error, setError] = useState<PaymentErrorKind | null>(null);
  const inFlight = useRef(false);

  const start = useCallback(async (values: CheckoutFormValues) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setPhase("preparing");
    let reference: string | null = null;
    const redirect = (path: string) => {
      setPhase("redirecting");
      router.replace(path);
    };
    try {
      const session = await createPaymentSession(values);
      if (isOutcome(session)) {
        if (session.status === "cancelled") throw new PaymentFlowError("incomplete");
        return redirect(session.confirmationPath);
      }
      onQuote(session.quote);
      reference = session.init.reference;
      setPhase("open");
      const result = await openProviderCheckout(session.init);
      if (result.type === "dismissed") {
        const outcome = await cancelPayment(reference).catch((): PaymentOutcome => ({ status: "cancelled" }));
        reference = null;
        if (outcome.status !== "cancelled") return redirect(outcome.confirmationPath);
        throw new PaymentFlowError("incomplete");
      }
      reference = null;
      setPhase("verifying");
      const outcome = await confirmPayment(result.payload);
      if (outcome.status === "cancelled") throw new PaymentFlowError("incomplete");
      redirect(outcome.confirmationPath);
    } catch (caught) {
      // Provider script failed to load after a session was opened: free the held stock.
      if (reference) void cancelPayment(reference).catch(() => undefined);
      setError(caught instanceof PaymentFlowError ? caught.kind : "unavailable");
      setPhase("idle");
      inFlight.current = false;
    }
  }, [onQuote, router]);

  return { phase, error, start, busy: phase !== "idle" };
}
