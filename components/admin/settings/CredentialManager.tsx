"use client";
import { useUnsavedSettings } from "./useUnsavedSettings";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiKeyAction, credentialAction, webhookAction } from "@/lib/admin/actions/integrations";
import { STORE_EVENTS } from "@/lib/webhooks/events";
import { FormField, SwitchField } from "@/components/ui/FormField";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import admin from "../admin.module.css";
import styles from "./settings.module.css";

export interface ManagedRecord { id: string; name: string; detail: string; enabled?: boolean; revoked?: boolean }
const SCOPES = ["READ_PRODUCTS", "WRITE_PRODUCTS", "READ_ORDERS", "WRITE_ORDERS", "READ_INVENTORY", "WRITE_INVENTORY"];
export function CredentialManager({ kind, records }: { kind: "webhooks" | "api-keys" | "credentials"; records: ManagedRecord[] }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [service, setService] = useState("");
  const [secret, setSecret] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [once, setOnce] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ action: string; id?: string } | null>(null);
  const dirty = Boolean(name || url || service || secret || selected.length);
  useUnsavedSettings(dirty);
  const router = useRouter();
  async function run(action: string, id?: string) {
    setBusy(true); setOnce("");
    try {
      const result = kind === "webhooks" ? await webhookAction(action as "create", id ? { id, enabled: !records.find((r) => r.id === id)?.enabled } : { name, url, events: selected, enabled })
        : kind === "api-keys" ? await apiKeyAction(action as "create", id ? { id } : { name, permissions: selected })
        : await credentialAction(action as "save", id ? { id } : { label: name, service, endpoint: url, secret });
      if (!result.ok) setMessage(result.error);
      else {
        if ("secret" in result.data && result.data.secret) setOnce(result.data.secret);
        setMessage("message" in result.data ? result.data.message ?? "Saved." : "Saved. Copy the generated secret now; it will not be shown again.");
        if (!id) { setName(""); setService(""); setSecret(""); setUrl(""); setSelected([]); }
        router.refresh();
      }
    } catch { setMessage("Could not complete this change. Try again."); }
    finally { setBusy(false); setPending(null); }
  }
  return <section className={styles.section} data-settings-dirty={dirty}>
    {kind === "api-keys" ? <p className={styles.description}>Scoped credentials for future store API integrations. No external API endpoints are enabled by creating a key.</p> : null}
    <ul className={styles.list}>{records.map((record) => <li key={record.id}><div><strong>{record.name}</strong><p>{record.detail}</p><span>{record.revoked ? "Revoked" : record.enabled === false ? "Disabled" : "Configured"}</span></div>
      <div className={styles.bar}>
        {kind === "webhooks" ? <><button type="button" className={admin.button} onClick={() => setPending({ action: "test", id: record.id })}>Send test event</button><button type="button" className={admin.button} onClick={() => setPending({ action: "update", id: record.id })}>{record.enabled ? "Disable" : "Enable"}</button></> : null}
        {kind !== "credentials" && !record.revoked ? <button type="button" className={admin.button} onClick={() => setPending({ action: "rotate", id: record.id })}>Rotate</button> : null}
        {!record.revoked ? <button type="button" className={admin.button} onClick={() => setPending({ action: kind === "api-keys" ? "revoke" : "delete", id: record.id })}>{kind === "api-keys" ? "Revoke" : "Delete"}</button> : null}
      </div>
    </li>)}</ul>
    <h2>Create {kind === "webhooks" ? "webhook" : kind === "api-keys" ? "API key" : "custom credential"}</h2>
    <form className={styles.fields} onSubmit={(event) => { event.preventDefault(); void run(kind === "credentials" ? "save" : "create"); }}>
      <FormField density="compact" id={`${kind}-name`} label="Name" required value={name} onChange={(event) => setName(event.target.value)} />
      {kind !== "api-keys" ? <FormField density="compact" id={`${kind}-url`} label={kind === "webhooks" ? "Destination URL" : "Endpoint (optional)"} value={url} onChange={(event) => setUrl(event.target.value)} required={kind === "webhooks"} /> : null}
      {kind === "credentials" ? <>
        <FormField density="compact" id="credential-service" label="Service" required value={service} onChange={(event) => setService(event.target.value)} />
        <FormField density="compact" id="credential-value" label="Credential / key and secret" type="password" autoComplete="new-password" required value={secret} onChange={(event) => setSecret(event.target.value)} hint="Store the complete credential here. All of it is encrypted; none is redisplayed." />
      </> : <fieldset className={styles.choices}><legend>{kind === "webhooks" ? "Events" : "Permissions"}</legend>{(kind === "webhooks" ? STORE_EVENTS : SCOPES.map((value) => ({ value, label: value.replaceAll("_", " ").toLowerCase() }))).map((option) => <label key={option.value}><input type="checkbox" checked={selected.includes(option.value)} onChange={(event) => setSelected((old) => event.target.checked ? [...old, option.value] : old.filter((v) => v !== option.value))} />{option.label}</label>)}</fieldset>}
      {kind === "webhooks" ? <SwitchField id="webhook-enabled" label="Enabled" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> : null}
      <button className={`${admin.button} ${admin.primary}`} disabled={busy}>{busy ? "Saving…" : "Create"}</button>
    </form>
    <p className={styles.status} role="status">{message}</p>
    {once ? <div className={styles.once}><strong>Shown once — copy and store securely</strong><p>{once}</p><button type="button" className={admin.button} onClick={() => { setOnce(""); setMessage("Secret dismissed."); }}>I have saved it</button></div> : null}
    <ConfirmDialog open={Boolean(pending)} title={pending?.action === "test" ? "Send a real test event?" : "Confirm integration change"} confirmLabel="Confirm" busy={busy} onCancel={() => setPending(null)} onConfirm={() => pending && void run(pending.action, pending.id)}><p>{pending?.action === "test" ? "A signed test payload will be sent to this webhook’s configured destination." : "Revoking or rotating credentials can disconnect existing integrations."}</p></ConfirmDialog>
  </section>;
}
