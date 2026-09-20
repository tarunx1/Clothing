"use client";
import { useState } from "react";
import { advancedSettingsAction, exportSettingsAction, importSettingsAction, setStorePasswordAction } from "@/lib/admin/actions/settings";
import { FormField, TextareaField } from "@/components/ui/FormField";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import admin from "../admin.module.css";
import styles from "./settings.module.css";

export function AdvancedSettings({ security = false }: { security?: boolean }) {
  const [password, setPassword] = useState("");
  const [file, setFile] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<"cache" | "reencrypt" | "import" | "password" | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(action: "export" | "preview" | "cache" | "reencrypt" | "import" | "password") {
    setBusy(true); setMessage("");
    try {
      if (action === "export") {
        const result = await exportSettingsAction();
        if (!result.ok) { setMessage(result.error); return; }
        const url = URL.createObjectURL(new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = "store-settings.json"; link.click(); URL.revokeObjectURL(url);
        setMessage("Non-secret settings exported.");
      } else {
        const result = action === "import" || action === "preview" ? await importSettingsAction(JSON.parse(file), action === "preview") : action === "password" ? await setStorePasswordAction(password) : await advancedSettingsAction(action);
        setMessage(result.ok ? "plan" in (result.data ?? {}) ? JSON.stringify(result.data) : result.message ?? "Completed." : result.error);
        if (result.ok && action === "password") setPassword("");
      }
    } catch { setMessage("Unable to complete the action. Check your input and try again."); }
    finally { setBusy(false); setPending(null); }
  }
  return <section className={styles.section}>
    {security ? <><h2>Store preview password</h2><p className={styles.description}>Changing the password invalidates existing preview sessions. Enable password protection in Store status after setting it.</p><FormField density="compact" id="new-store-password" label="New store password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} /><button className={admin.button} disabled={busy || password.length < 12} onClick={() => setPending("password")}>Replace store password</button></> : <>
      <h2>Import and export</h2><p className={styles.description}>Exports exclude passwords, credentials, tokens and signing secrets. Keep the encryption root key in deployment configuration and back it up separately.</p>
      <button className={admin.button} disabled={busy} onClick={() => void run("export")}>Export non-secret settings</button>
      <TextareaField density="compact" id="settings-import" label="Settings JSON" rows={8} value={file} onChange={(event) => setFile(event.target.value)} />
      <div className={styles.bar}><button className={admin.button} disabled={busy || !file} onClick={() => void run("preview")}>Validate import</button><button className={admin.button} disabled={busy || !file} onClick={() => setPending("import")}>Apply import</button></div>
      <h2>Maintenance tools</h2><div className={styles.bar}><button className={admin.button} onClick={() => setPending("cache")}>Clear settings caches</button><button className={admin.button} onClick={() => setPending("reencrypt")}>Re-encrypt with current server key</button></div>
    </>}
    <p className={styles.status} role="status">{message}</p>
    <ConfirmDialog open={Boolean(pending)} title="Confirm configuration change" confirmLabel="Confirm" busy={busy} onCancel={() => setPending(null)} onConfirm={() => pending && void run(pending)}><p>This action updates store configuration. Re-encryption requires both the new and previous keys to be configured on the server.</p></ConfirmDialog>
  </section>;
}
