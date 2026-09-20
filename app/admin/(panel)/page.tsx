import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { DataTable } from "@/components/admin/DataTable";
import { StatusBadge, orderStatusTone } from "@/components/admin/StatusBadge";
import styles from "@/components/admin/admin.module.css";
import { requireAdminPage } from "@/lib/admin/authorization";
import { getDashboardSnapshot } from "@/lib/admin/services/dashboard";
import { getSettings } from "@/lib/settings/settingsService";
import { ORDER_STATUS_LABELS } from "@/lib/domain/orderStatus";
import { formatMoney } from "@/lib/money";

export default async function AdminDashboard({ searchParams }: PageProps<"/admin">) {
  const actor = await requireAdminPage("dashboard:view");
  const { denied } = await searchParams;
  const [inventory, localization] = await Promise.all([getSettings("inventory"), getSettings("localization")]);
  const settings = { lowStockThreshold: inventory.lowStockThreshold, defaultCurrency: localization.defaultCurrency };
  const data = await getDashboardSnapshot(settings.lowStockThreshold);
  const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <AdminHeader title="Dashboard" description={`Welcome back, ${actor.name.split(" ")[0]}.`} />
      {denied ? <p className={`${styles.callout} ${styles.calloutInfo}`} role="status" style={{ marginBottom: 16 }}>Your role doesn’t include that section. Ask an administrator if you need access.</p> : null}
      <dl className={styles.stats}>
        <div className={`${styles.panel} ${styles.stat}`}>
          <dt>Orders today</dt>
          <dd>{data.ordersToday}</dd>
          <small>Paid since midnight</small>
        </div>
        <div className={`${styles.panel} ${styles.stat}`}>
          <dt>Revenue today</dt>
          <dd>{data.revenueToday.length ? data.revenueToday.map((row) => formatMoney(row.total, row.currency)).join(" · ") : formatMoney(0, settings.defaultCurrency)}</dd>
          <small>Order totals incl. shipping</small>
        </div>
        <div className={`${styles.panel} ${styles.stat}`}>
          <dt>Low stock</dt>
          <dd>{data.lowStockCount}</dd>
          <small>Variants at or below {settings.lowStockThreshold} available</small>
        </div>
        <div className={`${styles.panel} ${styles.stat}`}>
          <dt>Products</dt>
          <dd>{data.products.total}</dd>
          <small>{data.products.enabled} live · {data.toFulfil} order{data.toFulfil === 1 ? "" : "s"} to fulfil</small>
        </div>
      </dl>
      <div className={styles.grid2}>
        <section className={styles.panel} aria-labelledby="recent-orders">
          <div className={styles.panelHead}><h2 id="recent-orders">Recent orders</h2><Link className={styles.linkButton} href="/admin/orders">All orders</Link></div>
          <DataTable
            caption="Recent orders"
            rows={data.recentOrders}
            rowKey={(row) => row.id}
            empty={{ title: "No orders yet", body: "Orders appear here as soon as checkout starts." }}
            columns={[
              { key: "order", header: "Order", render: (row) => <Link className={styles.rowLink} href={`/admin/orders/${row.id}`}>{row.orderNumber}</Link> },
              { key: "customer", header: "Customer", priority: 2, render: (row) => <span className={styles.small}>{row.email}</span> },
              { key: "status", header: "Status", render: (row) => <StatusBadge tone={orderStatusTone(row.status)}>{ORDER_STATUS_LABELS[row.status]}</StatusBadge> },
              { key: "date", header: "Date", priority: 3, render: (row) => <span className={styles.small}>{date.format(row.createdAt)}</span> },
              { key: "total", header: "Total", align: "end", render: (row) => formatMoney(row.total, row.currency) },
            ]}
          />
        </section>
        <section className={styles.panel} aria-labelledby="low-stock">
          <div className={styles.panelHead}><h2 id="low-stock">Low stock</h2><Link className={styles.linkButton} href="/admin/inventory?status=low">Inventory</Link></div>
          <DataTable
            caption="Lowest available stock"
            rows={data.lowStock}
            rowKey={(row) => row.variantId}
            empty={{ title: "Stock looks healthy", body: `No live variant is at or below ${settings.lowStockThreshold}.` }}
            columns={[
              { key: "product", header: "Variant", render: (row) => <><Link className={styles.rowLink} href={`/admin/products/${row.productId}`}>{row.productName}</Link><span className={styles.cellSub}>{row.color} / {row.size} · <span className={styles.mono}>{row.sku}</span></span></> },
              { key: "available", header: "Available", align: "end", render: (row) => <StatusBadge tone={row.available <= 0 ? "bad" : "warn"}>{row.available}</StatusBadge> },
            ]}
          />
        </section>
      </div>
    </>
  );
}
