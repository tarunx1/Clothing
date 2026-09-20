import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { DataTable } from "@/components/admin/DataTable";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { Pagination, listHref } from "@/components/admin/Pagination";
import { StatusBadge, orderStatusTone, paymentStatusTone } from "@/components/admin/StatusBadge";
import styles from "@/components/admin/admin.module.css";
import { requireAdminPage } from "@/lib/admin/authorization";
import { parseListParams } from "@/lib/admin/listParams";
import { listOrders, ORDER_FILTERS, ORDER_SORTS } from "@/lib/admin/services/orderAdmin";
import { fulfilmentLabel, ORDER_STATUS_LABELS } from "@/lib/domain/orderStatus";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Orders" };

const PAYMENT_LABELS: Record<string, string> = { CREATED: "Pending", PENDING: "Pending", SUCCEEDED: "Paid", FAILED: "Failed", CANCELLED: "Cancelled", REFUNDED: "Refunded" };

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdminPage("dashboard:view");
  const params = parseListParams(await searchParams, { sorts: ORDER_SORTS, defaultSort: "newest", filters: ["status"] });
  const { rows, total } = await listOrders(params);
  const current = { q: params.search || undefined, sort: params.sort === "newest" ? undefined : params.sort, ...params.filters };
  const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <AdminHeader title="Orders" description="Line items and addresses are the snapshots taken at checkout." />
      <section className={styles.panel}>
        <ListToolbar
          searchLabel="Search order number or email"
          total={total}
          noun="order"
          filters={[{ key: "status", label: "Status", options: ORDER_FILTERS.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] })) }]}
          sorts={[{ value: "newest", label: "Newest" }, { value: "oldest", label: "Oldest" }, { value: "total-desc", label: "Total: high to low" }, { value: "total-asc", label: "Total: low to high" }]}
        />
        <DataTable
          caption="Orders"
          rows={rows}
          rowKey={(row) => row.id}
          currentSort={params.sort}
          sortHref={(sort) => listHref("/admin/orders", current, { sort, page: undefined })}
          empty={{ title: params.search || params.filters.status ? "No orders match" : "No orders yet", body: params.search || params.filters.status ? "Try another search or status." : "Orders appear here once customers check out." }}
          columns={[
            { key: "order", header: "Order", render: (row) => <><Link className={styles.rowLink} href={`/admin/orders/${row.id}`}>{row.orderNumber}</Link><span className={styles.cellSub}>{row.itemCount} line{row.itemCount === 1 ? "" : "s"}</span></> },
            { key: "customer", header: "Customer", priority: 2, render: (row) => <>{row.customer}<span className={styles.cellSub}>{row.email}</span></> },
            { key: "date", header: "Date", sort: "oldest", priority: 3, render: (row) => <span className={styles.small}>{date.format(row.createdAt)}</span> },
            { key: "payment", header: "Payment", render: (row) => <StatusBadge tone={paymentStatusTone(row.paymentStatus)}>{row.paymentStatus ? PAYMENT_LABELS[row.paymentStatus] : "—"}</StatusBadge> },
            { key: "fulfilment", header: "Fulfilment", render: (row) => <StatusBadge tone={orderStatusTone(row.status)}>{fulfilmentLabel(row.status) === "—" ? ORDER_STATUS_LABELS[row.status] : fulfilmentLabel(row.status)}</StatusBadge> },
            { key: "total", header: "Total", sort: "total-desc", align: "end", render: (row) => formatMoney(row.total, row.currency) },
          ]}
        />
        <Pagination page={params.page} limit={params.limit} total={total} href={(page) => listHref("/admin/orders", current, { page })} />
      </section>
    </>
  );
}
