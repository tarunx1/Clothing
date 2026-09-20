"use client";
import { useActionState } from "react";
import { unlockStore } from "@/app/store-access/actions";
import { FormField } from "@/components/ui/FormField";
export function StoreAccessForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(unlockStore, { error: "" });
  return <form action={action}><input type="hidden" name="next" value={next} /><FormField id="store-password" label="Store password" name="password" type="password" autoComplete="current-password" required error={state.error} /><button disabled={pending} style={{ padding: "16px 24px", border: "1px solid currentColor", marginTop: 16 }}>{pending ? "Checking…" : "Enter store"}</button></form>;
}
