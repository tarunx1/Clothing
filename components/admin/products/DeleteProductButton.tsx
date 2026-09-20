"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteProductAction, setProductEnabledAction } from "@/lib/admin/actions/products";
import { ConfirmDialog } from "../ConfirmDialog";
import { useToast } from "../Toaster";
import styles from "../admin.module.css";

/** Products with order history can only be disabled; others can be deleted after confirmation. */
export function DeleteProductButton({ id, name, orderLines, enabled }: { id: string; name: string; orderLines: number; enabled: boolean }) {
  const router = useRouter();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const archiveOnly = orderLines > 0;
  const confirm = async () => {
    setBusy(true);
    const result = archiveOnly ? await setProductEnabledAction(id, false) : await deleteProductAction(id);
    setBusy(false);
    if (!result.ok) return notify(result.error, "error");
    notify(result.message ?? "Done.");
    setOpen(false);
    if (archiveOnly) router.refresh();
    else router.push("/admin/products");
  };
  if (archiveOnly && !enabled) return null;
  return (
    <>
      <button type="button" className={`${styles.button} ${styles.danger}`} onClick={() => setOpen(true)}>{archiveOnly ? "Disable product" : "Delete product"}</button>
      <ConfirmDialog open={open} title={archiveOnly ? `Disable “${name}”?` : `Delete “${name}”?`} confirmLabel={archiveOnly ? "Disable product" : "Delete permanently"} tone="danger" busy={busy} onConfirm={confirm} onCancel={() => setOpen(false)}>
        {archiveOnly ? (
          <p>This product appears in {orderLines} order line{orderLines === 1 ? "" : "s"}, so it can’t be deleted. Disabling hides it from the store and keeps order history intact. You can re-enable it any time.</p>
        ) : (
          <p>This removes the product, its variants, stock records and images. It can’t be undone. Items in open bags are removed too.</p>
        )}
      </ConfirmDialog>
    </>
  );
}
