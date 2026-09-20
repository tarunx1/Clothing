"use client";

import { useEffect, useState, type RefObject } from "react";
import { formatMoney } from "@/lib/money";
import type { Product } from "@/types/product";
import { AddToBagButton } from "./AddToBagButton";
import type { ProductPurchase } from "./useProductPurchase";
import styles from "./product.module.css";

/**
 * Phones only (CSS): a compact bar that appears once the main CTA has scrolled
 * above the viewport. It calls the same purchase logic as the panel.
 */
export function MobilePurchaseBar({ product, purchase, ctaRef, hidden }: { product: Product; purchase: ProductPurchase; ctaRef: RefObject<HTMLButtonElement | null>; hidden: boolean }) {
  const [pastCta, setPastCta] = useState(false);

  // A scroll check (rAF-throttled) rather than an IntersectionObserver: jumps
  // straight past the CTA (anchors, restored scroll) never cross the viewport.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const cta = ctaRef.current;
      setPastCta(Boolean(cta && cta.getBoundingClientRect().bottom < 0));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ctaRef]);

  const visible = pastCta && !hidden;
  return (
    <div className={styles.bar} data-visible={visible || undefined} aria-hidden={!visible} inert={!visible}>
      <p className={styles.barPrice}>
        <small>{purchase.size ? `Size ${purchase.size}` : product.name}</small>
        {formatMoney(purchase.price, product.currency)}
      </p>
      <AddToBagButton state={purchase.state} onClick={purchase.add} />
    </div>
  );
}
