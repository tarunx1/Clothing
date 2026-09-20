"use client";

import Link from "next/link";
import { useId } from "react";
import { cartConfig } from "@/config/cart";
import { formatMoney } from "@/lib/money";
import type { CurrencyCode } from "@/types/product";
import styles from "./cart.module.css";

const { copy } = cartConfig;

interface CartSummaryProps {
  subtotal: number;
  currency: CurrencyCode;
  /** Drawer: "Continue shopping" closes it. Page: it links to the shop. */
  onContinue?: () => void;
}

/**
 * Subtotal, the shipping note and the two actions. No discounts, taxes or
 * shipping amounts are shown until real logic exists.
 */
export function CartSummary({ subtotal, currency, onContinue }: CartSummaryProps) {
  const noteId = useId();
  const ready = cartConfig.checkoutEnabled;
  return (
    <div className={styles.summary}>
      <p className={styles.row}>
        <span>{copy.subtotal}</span>
        <strong>{formatMoney(subtotal, currency)}</strong>
      </p>
      <p className={styles.row}>
        <span className={styles.muted}>{copy.shipping}</span>
        <span className={styles.muted}>{copy.shippingNote}</span>
      </p>
      {ready ? (
        <Link href={cartConfig.checkoutHref} className={styles.primary}>
          {copy.checkout} <span aria-hidden="true">→</span>
        </Link>
      ) : (
        // The checkout route is not built yet: the CTA stays focusable and explains why.
        <button type="button" className={styles.primary} aria-disabled="true" aria-describedby={noteId}>
          {copy.checkout} <span aria-hidden="true">→</span>
        </button>
      )}
      {!ready ? <p id={noteId} className={styles.fine}>{copy.checkoutSoon}</p> : null}
      {onContinue ? (
        <button type="button" className={styles.secondary} onClick={onContinue}>{copy.continue}</button>
      ) : (
        <Link href={cartConfig.continueHref} className={styles.secondary}>{copy.continue}</Link>
      )}
    </div>
  );
}
