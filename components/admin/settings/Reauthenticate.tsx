"use client";
import { useState } from "react";
import { confirmPasswordAction } from "@/lib/admin/actions/settings";
import { FormField } from "@/components/ui/FormField";
import admin from "../admin.module.css";
import styles from "./settings.module.css";

export function Reauthenticate() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return <details className={styles.section}>
    <summary>Confirm your password for sensitive changes</summary>
    <form className={styles.bar} onSubmit={async (event) => {
      event.preventDefault(); setBusy(true);
      try { const result = await confirmPasswordAction(password); setMessage(result.ok ? result.message ?? "Confirmed." : result.error); setPassword(""); }
      catch { setMessage("Could not confirm. Try again."); } finally { setBusy(false); }
    }}>
      <FormField density="compact" id="settings-password-confirmation" label="Current password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      <button className={admin.button} disabled={busy}>{busy ? "Checking…" : "Confirm password"}</button>
      <p role="status" className={styles.status}>{message}</p>
    </form>
  </details>;
}
