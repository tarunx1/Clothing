"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteCollectionAction } from "@/lib/admin/actions/collections";
import { ConfirmDialog } from "../ConfirmDialog";
import { useToast } from "../Toaster";
import styles from "../admin.module.css";

export function DeleteCollectionButton({ id, name, productCount }: { id: string; name: string; productCount: number }) {
  const router = useRouter();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const blocked = productCount > 0;
  const confirm = async () => {
    setBusy(true);
    const result = await deleteCollectionAction(id);
    setBusy(false);
    if (!result.ok) return notify(result.error, "error");
    notify(result.message ?? "Collection deleted.");
    router.push("/admin/collections");
  };
  return (
    <>
      <button type="button" className={`${styles.button} ${styles.danger}`} onClick={() => setOpen(true)}>Delete collection</button>
      <ConfirmDialog open={open} title={blocked ? `“${name}” can’t be deleted yet` : `Delete “${name}”?`} confirmLabel={blocked ? "OK" : "Delete permanently"} tone={blocked ? "default" : "danger"} busy={busy} onConfirm={blocked ? () => setOpen(false) : confirm} onCancel={() => setOpen(false)}>
        {blocked ? (
          <p>It still contains {productCount} product{productCount === 1 ? "" : "s"}. Move them to another collection first, or disable this collection to hide it.</p>
        ) : (
          <p>The collection and its reel images are removed from the store. This can’t be undone.</p>
        )}
      </ConfirmDialog>
    </>
  );
}
