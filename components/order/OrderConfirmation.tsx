import Image from "@/components/ui/StoreImage";
import Link from "next/link";
import { countries } from "@/config/checkout";
import { orderConfirmationCopy as copy } from "@/config/order";
import { formatMoney } from "@/lib/money";
import type { OrderConfirmation as OrderConfirmationData } from "@/lib/services/orderService";
import { ClearBagOnConfirm } from "./ClearBagOnConfirm";
import { ConfirmationRefresh } from "./ConfirmationRefresh";
import styles from "./confirmation.module.css";

const countryName = (code: string) => countries.find((country) => country.code === code)?.name ?? code;

export function OrderConfirmation({ order, storeName }: { order: OrderConfirmationData; storeName: string }) {
  const money = (amount: number) => formatMoney(amount, order.currency);
  const confirmed = order.status === "confirmed";
  const heading = confirmed ? copy.confirmed : order.status === "processing" ? copy.processing : copy.unpaid;
  return (
    <main className={styles.page} data-paper-surface>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label={`${storeName} home`}>{storeName}</Link>
      </header>
      {confirmed ? <ClearBagOnConfirm orderNumber={order.orderNumber} /> : null}
      {order.status === "processing" ? <ConfirmationRefresh /> : null}

      <div className={styles.shell}>
        <section className={styles.intro} aria-labelledby="order-heading">
          <p className={styles.kicker}>{heading.kicker}</p>
          <h1 id="order-heading" className={`display-type ${styles.title}`}>
            {heading.lines.map((line) => <span key={line}>{line}</span>)}
          </h1>
          <dl className={styles.number}>
            <dt>{copy.orderNumber}</dt>
            <dd>{order.orderNumber}</dd>
          </dl>
          <p className={styles.lede} role={confirmed ? undefined : "status"}>{heading.body}</p>
        </section>

        {confirmed ? (
          <div className={styles.details}>
            <section aria-labelledby="order-summary-heading">
              <h2 id="order-summary-heading" className={styles.sectionTitle}>{copy.summary}</h2>
              <ul className={styles.items}>
                {order.items.map((item) => (
                  <li key={item.key} className={styles.item}>
                    <div className={styles.thumb}>
                      {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="64px" /> : null}
                    </div>
                    <div className={styles.itemInfo}>
                      <h3>{item.productName}</h3>
                      <p>{item.sizeName} / {item.colorName}</p>
                      <p>{copy.quantity} {item.quantity}{item.quantity > 1 ? ` × ${money(item.unitPrice)}` : ""}</p>
                    </div>
                    <p className={styles.price}>{money(item.lineTotal)}</p>
                  </li>
                ))}
              </ul>
              <dl className={styles.totals}>
                <div><dt>{copy.subtotal}</dt><dd>{money(order.subtotal)}</dd></div>
                <div><dt>{copy.shipping}</dt><dd>{order.shipping === 0 ? copy.free : money(order.shipping)}</dd></div>
                {order.tax > 0 ? <div><dt>{copy.tax}</dt><dd>{money(order.tax)}</dd></div> : null}
                <div className={styles.total}><dt>{copy.total}</dt><dd>{money(order.total)}</dd></div>
              </dl>
            </section>

            {order.shipTo ? (
              <section aria-labelledby="order-shipping-heading">
                <h2 id="order-shipping-heading" className={styles.sectionTitle}>{copy.shippingTo}</h2>
                <address className={styles.address}>
                  <span>{order.shipTo.name}</span>
                  <span>{order.shipTo.address1}</span>
                  {order.shipTo.address2 ? <span>{order.shipTo.address2}</span> : null}
                  <span>{order.shipTo.city}, {order.shipTo.region} {order.shipTo.postalCode}</span>
                  <span>{countryName(order.shipTo.countryCode)}</span>
                </address>
              </section>
            ) : null}
          </div>
        ) : null}

        <Link href={confirmed ? copy.continueHref : copy.checkoutHref} className={styles.cta}>
          {confirmed ? copy.continueShopping : copy.returnToCheckout}
          <svg viewBox="0 0 20 12" aria-hidden="true"><path d="M1 6h17M13 1l5 5-5 5" /></svg>
        </Link>
      </div>
    </main>
  );
}
