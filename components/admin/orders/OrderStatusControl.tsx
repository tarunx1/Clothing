"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormField, TextareaField } from "@/components/ui/FormField";
import { transitionOrderAction, updateShipmentAction } from "@/lib/admin/actions/orders";
import { ConfirmDialog } from "../ConfirmDialog";
import { useToast } from "../Toaster";
import styles from "../admin.module.css";

type Target = "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
const LABELS: Record<Target, string> = { PROCESSING: "Mark processing", SHIPPED: "Mark shipped", DELIVERED: "Mark delivered", CANCELLED: "Cancel order" };

interface OrderStatusControlProps {
  orderId: string;
  status: string;
  /** Allowed next states, from lib/domain/orderStatus (computed on the server). */
  allowed: Target[];
  paid: boolean;
  shipment: { carrier: string; trackingNumber: string; trackingUrl: string } | null;
  canEdit: boolean;
}

/** Offers only the transitions the server permits; every change is re-validated server-side. */
export function OrderStatusControl({ orderId, status, allowed, paid, shipment, canEdit }: OrderStatusControlProps) {
  const router = useRouter();
  const notify = useToast();
  const [pending, setPending] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState({ carrier: shipment?.carrier ?? "", trackingNumber: shipment?.trackingNumber ?? "", trackingUrl: shipment?.trackingUrl ?? "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    const result = await transitionOrderAction({ orderId, from: status, to: pending, note, ...tracking });
    setBusy(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      notify(result.error, "error");
      return;
    }
    notify(result.data.restocked ? `Order cancelled. ${result.data.restocked} unit${result.data.restocked === 1 ? "" : "s"} returned to stock.` : result.message ?? "Order updated.");
    setPending(null);
    setNote("");
    router.refresh();
  };

  const saveTracking = async () => {
    setBusy(true);
    const result = await updateShipmentAction(orderId, tracking);
    setBusy(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      return notify(result.error, "error");
    }
    setErrors({});
    notify(result.message ?? "Tracking saved.");
    router.refresh();
  };

  const trackingFields = (
    <div className={styles.fields}>
      <FormField id="ship-carrier" label="Carrier" optional density="compact" value={tracking.carrier} onChange={(event) => setTracking({ ...tracking, carrier: event.target.value })} error={errors.carrier} placeholder="Delhivery, Blue Dart…" />
      <FormField id="ship-number" label="Tracking number" optional density="compact" value={tracking.trackingNumber} onChange={(event) => setTracking({ ...tracking, trackingNumber: event.target.value })} error={errors.trackingNumber} />
      <FormField id="ship-url" label="Tracking URL" optional density="compact" value={tracking.trackingUrl} onChange={(event) => setTracking({ ...tracking, trackingUrl: event.target.value })} error={errors.trackingUrl} placeholder="https://" />
    </div>
  );

  if (!canEdit) return <p className={styles.muted}>Your role can view orders but not change them.</p>;
  return (
    <div className={styles.stack}>
      {allowed.length ? (
        <div className={styles.actions}>
          {allowed.map((target) => (
            <button key={target} type="button" className={`${styles.button} ${target === "CANCELLED" ? styles.danger : styles.primary}`} onClick={() => { setErrors({}); setPending(target); }}>{LABELS[target]}</button>
          ))}
        </div>
      ) : (
        <p className={styles.muted}>No further status changes are available for this order.</p>
      )}
      {status === "SHIPPED" || status === "DELIVERED" ? (
        <details>
          <summary className={styles.small} style={{ cursor: "pointer", fontWeight: 600 }}>Edit tracking</summary>
          <div style={{ marginTop: 10 }} className={styles.stack}>
            {trackingFields}
            <div><button type="button" className={styles.button} onClick={saveTracking} disabled={busy}>Save tracking</button></div>
          </div>
        </details>
      ) : null}
      <ConfirmDialog
        open={Boolean(pending)}
        title={pending ? `${LABELS[pending]}?` : ""}
        confirmLabel={pending ? LABELS[pending] : "Confirm"}
        tone={pending === "CANCELLED" ? "danger" : "default"}
        busy={busy}
        onConfirm={run}
        onCancel={() => setPending(null)}
      >
        {pending === "SHIPPED" ? trackingFields : null}
        {pending === "CANCELLED" ? (
          paid ? (
            <p className={`${styles.callout} ${styles.calloutBad}`}>This order was paid. Cancelling returns the items to stock but does <strong>not</strong> refund the customer. Issue the refund in the Razorpay dashboard; refunds from this admin arrive in a later release.</p>
          ) : (
            <p>The order is unpaid. Cancelling releases any stock held for it.</p>
          )
        ) : null}
        <TextareaField id="transition-note" label="Internal note" optional density="compact" rows={2} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} error={errors.note} />
      </ConfirmDialog>
    </div>
  );
}
