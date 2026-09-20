"use client";
import { useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import type { SecretStatus } from "@/lib/settings/settingsService";
import admin from "../admin.module.css";
import styles from "./settings.module.css";

export function SecretField({ id, label, status, value, onChange, error }: { id: string; label: string; status?: SecretStatus; value?: string | null; onChange: (value: string | null | undefined) => void; error?: string }) {
  const [replacing, setReplacing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return <div className={styles.secret}>
    <div className={styles.secretHead}><strong>{label}</strong><span>{value === null ? "Removal pending" : status?.configured ? "Configured" : "Not configured"}</span>
      <button type="button" className={admin.button} onClick={() => { setReplacing(!replacing); onChange(undefined); }}>{replacing ? "Cancel replacement" : status?.configured ? "Replace key" : "Add key"}</button>
      {status?.configured ? <button type="button" className={admin.button} onClick={() => setConfirm(true)}>Disconnect</button> : null}
    </div>
    {replacing ? <FormField density="compact" id={id} label={`New ${label.toLowerCase()}`} type="password" autoComplete="new-password" value={value ?? ""} onChange={(event) => onChange(event.target.value || undefined)} error={error} hint="Encrypted on save. The saved value is never returned to this form." /> : error ? <p role="alert">{error}</p> : null}
    <ConfirmDialog open={confirm} title={`Disconnect ${label.toLowerCase()}?`} confirmLabel="Mark for removal" onCancel={() => setConfirm(false)} onConfirm={() => { onChange(null); setReplacing(false); setConfirm(false); }}><p>The credential will be removed when you save this section.</p></ConfirmDialog>
  </div>;
}
