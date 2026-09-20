"use client";
import { useState } from "react";
import { testIntegrationAction } from "@/lib/admin/actions/integrations";
import { FormField } from "@/components/ui/FormField";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import admin from "../admin.module.css";
import styles from "./settings.module.css";
export function ConnectionTest({ id }: { id: string }) {
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  async function test() {
    setBusy(true);
    try { const result = await testIntegrationAction(id, recipient); setMessage(result.ok ? result.data.message : result.error); } catch { setMessage("Connection test could not complete."); } finally { setBusy(false); setConfirm(false); }
  }
  return <div className={styles.section}>
    {id === "email" ? <FormField density="compact" id="test-email-recipient" label="Test recipient" type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} /> : null}
    <div className={styles.bar}><button type="button" className={admin.button} disabled={busy} onClick={() => id === "email" ? setConfirm(true) : void test()}>{busy ? "Testing…" : id === "email" ? "Send test email" : "Test connection"}</button><p role="status" className={styles.status}>{message}</p></div>
    <ConfirmDialog open={confirm} title="Send a real test email?" confirmLabel="Send test email" busy={busy} onCancel={() => setConfirm(false)} onConfirm={() => void test()}><p>A connection test message will be sent to {recipient} using the saved email provider.</p></ConfirmDialog>
  </div>;
}
