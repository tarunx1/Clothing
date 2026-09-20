"use client";

import { useOptimistic, useTransition } from "react";
import { setProductEnabledAction } from "@/lib/admin/actions/products";
import { useToast } from "../Toaster";
import styles from "../admin.module.css";

/** Optimistic enable/disable; the server result wins and failures roll back. */
export function ProductEnabledToggle({ id, name, enabled, disabled }: { id: string; name: string; enabled: boolean; disabled?: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(enabled);
  const [pending, startTransition] = useTransition();
  const notify = useToast();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      aria-label={`${name} visible in store`}
      disabled={disabled || pending}
      className={`${styles.badge} ${optimistic ? styles["tone-ok"] : styles["tone-neutral"]}`}
      style={{ cursor: disabled ? "default" : "pointer", border: 0 }}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          const result = await setProductEnabledAction(id, !optimistic);
          if (!result.ok) notify(result.error, "error");
          else notify(result.message ?? "Saved.");
        })
      }
    >
      {optimistic ? "Live" : "Disabled"}
    </button>
  );
}
