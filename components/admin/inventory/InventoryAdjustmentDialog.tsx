"use client";

import { useEffect, useId, useRef, useState } from "react";
import { adjustInventoryAction, inventoryHistoryAction } from "@/lib/admin/actions/inventory";
import { ADJUSTMENT_REASONS } from "@/lib/admin/validation";
import { FormField, SelectField, TextareaField } from "@/components/ui/FormField";
import { useToast } from "../Toaster";
import styles from "../admin.module.css";

export interface AdjustTarget {
  variantId: string;
  label: string;
  sku: string;
  quantity: number;
  reserved: number;
}

type History = { id: string; delta: number; before: number; after: number; reason: string; note: string | null; by: string; at: string }[];

const REASON_LABELS: Record<(typeof ADJUSTMENT_REASONS)[number], string> = { RESTOCK: "Restock", CORRECTION: "Correction", RETURN: "Return", DAMAGED: "Damaged", OTHER: "Other" };

/**
 * Records a stock change as a delta with a reason. The result is shown before
 * saving, and the server refuses anything below the reserved quantity.
 * Not optimistic: the table only changes once the server confirms.
 */
export function InventoryAdjustmentDialog({ target, onClose, onAdjusted }: { target: AdjustTarget | null; onClose: () => void; onAdjusted: (next: { quantity: number; reserved: number; available: number }) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const notify = useToast();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<(typeof ADJUSTMENT_REASONS)[number]>("RESTOCK");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<History | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (target && !element.open) {
      element.showModal();
      void inventoryHistoryAction(target.variantId).then((result) => setHistory(result.ok ? result.data : []));
    } else if (!target && element.open) element.close();
  }, [target]);

  const close = () => {
    setDelta("");
    setNote("");
    setError(undefined);
    setHistory(null);
    setReason("RESTOCK");
    onClose();
  };

  const change = Number.parseInt(delta, 10);
  const valid = Number.isInteger(change) && change !== 0 && /^[+-]?\d+$/.test(delta.trim());
  const result = target && valid ? target.quantity + change : null;
  const floor = target ? Math.max(target.reserved, 0) : 0;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target) return;
    if (!valid) return setError("Enter a whole number like 10 or -3.");
    setBusy(true);
    const response = await adjustInventoryAction({ variantId: target.variantId, delta: change, reason, note });
    setBusy(false);
    if (!response.ok) {
      setError(response.fieldErrors?.delta ?? response.error);
      return;
    }
    notify(response.message ?? "Stock adjusted.");
    onAdjusted(response.data);
    close();
  };

  const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
  return (
    <dialog ref={dialog} className={`${styles.dialog} ${styles.dialogWide}`} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) close(); }}>
      {target ? (
        <form onSubmit={submit} noValidate>
          <div className={styles.dialogBody}>
            <div>
              <h2 id={titleId}>Adjust stock</h2>
              <p className={styles.muted}>{target.label} · <span className={styles.mono}>{target.sku}</span></p>
            </div>
            <dl className={styles.stats} style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginBottom: 0 }}>
              <div className={`${styles.panel} ${styles.stat}`}><dt>Total</dt><dd>{target.quantity}</dd></div>
              <div className={`${styles.panel} ${styles.stat}`}><dt>Reserved</dt><dd>{target.reserved}</dd><small>In active checkouts</small></div>
              <div className={`${styles.panel} ${styles.stat}`}><dt>Available</dt><dd>{target.quantity - target.reserved}</dd></div>
            </dl>
            <div className={styles.fieldRow}>
              <FormField id="adjust-delta" label="Change" density="compact" inputMode="numeric" placeholder="+10 or -3" value={delta} onChange={(event) => { setDelta(event.target.value); setError(undefined); }} error={error} autoFocus hint={result !== null ? `New total: ${target.quantity} ${change > 0 ? "+" : "−"} ${Math.abs(change)} = ${result}${result < floor ? ` (below the ${floor} reserved)` : ""}` : `Can't go below ${floor}.`} />
              <SelectField id="adjust-reason" label="Reason" density="compact" value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}>
                {ADJUSTMENT_REASONS.map((value) => <option key={value} value={value}>{REASON_LABELS[value]}</option>)}
              </SelectField>
            </div>
            <TextareaField id="adjust-note" label="Note" optional density="compact" rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Supplier invoice, recount, etc." />
            <details>
              <summary className={styles.small} style={{ cursor: "pointer", fontWeight: 600 }}>Recent adjustments</summary>
              {history === null ? <p className={styles.muted}>Loading…</p> : history.length ? (
                <div className={styles.tableWrap} style={{ maxHeight: 220, marginTop: 8 }}>
                  <table className={styles.table}>
                    <caption>Adjustment history</caption>
                    <thead><tr><th scope="col">When</th><th scope="col">Change</th><th scope="col">Reason</th><th scope="col" className={styles.p2}>By</th></tr></thead>
                    <tbody>
                      {history.map((row) => (
                        <tr key={row.id}>
                          <td className={styles.small}>{date.format(new Date(row.at))}</td>
                          <td className={styles.num}>{row.delta > 0 ? `+${row.delta}` : row.delta} <span className={styles.cellSub}>{row.before} → {row.after}</span></td>
                          <td>{REASON_LABELS[row.reason as keyof typeof REASON_LABELS] ?? row.reason}{row.note ? <span className={styles.cellSub}>{row.note}</span> : null}</td>
                          <td className={styles.p2}>{row.by}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className={styles.muted}>No adjustments recorded yet.</p>}
            </details>
          </div>
          <div className={styles.dialogFoot}>
            <button type="button" className={styles.button} onClick={close} disabled={busy}>Cancel</button>
            <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={busy} aria-busy={busy || undefined}>{busy ? "Saving…" : "Save adjustment"}</button>
          </div>
        </form>
      ) : null}
    </dialog>
  );
}
