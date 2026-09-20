"use client";

import { updateQuantity } from "@/hooks/useBag";
import type { CartItemId } from "@/lib/cart";
import styles from "./cart.module.css";

/** − n + : never below 1 (removal is explicit), never above available stock. */
export function CartQuantity({ id, quantity, limit, label }: { id: CartItemId; quantity: number; limit: number; label: string }) {
  return (
    <div className={styles.quantity} role="group" aria-label={`Quantity, ${label}`}>
      <button type="button" aria-label={`Decrease quantity of ${label}`} disabled={quantity <= 1} onClick={() => updateQuantity(id, quantity - 1)}>
        −
      </button>
      <output aria-live="polite" aria-label={`Quantity ${quantity}`}>{quantity}</output>
      <button type="button" aria-label={`Increase quantity of ${label}`} disabled={quantity >= limit} onClick={() => updateQuantity(id, quantity + 1)}>
        +
      </button>
    </div>
  );
}
