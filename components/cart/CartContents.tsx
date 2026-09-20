"use client";

import { useState } from "react";
import { cartConfig } from "@/config/cart";
import { useCart } from "@/hooks/useBag";
import { useDrawerClose } from "@/components/ui/Drawer";
import type { CartLineView } from "@/lib/cart";
import { CartItem } from "./CartItem";
import { CartSummary } from "./CartSummary";
import { EmptyCart } from "./EmptyCart";
import styles from "./cart.module.css";

/**
 * The bag's contents, shared by the drawer and the /cart page. The drawer
 * pins the summary in its footer (CartDrawer); the page lays it beside the list.
 */
export function CartContents({ variant }: { variant: "drawer" | "page" }) {
  const { items, subtotal, currency } = useCart();
  const close = useDrawerClose();
  const [announcement, setAnnouncement] = useState("");

  // After a removal, keep keyboard focus in the bag: next row, else the empty-state link.
  const handleRemoved = (line: CartLineView) => {
    setAnnouncement(`${line.product.name}, ${line.variant.size}, ${cartConfig.copy.removed}`);
    const index = items.findIndex((item) => item.id === line.id);
    requestAnimationFrame(() => {
      const scope = document.querySelector<HTMLElement>(`[data-cart-scope="${variant}"]`);
      const targets = scope ? Array.from(scope.querySelectorAll<HTMLElement>("[data-cart-focus]")) : [];
      (targets[Math.min(index, targets.length - 1)] ?? targets[0])?.focus();
    });
  };

  const status = <p className={styles.visuallyHidden} role="status">{announcement}</p>;

  if (!items.length) {
    return (
      <div data-cart-scope={variant}>
        <EmptyCart onNavigate={close ?? undefined} />
        {status}
      </div>
    );
  }

  const list = (
    <ul className={styles.list} aria-label="Items in your bag">
      {items.map((line) => (
        <CartItem key={line.id} line={line} variant={variant} onNavigate={close ?? undefined} onRemoved={handleRemoved} />
      ))}
    </ul>
  );

  if (variant === "drawer") {
    return <div data-cart-scope="drawer">{list}{status}</div>;
  }

  return (
    <div className={styles.layout} data-cart-scope="page">
      <section aria-labelledby="cart-items">
        <h2 id="cart-items" className={styles.visuallyHidden}>Items</h2>
        <div className={styles.columns} aria-hidden="true">
          <span>{cartConfig.copy.product}</span>
          <span>{cartConfig.copy.price}</span>
        </div>
        {list}
      </section>
      <aside className={styles.aside} aria-labelledby="order-summary">
        <h2 id="order-summary">{cartConfig.copy.orderSummary}</h2>
        <CartSummary subtotal={subtotal} currency={currency} />
      </aside>
      {status}
    </div>
  );
}
