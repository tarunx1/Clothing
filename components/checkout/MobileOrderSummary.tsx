"use client";

import { useId, useState } from "react";
import { checkoutConfig } from "@/config/checkout";
import { formatMoney } from "@/lib/money";
import type { CartLineView } from "@/lib/cart";
import type { CurrencyCode } from "@/types/product";
import { CheckoutOrderSummary, type TaxSummary } from "./CheckoutOrderSummary";
import styles from "./checkout.module.css";

export function MobileOrderSummary({ items, subtotal, shipping, currency, tax }: { items: CartLineView[]; subtotal: number; shipping: number; currency: CurrencyCode; tax?: TaxSummary }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className={styles.mobileSummary}>
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
        <span>{checkoutConfig.copy.summary}<small>{open ? "Hide" : "View"}</small></span>
        <strong>{formatMoney(subtotal + shipping + (tax && !tax.included ? tax.amount : 0), currency)}<svg viewBox="0 0 12 8" aria-hidden="true"><path d="m1 1 5 5 5-5" /></svg></strong>
      </button>
      <div id={panelId} hidden={!open}><CheckoutOrderSummary tax={tax} items={items} subtotal={subtotal} shipping={shipping} currency={currency} /></div>
    </div>
  );
}
