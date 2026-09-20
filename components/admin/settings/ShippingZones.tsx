"use client";
import { FormField, SwitchField } from "@/components/ui/FormField";
import type { SettingsOf } from "@/lib/settings/registry";
import admin from "../admin.module.css";
import styles from "./settings.module.css";
type Zone = SettingsOf<"shipping.zones">["zones"][number];

export function ShippingZones({ value, onChange }: { value: unknown; onChange: (zones: Zone[]) => void }) {
  const zones = value as Zone[];
  const update = (index: number, change: Partial<Zone>) => onChange(zones.map((zone, i) => i === index ? { ...zone, ...change } : zone));
  return <div className={styles.rows}>{zones.map((zone, index) => <div key={zone.id} className={styles.row}>
    <FormField density="compact" id={`zone-${zone.id}-name`} label="Zone name" value={zone.name} onChange={(event) => update(index, { name: event.target.value })} />
    <SwitchField id={`zone-${zone.id}-enabled`} label="Zone enabled" checked={zone.enabled} onChange={(event) => update(index, { enabled: event.target.checked })} />
    <FormField density="compact" id={`zone-${zone.id}-countries`} label="Country codes (comma separated)" value={zone.countries.join(", ")} onChange={(event) => update(index, { countries: event.target.value.split(",").map((v) => v.trim().toUpperCase()) })} />
    <FormField density="compact" id={`zone-${zone.id}-regions`} label="Regions (empty for whole countries)" value={zone.regions.join(", ")} onChange={(event) => update(index, { regions: event.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} />
    {zone.methods.map((method, m) => <div className={styles.row} key={m}>
      <FormField density="compact" id={`zone-${index}-method-${m}`} label="Delivery method code" value={method.code} onChange={(event) => update(index, { methods: zone.methods.map((v, i) => i === m ? { ...v, code: event.target.value } : v) })} />
      <SwitchField id={`zone-${index}-method-${m}-enabled`} label="Method enabled in zone" checked={method.enabled} onChange={(event) => update(index, { methods: zone.methods.map((v, i) => i === m ? { ...v, enabled: event.target.checked } : v) })} />
      <FormField density="compact" id={`zone-${index}-rate-${m}`} label="Rate override (minor units, empty for default)" type="number" min={0} value={method.rate ?? ""} onChange={(event) => update(index, { methods: zone.methods.map((v, i) => i === m ? { ...v, rate: event.target.value === "" ? null : Number(event.target.value) } : v) })} />
      <button type="button" className={admin.button} onClick={() => update(index, { methods: zone.methods.filter((_, i) => i !== m) })}>Remove method</button>
    </div>)}
    <button type="button" className={admin.button} onClick={() => update(index, { methods: [...zone.methods, { code: "", enabled: true, rate: null }] })}>Add delivery method</button>
    <button type="button" className={admin.button} onClick={() => onChange(zones.filter((_, i) => i !== index))}>Remove zone</button>
  </div>)}<button type="button" className={admin.button} onClick={() => onChange([...zones, { id: crypto.randomUUID(), name: "", enabled: true, countries: [], regions: [], methods: [] }])}>Add zone</button></div>;
}
