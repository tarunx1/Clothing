import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { OrderStatusControl } from "@/components/admin/orders/OrderStatusControl";
import { StatusBadge, orderStatusTone, paymentStatusTone } from "@/components/admin/StatusBadge";
import styles from "@/components/admin/admin.module.css";
import { countries } from "@/config/checkout";
import { can, requireAdminPage } from "@/lib/admin/authorization";
import { getOrderDetail } from "@/lib/admin/services/orderAdmin";
import { ADMIN_ORDER_TRANSITIONS, ORDER_STATUS_LABELS } from "@/lib/domain/orderStatus";
import { formatMoney } from "@/lib/money";
import { PAID_ORDER_STATUSES } from "@/config/payment";

export const metadata: Metadata = { title: "Order" };

const PAYMENT_LABELS: Record<string, string> = { CREATED: "Created", PENDING: "Pending", SUCCEEDED: "Succeeded", FAILED: "Failed", CANCELLED: "Cancelled", REFUNDED: "Refunded" };

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const actor = await requireAdminPage("dashboard:view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const detail = await getOrderDetail(id);
  if (!detail) notFound();
  const { order, history } = detail;
  const money = (minor: bigint) => formatMoney(Number(minor) / 100, order.currency);
  const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
  const address = order.shippingAddress;
  const allowed = ADMIN_ORDER_TRANSITIONS[order.status].filter((status): status is "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" => ["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].includes(status));
  const latestPayment = order.payments[0];
  return (
    <>
      <AdminHeader
        title={`Order ${order.orderNumber}`}
        description={<>Placed {date.format(order.createdAt)} · <StatusBadge tone={orderStatusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge> <StatusBadge tone={paymentStatusTone(latestPayment?.status ?? null)}>Payment: {latestPayment ? PAYMENT_LABELS[latestPayment.status] : "none"}</StatusBadge></>}
        back={{ href: "/admin/orders", label: "Orders" }}
      />
      <div className={styles.grid2}>
        <div className={styles.stack}>
          <section className={styles.panel} aria-labelledby="order-items">
            <div className={styles.panelHead}><h2 id="order-items">Items</h2><p>Snapshot at checkout</p></div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption>Order items</caption>
                <thead><tr><th scope="col">Product</th><th scope="col" className={styles.p2}>SKU</th><th scope="col">Qty</th><th scope="col" className={`${styles.alignEnd} ${styles.p2}`}>Price</th><th scope="col" className={styles.alignEnd}>Line total</th></tr></thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className={styles.thumbCell}>
                          <span className={styles.thumb}>{item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="40px" /> : null}</span>
                          <span><span className={styles.cellStrong}>{item.productName}</span><span className={styles.cellSub}>{item.sizeName} / {item.colorName}</span></span>
                        </span>
                      </td>
                      <td className={`${styles.mono} ${styles.p2}`}>{item.sku}</td>
                      <td className={styles.num}>{item.quantity}</td>
                      <td className={`${styles.alignEnd} ${styles.p2}`}>{money(item.unitPrice)}</td>
                      <td className={styles.alignEnd}>{money(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className={styles.panelBody} style={{ display: "grid", gap: 6, borderTop: "1px solid var(--a-line)" }}>
              {[["Subtotal", order.subtotal], ["Shipping", order.shippingAmount], ["Tax", order.taxAmount], ...(order.discountAmount > BigInt(0) ? [["Discount", -order.discountAmount] as const] : [])].map(([label, value]) => (
                <div key={label as string} style={{ display: "flex", justifyContent: "space-between" }}><dt className={styles.muted}>{label as string}</dt><dd className={styles.num}>{money(value as bigint)}</dd></div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--a-line)", fontWeight: 700 }}><dt>Total</dt><dd className={styles.num}>{money(order.total)}</dd></div>
            </dl>
          </section>

          <section className={styles.panel} aria-labelledby="order-payment">
            <div className={styles.panelHead}><h2 id="order-payment">Payment</h2><p>Refunds are not available in this admin yet</p></div>
            {order.payments.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <caption>Payment attempts</caption>
                  <thead><tr><th scope="col">Provider</th><th scope="col">Payment ID</th><th scope="col">Status</th><th scope="col" className={styles.alignEnd}>Amount</th><th scope="col" className={styles.p3}>Date</th></tr></thead>
                  <tbody>
                    {order.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td style={{ textTransform: "capitalize" }}>{payment.provider}</td>
                        <td className={styles.mono}>{payment.providerPaymentId ?? "—"}<span className={styles.cellSub}>{payment.providerOrderId}</span></td>
                        <td><StatusBadge tone={paymentStatusTone(payment.status)}>{PAYMENT_LABELS[payment.status]}</StatusBadge>{payment.failureMessage ? <span className={styles.cellSub}>{payment.failureMessage}</span> : null}</td>
                        <td className={styles.alignEnd}>{formatMoney(Number(payment.amount) / 100, payment.currency)}</td>
                        <td className={`${styles.small} ${styles.p3}`}>{date.format(payment.succeededAt ?? payment.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className={`${styles.panelBody} ${styles.muted}`}>No payment attempts recorded.</p>}
          </section>

          <section className={styles.panel} aria-labelledby="order-history">
            <div className={styles.panelHead}><h2 id="order-history">History</h2></div>
            <ol className={styles.panelBody} style={{ display: "grid", gap: 8, listStyle: "none", margin: 0 }}>
              {history.map((entry) => {
                const meta = (entry.metadata ?? {}) as { from?: string; to?: string; note?: string; restocked?: number; tracking?: string };
                return (
                  <li key={entry.id} className={styles.small}>
                    <strong>{meta.to ? `${ORDER_STATUS_LABELS[meta.from as keyof typeof ORDER_STATUS_LABELS] ?? meta.from} → ${ORDER_STATUS_LABELS[meta.to as keyof typeof ORDER_STATUS_LABELS] ?? meta.to}` : meta.tracking ? "Tracking updated" : entry.action}</strong>
                    {" "}by {entry.admin?.name ?? "System"} · {date.format(entry.createdAt)}
                    {meta.restocked ? ` · ${meta.restocked} returned to stock` : ""}
                    {meta.note ? <span className={styles.cellSub}>“{meta.note}”</span> : null}
                  </li>
                );
              })}
              {order.paidAt ? <li className={styles.small}><strong>Paid</strong> · {date.format(order.paidAt)}</li> : null}
              <li className={styles.small}><strong>Placed</strong> · {date.format(order.createdAt)}</li>
            </ol>
          </section>
        </div>

        <div className={styles.stack}>
          <section className={styles.panel} aria-labelledby="order-status">
            <div className={styles.panelHead}><h2 id="order-status">Fulfilment</h2><StatusBadge tone={orderStatusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</StatusBadge></div>
            <div className={styles.panelBody}>
              <OrderStatusControl
                key={order.status}
                orderId={order.id}
                status={order.status}
                allowed={allowed}
                paid={(PAID_ORDER_STATUSES as readonly string[]).includes(order.status)}
                canEdit={can(actor, "orders:write")}
                shipment={order.shipment ? { carrier: order.shipment.carrier ?? "", trackingNumber: order.shipment.trackingNumber ?? "", trackingUrl: order.shipment.trackingUrl ?? "" } : null}
              />
              {order.shipment?.shippedAt ? (
                <dl className={styles.small} style={{ display: "grid", gap: 4, marginTop: 12 }}>
                  <div><dt className={styles.muted} style={{ display: "inline" }}>Shipped: </dt><dd style={{ display: "inline" }}>{date.format(order.shipment.shippedAt)}</dd></div>
                  {order.shipment.carrier ? <div><dt className={styles.muted} style={{ display: "inline" }}>Carrier: </dt><dd style={{ display: "inline" }}>{order.shipment.carrier}</dd></div> : null}
                  {order.shipment.trackingNumber ? <div><dt className={styles.muted} style={{ display: "inline" }}>Tracking: </dt><dd style={{ display: "inline" }} className={styles.mono}>{order.shipment.trackingUrl ? <a href={order.shipment.trackingUrl} target="_blank" rel="noreferrer" className={styles.linkButton}>{order.shipment.trackingNumber}</a> : order.shipment.trackingNumber}</dd></div> : null}
                  {order.shipment.deliveredAt ? <div><dt className={styles.muted} style={{ display: "inline" }}>Delivered: </dt><dd style={{ display: "inline" }}>{date.format(order.shipment.deliveredAt)}</dd></div> : null}
                </dl>
              ) : null}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="order-customer">
            <div className={styles.panelHead}><h2 id="order-customer">Customer</h2></div>
            <div className={styles.panelBody} style={{ display: "grid", gap: 12 }}>
              <p><span className={styles.cellStrong}>{address ? `${address.firstName} ${address.lastName}` : "—"}</span><span className={styles.cellSub}><a href={`mailto:${order.email}`}>{order.email}</a></span>{address?.phone ? <span className={styles.cellSub}>{address.phone}</span> : null}</p>
              {address ? (
                <div>
                  <p className={styles.muted} style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>Shipping address</p>
                  <address style={{ fontStyle: "normal" }}>
                    {address.address1}<br />
                    {address.address2 ? <>{address.address2}<br /></> : null}
                    {address.city}, {address.region} {address.postalCode}<br />
                    {countries.find((country) => country.code === address.countryCode)?.name ?? address.countryCode}
                  </address>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
