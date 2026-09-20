"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./admin.module.css";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "default";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Accessible confirmation built on the native modal <dialog>: focus is trapped
 * by the browser, Escape cancels, and focus returns to the trigger on close.
 * The safe action (Cancel) receives initial focus.
 */
export function ConfirmDialog({ open, title, children, confirmLabel, tone = "default", busy, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className={styles.dialogBody}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
      <div className={styles.dialogFoot}>
        <button ref={cancelRef} type="button" className={styles.button} onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className={`${styles.button} ${tone === "danger" ? styles.dangerSolid : styles.primary}`} onClick={onConfirm} disabled={busy} aria-busy={busy || undefined}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
