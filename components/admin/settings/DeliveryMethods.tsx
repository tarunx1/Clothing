"use client";
import { useUnsavedSettings } from "./useUnsavedSettings";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDeliveryAction } from "@/lib/admin/actions/integrations";
import { FormField, SelectField, SwitchField } from "@/components/ui/FormField";
import admin from "../admin.module.css";
import styles from "./settings.module.css";
export interface DeliveryRecord { id?: string; code: string; name: string; description: string; price: number; currency: string; enabled: boolean; estimatedMinDays: number; estimatedMaxDays: number }
function DeliveryForm({ initial }: { initial: DeliveryRecord }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const dirty = JSON.stringify(saved) !== JSON.stringify(value);
  useUnsavedSettings(dirty);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return <form data-settings-dirty={dirty} className={styles.section} onSubmit={async (event) => {
    event.preventDefault(); setBusy(true);
    try { const result = await saveDeliveryAction(value); setMessage(result.ok ? "Saved." : result.error); if (result.ok) { setSaved(value); router.refresh(); } }
    catch { setMessage("Unable to save."); } finally { setBusy(false); }
  }}><h2>{initial.name || "New delivery method"}</h2><div className={styles.fields}>
    {(["code", "name", "description", "price", "estimatedMinDays", "estimatedMaxDays"] as const).map((key) => <FormField density="compact" key={key} id={`delivery-${initial.id ?? "new"}-${key}`} label={key === "price" ? "Price (minor units)" : key.replace(/([A-Z])/g, " $1")} value={value[key]} type={typeof initial[key] === "number" ? "number" : "text"} onChange={(event) => setValue({ ...value, [key]: typeof initial[key] === "number" ? Number(event.target.value) : event.target.value })} />)}
    <SelectField density="compact" id={`delivery-${initial.id ?? "new"}-currency`} label="Currency" value={value.currency} onChange={(event) => setValue({ ...value, currency: event.target.value })}>{["INR", "USD", "CAD"].map((code) => <option key={code}>{code}</option>)}</SelectField>
    <SwitchField id={`delivery-${initial.id ?? "new"}-enabled`} label="Enabled" checked={value.enabled} onChange={(event) => setValue({ ...value, enabled: event.target.checked })} />
  </div><div className={styles.bar}><button className={admin.button} disabled={busy}>Save delivery method</button><p role="status">{message}</p></div></form>;
}
export function DeliveryMethods({ methods }: { methods: DeliveryRecord[] }) {
  return <>{methods.map((method) => <DeliveryForm key={method.id} initial={method} />)}<details><summary>Add delivery method</summary><DeliveryForm initial={{ code: "", name: "", description: "", price: 0, currency: "INR", enabled: true, estimatedMinDays: 3, estimatedMaxDays: 7 }} /></details></>;
}
