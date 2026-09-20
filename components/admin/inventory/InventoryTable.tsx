"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable } from "../DataTable";
import { StatusBadge, stockLabel, stockTone } from "../StatusBadge";
import { InventoryAdjustmentDialog, type AdjustTarget } from "./InventoryAdjustmentDialog";
import styles from "../admin.module.css";

export interface InventoryRow {
  variantId: string;
  sku: string;
  enabled: boolean;
  productId: string;
  productName: string;
  color: string;
  colorHex: string | null;
  size: string;
  quantity: number;
  reserved: number;
  available: number;
  status: "in" | "low" | "out";
}

/** Stock table with one shared adjustment dialog. Rows update only after the server confirms. */
export function InventoryTable({ rows: initial, lowStockThreshold, canAdjust, sortHref, currentSort, filtered }: { rows: InventoryRow[]; lowStockThreshold: number; canAdjust: boolean; sortHref: Record<string, string>; currentSort: string; filtered: boolean }) {
  const [rows, setRows] = useState(initial);
  const [target, setTarget] = useState<AdjustTarget | null>(null);
  return (
    <>
      <DataTable
        caption="Inventory by variant"
        rows={rows}
        rowKey={(row) => row.variantId}
        currentSort={currentSort}
        sortHref={(sort) => sortHref[sort]}
        empty={{ title: filtered ? "No variants match" : "No variants yet", body: filtered ? "Try another search or filter." : "Create variants from a product’s variant matrix." }}
        columns={[
          { key: "product", header: "Product", sort: "product", render: (row) => <><Link className={styles.rowLink} href={`/admin/products/${row.productId}`}>{row.productName}</Link>{row.enabled ? null : <span className={styles.cellSub}>Variant disabled</span>}</> },
          { key: "variant", header: "Variant", render: (row) => <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: row.colorHex ?? "#ccc", border: "1px solid rgb(0 0 0 / .15)" }} />{row.color} / {row.size}</span> },
          { key: "sku", header: "SKU", sort: "sku", priority: 2, render: (row) => <span className={styles.mono}>{row.sku}</span> },
          { key: "available", header: "Available", sort: "available-asc", align: "end", render: (row) => <strong className={styles.num}>{row.available}</strong> },
          { key: "reserved", header: "Reserved", align: "end", priority: 2, render: (row) => <span className={styles.num} title="Held by checkouts awaiting payment">{row.reserved}</span> },
          { key: "total", header: "Total", align: "end", priority: 2, render: (row) => <span className={styles.num}>{row.quantity}</span> },
          { key: "status", header: "Status", render: (row) => <StatusBadge tone={stockTone(row.status)}>{stockLabel(row.status)}</StatusBadge> },
          { key: "action", header: "Action", align: "end", render: (row) => canAdjust ? <button type="button" className={styles.button} onClick={() => setTarget({ variantId: row.variantId, label: `${row.productName} — ${row.color} / ${row.size}`, sku: row.sku, quantity: row.quantity, reserved: row.reserved })} aria-label={`Adjust stock for ${row.productName} ${row.color} ${row.size}`}>Adjust</button> : null },
        ]}
      />
      <InventoryAdjustmentDialog
        target={target}
        onClose={() => setTarget(null)}
        onAdjusted={(next) => {
          if (!target) return;
          setRows((current) => current.map((row) => row.variantId === target.variantId
            ? { ...row, quantity: next.quantity, reserved: next.reserved, available: next.available, status: next.available <= 0 ? "out" : next.available <= lowStockThreshold ? "low" : "in" }
            : row));
        }}
      />
    </>
  );
}
