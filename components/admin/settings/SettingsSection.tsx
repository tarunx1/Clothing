"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField, SelectField, SwitchField, TextareaField } from "@/components/ui/FormField";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useUpload } from "@/components/admin/media/useUpload";
import { saveSettingsAction } from "@/lib/admin/actions/settings";
import { getNamespace, type NamespaceId } from "@/lib/settings/registry";
import { bpsToPercent, minorToDecimal, type FieldDef } from "@/lib/settings/fields";
import type { SecretStatus } from "@/lib/settings/settingsService";
import { useUnsavedSettings } from "./useUnsavedSettings";
import { SecretField } from "./SecretField";
import { ShippingZones } from "./ShippingZones";
import admin from "../admin.module.css";
import styles from "./settings.module.css";

const asText = (value: unknown) => value == null ? "" : String(value);
const formatted = (field: Pick<FieldDef, "type">, value: unknown) => typeof value === "number" && field.type === "money" ? minorToDecimal(value) : typeof value === "number" && field.type === "percent" ? bpsToPercent(value) : asText(value);

export function SettingsSection({ namespace, initial, statuses, manageCredentials = false }: { namespace: NamespaceId; initial: Record<string, unknown>; statuses: Record<string, SecretStatus>; manageCredentials?: boolean }) {
  const def = getNamespace(namespace)!;
  const [values, setValues] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [secrets, setSecrets] = useState<Record<string, string | null>>({});
  const [secretVersion, setSecretVersion] = useState(0);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const router = useRouter();
  const { upload, progress } = useUpload("branding", "image", "settings");
  const dirty = JSON.stringify(values) !== JSON.stringify(saved) || Object.keys(secrets).length > 0;
  useUnsavedSettings(dirty);
  const set = (key: string, value: unknown) => setValues((old) => ({ ...old, [key]: value }));

  async function save(confirmed = false) {
    setBusy(true); setErrors({}); setMessage("");
    try {
      const result = await saveSettingsAction(namespace, { values, secrets, confirmed });
      if (!result.ok) { setMessage(result.error); setErrors(result.fieldErrors ?? {}); }
      else { setSaved(values); setSecrets({}); setSecretVersion((version) => version + 1); setMessage("Settings saved."); router.refresh(); }
    } catch { setMessage("Could not save. Your changes are still here; try again."); }
    finally { setBusy(false); setConfirm(false); }
  }

  return <section className={styles.section} data-settings-dirty={dirty}>
    <h2>{def.title}</h2><p className={styles.description}>{def.description}</p>
    {values.mode === "live" && values.enabled ? <p className={styles.badge}>LIVE PAYMENTS ENABLED</p> : null}
    <form onSubmit={(event) => {
      event.preventDefault();
      const sensitive = def.fields.some((field) => field.sensitive && JSON.stringify(values[field.key]) !== JSON.stringify(saved[field.key]));
      if (sensitive || Object.values(secrets).some((value) => value === null)) setConfirm(true); else void save();
    }}>
      <div className={styles.fields}>{def.fields.filter((field) => field.type !== "secret" || manageCredentials).map((field, index) => {
        if (field.showIf && !field.showIf.in.includes(values[field.showIf.key])) return null;
        const id = `setting-${namespace}-${field.key}`;
        const props = { id, label: field.label, hint: field.help, error: errors[field.key], density: "compact" as const, disabled: field.readOnly || busy };
        let control;
        if (field.type === "secret") control = <SecretField key={secretVersion} id={id} label={field.label} status={statuses[field.key]} value={secrets[field.key]} error={errors[field.key]} onChange={(value) => setSecrets((old) => { const next = { ...old }; if (value === undefined) delete next[field.key]; else next[field.key] = value; return next; })} />;
        else if (namespace === "shipping.zones" && field.key === "zones") control = <ShippingZones value={values[field.key]} onChange={(value) => set(field.key, value)} />;
        else if (field.type === "switch") control = <SwitchField {...props} checked={Boolean(values[field.key])} onChange={(event) => set(field.key, event.target.checked)} />;
        else if (field.type === "select") control = <SelectField {...props} value={asText(values[field.key])} onChange={(event) => set(field.key, event.target.value)}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField>;
        else if (field.type === "multiselect") control = <fieldset className={styles.rows}><legend>{field.label}</legend><div className={styles.choices}>{field.options?.map((option) => {
          const list = values[field.key] as string[];
          return <label key={option.value}><input type="checkbox" checked={list.includes(option.value)} disabled={props.disabled} onChange={(event) => set(field.key, event.target.checked ? [...list, option.value] : list.filter((item) => item !== option.value))} />{option.label}</label>;
        })}</div>{field.key === "priority" ? (values[field.key] as string[]).map((item, rank, list) => <div key={item}>{rank + 1}. {item} <button type="button" className={admin.button} disabled={!rank} onClick={() => { const next = [...list]; [next[rank - 1], next[rank]] = [next[rank], next[rank - 1]]; set(field.key, next); }}>Move up</button></div>) : null}{errors[field.key] ? <p role="alert">{errors[field.key]}</p> : null}</fieldset>;
        else if (field.type === "rows") control = <fieldset className={styles.rows}><legend>{field.label}</legend>{(values[field.key] as Record<string, unknown>[]).map((row, rowIndex, rows) => <div className={styles.row} key={rowIndex}>{field.columns?.map((column) => {
          const update = (value: unknown) => set(field.key, rows.map((entry, i) => i === rowIndex ? { ...entry, [column.key]: value } : entry));
          const common = { id: `${id}-${rowIndex}-${column.key}`, label: column.label, density: "compact" as const, placeholder: column.placeholder };
          return column.type === "select" ? <SelectField key={column.key} {...common} value={asText(row[column.key])} onChange={(event) => update(event.target.value)}>{column.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</SelectField> : <FormField key={column.key} {...common} value={column.type === "list" ? (row[column.key] as string[] ?? []).join(", ") : column.type === "percent" ? formatted({ type: "percent" }, row[column.key]) : asText(row[column.key])} onChange={(event) => update(column.type === "list" ? event.target.value.split(",").map((entry) => entry.trim()).filter(Boolean) : event.target.value)} />;
        })}<button className={admin.button} type="button" onClick={() => set(field.key, rows.filter((_, i) => i !== rowIndex))}>Remove row</button></div>)}<button type="button" className={admin.button} onClick={() => set(field.key, [...values[field.key] as unknown[], Object.fromEntries((field.columns ?? []).map((column) => [column.key, column.type === "list" ? [] : column.options?.[0]?.value ?? ""]))])}>Add row</button>{errors[field.key] ? <p role="alert">{errors[field.key]}</p> : null}</fieldset>;
        else if (field.type === "textarea" || field.type === "list") control = <TextareaField {...props} rows={3} value={field.type === "list" ? (values[field.key] as string[]).join("\n") : asText(values[field.key])} onChange={(event) => set(field.key, field.type === "list" ? event.target.value.split("\n") : event.target.value)} />;
        else control = <><FormField {...props} placeholder={field.placeholder} type={field.type === "image" || field.type === "money" || field.type === "percent" || field.type === "datetime" ? "text" : field.type} inputMode={field.type === "money" || field.type === "percent" ? "decimal" : undefined} value={formatted(field, values[field.key])} onChange={(event) => set(field.key, event.target.value)} />{field.type === "image" ? <FormField density="compact" id={`${id}-upload`} label={`Upload ${field.label.toLowerCase()}`} type="file" accept="image/png,image/jpeg,image/webp,image/avif" disabled={Boolean(progress)} onChange={async (event) => {
          const file = event.target.files?.[0]; if (!file) return;
          const result = await upload([file]);
          if (result.uploaded[0]) set(field.key, result.uploaded[0].url);
          if (result.errors.length) setMessage(result.errors.join(" "));
        }} /> : null}</>;
        return <div key={field.key}>{field.group && field.group !== def.fields[index - 1]?.group ? <h3 className={styles.group}>{field.group}</h3> : null}{control}</div>;
      })}</div>
      <div className={styles.bar}><button className={`${admin.button} ${admin.primary}`} disabled={busy || !dirty}>{busy ? "Saving…" : `Save ${def.title.toLowerCase()}`}</button><p className={styles.status} role="status">{message || (dirty ? "Unsaved changes" : "")}</p></div>
    </form>
    <ConfirmDialog open={confirm} title="Confirm sensitive settings change" confirmLabel="Confirm and save" busy={busy} onCancel={() => setConfirm(false)} onConfirm={() => void save(true)}><p>This changes store access, provider mode, or credentials. Live payment mode can charge real money. Review your selection before saving.</p></ConfirmDialog>
  </section>;
}
