import Link from "next/link";
import { checkoutConfig } from "@/config/checkout";
import { formatMoney } from "@/lib/money";
import type { CartLineView } from "@/lib/cart";
import type { CurrencyCode } from "@/types/product";
import { CheckoutItem } from "./CheckoutItem";
import styles from "./checkout.module.css";

export interface TaxSummary { amount: number; included: boolean; label: string }
interface SummaryProps {
  tax?: TaxSummary;
  items: CartLineView[];
  subtotal: number;
  shipping: number;
  currency: CurrencyCode;
  labelledBy?: string;
}

export function CheckoutOrderSummary({ items, subtotal, shipping, currency, labelledBy, tax }: SummaryProps) {
  const { copy } = checkoutConfig;
  return (
    <section className={styles.summary} aria-labelledby={labelledBy}>
      <div className={styles.summaryHead}>
        <h2 id={labelledBy}>{copy.summary}</h2>
        <Link href={checkoutConfig.editBagHref}>{copy.editBag}</Link>
      </div>
      <ul className={styles.items}>{items.map((item) => <CheckoutItem key={item.id} item={item} />)}</ul>
      <dl className={styles.totals}>
        <div><dt>{copy.subtotal}</dt><dd>{formatMoney(subtotal, currency)}</dd></div>
        <div><dt>{copy.shippingCost}</dt><dd>{shipping === 0 ? "Complimentary" : formatMoney(shipping, currency)}</dd></div>
        {tax && tax.amount > 0 ? <div><dt>{tax.label}{tax.included ? " (included)" : ""}</dt><dd>{formatMoney(tax.amount, currency)}</dd></div> : null}
        <div className={styles.total}><dt>{copy.total}</dt><dd><small>{currency}</small>{formatMoney(subtotal + shipping + (tax && !tax.included ? tax.amount : 0), currency)}</dd></div>
      </dl>
    </section>
  );
}
