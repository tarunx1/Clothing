"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { checkoutConfig } from "@/config/checkout";
import { useBag, useBagReady, useCart } from "@/hooks/useBag";
import { CheckoutForm } from "./CheckoutForm";
import { CheckoutHeader } from "./CheckoutHeader";
import { CheckoutOrderSummary } from "./CheckoutOrderSummary";
import { MobileOrderSummary } from "./MobileOrderSummary";
import styles from "./checkout.module.css";
import type { CheckoutPolicy } from "@/lib/services/storePolicy";
import { methodsFor } from "@/lib/domain/shipping";
import { computeTax } from "@/lib/domain/tax";

export function CheckoutPage({ storeName, policy }: { storeName: string; policy: CheckoutPolicy }) {
  const { rules, storeNotice } = policy;
  const ready = useBagReady();
  const lines = useBag();
  const { items, subtotal, currency } = useCart();
  const [serverSubtotal, setServerSubtotal] = useState<number | null>(null);
  const [deliveryId, setDeliveryId] = useState(checkoutConfig.defaultValues.deliveryMethodId);
  const [address, setAddress] = useState({ country: rules.allowedCountries.includes(policy.defaultCountry) ? policy.defaultCountry : rules.allowedCountries[0], region: "" });
  const onAddressChange = useCallback((country: string, region: string) => setAddress((old) => old.country === country && old.region === region ? old : { country, region }), []);
  const onDeliveryChange = useCallback((id: string) => setDeliveryId(id), []);
  const syncKey = useMemo(() => JSON.stringify(lines), [lines]);
  useEffect(() => {
    if (!ready || !lines.length) return;
    const controller = new AbortController();
    fetch("/api/cart", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines }),
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("Cart sync failed");
      const quote = await response.json() as { subtotal: number };
      setServerSubtotal(quote.subtotal);
    }).catch((error) => { if (error.name !== "AbortError") setServerSubtotal(null); });
    return () => controller.abort();
  }, [ready, syncKey, lines]);
  const authoritativeSubtotal = serverSubtotal ?? subtotal;
  const deliveryMethods = useMemo(() => methodsFor({ ...policy, ...address, subtotal: Math.round(authoritativeSubtotal * 100), currency }).map((method) => ({ id: method.code.toLowerCase(), label: method.name, estimate: `${method.minDays}–${method.maxDays} business days`, price: method.rate / 100 })), [policy, address, authoritativeSubtotal, currency]);
  const shipping = (deliveryMethods.find((method) => method.id === deliveryId) ?? deliveryMethods[0])?.price ?? 0;
  const calculatedTax = computeTax(policy.tax, { ...address, amount: Math.round(authoritativeSubtotal * 100) });
  const tax = { amount: calculatedTax.amount / 100, included: calculatedTax.inclusive, label: policy.tax.label };

  return (
    <main className={styles.page} data-checkout-page data-paper-surface>
      <CheckoutHeader storeName={storeName} />
      {storeNotice ? <p className={styles.kicker} role="note">{storeNotice}</p> : null}
      {!ready ? <div className={styles.loading} aria-live="polite">Loading your bag…</div> : null}
      {ready && !items.length ? (
        <section className={styles.empty}>
          <p>Checkout</p>
          <h1 className="display-type">{checkoutConfig.copy.empty}</h1>
          <Link href={checkoutConfig.returnHref}>{checkoutConfig.copy.returnToShop}<svg viewBox="0 0 20 12" aria-hidden="true"><path d="M1 6h17M13 1l5 5-5 5" /></svg></Link>
        </section>
      ) : null}
      {ready && items.length ? (
        <>
          <MobileOrderSummary tax={tax} items={items} subtotal={authoritativeSubtotal} shipping={shipping} currency={currency} />
          <div className={styles.layout}>
            <div className={styles.formColumn}>
              <p className={styles.kicker}>Secure checkout / {items.reduce((sum, item) => sum + item.quantity, 0)} {items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? "piece" : "pieces"}</p>
              <h1 className={`display-type ${styles.title}`}>{checkoutConfig.copy.title}</h1>
              <CheckoutForm defaultCountry={policy.defaultCountry} onAddressChange={onAddressChange} rules={rules} deliveryMethods={deliveryMethods} currency={currency} onDeliveryChange={onDeliveryChange} onQuote={(quote) => setServerSubtotal(quote.subtotal)} />
            </div>
            <aside className={styles.aside}>
              <CheckoutOrderSummary tax={tax} items={items} subtotal={authoritativeSubtotal} shipping={shipping} currency={currency} labelledBy="desktop-order-summary" />
            </aside>
          </div>
        </>
      ) : null}
    </main>
  );
}
