import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { InventoryTable } from "@/components/admin/inventory/InventoryTable";
import { ListToolbar } from "@/components/admin/ListToolbar";
import { Pagination, listHref } from "@/components/admin/Pagination";
import styles from "@/components/admin/admin.module.css";
import { can, requireAdminPage } from "@/lib/admin/authorization";
import { parseListParams } from "@/lib/admin/listParams";
import { INVENTORY_SORTS, listInventory } from "@/lib/admin/services/inventoryAdmin";
import { getSettings } from "@/lib/settings/settingsService";

export const metadata: Metadata = { title: "Inventory" };

export default async function AdminInventoryPage({ searchParams }: PageProps<"/admin/inventory">) {
  const actor = await requireAdminPage("dashboard:view");
  const params = parseListParams(await searchParams, { sorts: INVENTORY_SORTS, defaultSort: "product", filters: ["status"], limit: 30 });
  const settings = await getSettings("inventory");
  const { rows, total } = await listInventory(params, settings.lowStockThreshold);
  const current = { q: params.search || undefined, sort: params.sort === "product" ? undefined : params.sort, ...params.filters };
  const sortHref = Object.fromEntries(INVENTORY_SORTS.map((sort) => [sort, listHref("/admin/inventory", current, { sort: sort === "product" ? undefined : sort, page: undefined })]));
  return (
    <>
      <AdminHeader title="Inventory" description={<>Available = total − reserved. Reserved units are held by checkouts awaiting payment and can’t be adjusted away. Low stock is {settings.lowStockThreshold} or fewer.</>} />
      <section className={styles.panel}>
        <ListToolbar
          searchLabel="Search product or SKU"
          total={total}
          noun="variant"
          filters={[{ key: "status", label: "Stock", options: [{ value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" }, { value: "in", label: "In stock" }] }]}
          sorts={[{ value: "product", label: "Product" }, { value: "available-asc", label: "Available: low first" }, { value: "available-desc", label: "Available: high first" }, { value: "sku", label: "SKU" }]}
        />
        <InventoryTable
          key={`${params.page}-${params.search}-${params.sort}-${JSON.stringify(params.filters)}`}
          rows={rows}
          lowStockThreshold={settings.lowStockThreshold}
          canAdjust={can(actor, "inventory:write")}
          sortHref={sortHref}
          currentSort={params.sort}
          filtered={Boolean(params.search || params.filters.status)}
        />
        <Pagination page={params.page} limit={params.limit} total={total} href={(page) => listHref("/admin/inventory", current, { page })} />
      </section>
    </>
  );
}
