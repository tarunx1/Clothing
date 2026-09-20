"use client";

import type { Ref } from "react";
import { productConfig } from "@/config/product";
import type { PurchaseState } from "./useProductPurchase";
import styles from "./product.module.css";

const { copy } = productConfig;

const labels: Record<PurchaseState, string> = {
  select: copy.selectSize,
  ready: copy.addToBag,
  added: `${copy.added} ✓`,
  limit: copy.quantityLimit,
  "sold-out": copy.soldOut,
};

/**
 * Primary CTA. Without a size it looks disabled but stays clickable, so a
 * click can point the visitor at the size selector instead of doing nothing.
 * Sold out and quantity-limit states are truly disabled.
 */
export function AddToBagButton({ state, price, onClick, ref }: { state: PurchaseState; price?: string; onClick: () => void; ref?: Ref<HTMLButtonElement> }) {
  const blocked = state === "sold-out" || state === "limit";
  return (
    <button
      ref={ref}
      type="button"
      className={styles.primary}
      data-state={state}
      disabled={blocked}
      aria-disabled={state === "select" || undefined}
      onClick={onClick}
    >
      <span>{labels[state]}</span>
      {state === "ready" && price ? <span aria-hidden="true">{price}</span> : state === "ready" ? <span aria-hidden="true">+</span> : null}
    </button>
  );
}
