import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { DataTable } from "@/components/admin/DataTable";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { Pagination, listHref } from "@/components/admin/Pagination";
import { ProductEnabledToggle } from "@/components/admin/products/ProductEnabledToggle";
import { StatusBadge, stockLabel, stockTone } from "@/components/admin/StatusBadge";
import { Thumb } from "@/components/admin/Thumb";
import styles from "@/components/admin/admin.module.css";
import { can, requireAdminPage } from "@/lib/admin/authorization";
import { parseListParams } from "@/lib/admin/listParams";
import { getCatalogOptions, listProducts, PRODUCT_SORTS } from "@/lib/admin/services/productAdmin";
import { getSettings } from "@/lib/settings/settingsService";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Products" };

export default async function AdminProductsPage({ searchParams }: PageProps<"/admin/products">) {
  const actor = await requireAdminPage("dashboard:view");
  const raw = await searchParams;
  const params = parseListParams(raw, { sorts: PRODUCT_SORTS, defaultSort: "newest", filters: ["collection", "status", "featured", "stock"] });
  const settings = await getSettings("inventory");
  const [{ rows, total }, options] = await Promise.all([listProducts(params, settings.lowStockThreshold), getCatalogOptions()]);
  const editable = can(actor, "catalog:write");
  const current = { q: params.search || undefined, sort: params.sort === "newest" ? undefined : params.sort, ...params.filters };
  const updated = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });
  return (
    <>
      <AdminHeader
        title="Products"
        description="Everything sold in the store. Disabled products stay in order history but disappear from the shop."
        actions={editable ? <Link className={`${styles.button} ${styles.primary}`} href="/admin/products/new">Add product</Link> : null}
      />
      <section className={styles.panel}>
        <ListToolbar
          searchLabel="Search name, slug or SKU"
          total={total}
          noun="product"
          filters={[
            { key: "collection", label: "Collection", options: options.collections.map((collection) => ({ value: collection.slug, label: collection.name })) },
            { key: "status", label: "Status", options: [{ value: "enabled", label: "Live" }, { value: "disabled", label: "Disabled" }] },
            { key: "featured", label: "Featured", options: [{ value: "yes", label: "Featured only" }] },
            { key: "stock", label: "Stock", options: [{ value: "in", label: "In stock" }, { value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" }] },
          ]}
          sorts={[
            { value: "newest", label: "Newest" },
            { value: "oldest", label: "Oldest" },
            { value: "name", label: "Name" },
            { value: "price-asc", label: "Price: low to high" },
            { value: "price-desc", label: "Price: high to low" },
          ]}
        />
        <DataTable
          caption="Products"
          rows={rows}
          rowKey={(row) => row.id}
          currentSort={params.sort}
          sortHref={(sort) => listHref("/admin/products", current, { sort, page: undefined })}
          empty={{
            title: params.search || Object.keys(params.filters).length ? "No products match" : "No products yet",
            body: params.search || Object.keys(params.filters).length ? "Try a different search or clear the filters." : "Add your first product to start selling.",
            action: editable && !params.search ? <Link className={`${styles.button} ${styles.primary}`} href="/admin/products/new">Add product</Link> : undefined,
          }}
          columns={[
            { key: "product", header: "Product", sort: "name", render: (row) => (
              <span className={styles.thumbCell}>
                <Thumb src={row.image?.src} alt="" />
                <span><Link className={styles.rowLink} href={`/admin/products/${row.id}`}>{row.name}</Link><span className={styles.cellSub}>/{row.slug}{row.featured ? " · Featured" : ""}</span></span>
              </span>
            ) },
            { key: "collection", header: "Collection", priority: 3, render: (row) => row.collection },
            { key: "status", header: "Status", render: (row) => <ProductEnabledToggle id={row.id} name={row.name} enabled={row.enabled} disabled={!editable} /> },
            { key: "price", header: "Price", sort: "price-asc", align: "end", render: (row) => formatMoney(row.price, row.currency) },
            { key: "variants", header: "Variants", priority: 2, align: "end", render: (row) => <span title={`${row.enabledVariantCount} live`}>{row.enabledVariantCount}/{row.variantCount}</span> },
            { key: "stock", header: "Stock", align: "end", render: (row) => <StatusBadge tone={stockTone(row.stockStatus)}>{row.available} · {stockLabel(row.stockStatus)}</StatusBadge> },
            { key: "updated", header: "Updated", priority: 3, render: (row) => <span className={styles.small}>{updated.format(row.updatedAt)}</span> },
            { key: "action", header: "Action", align: "end", render: (row) => <Link className={styles.button} href={`/admin/products/${row.id}`} aria-label={`${editable ? "Edit" : "View"} ${row.name}`}>{editable ? "Edit" : "View"}</Link> },
          ]}
        />
        <Pagination page={params.page} limit={params.limit} total={total} href={(page) => listHref("/admin/products", current, { page })} />
      </section>
    </>
  );
}
