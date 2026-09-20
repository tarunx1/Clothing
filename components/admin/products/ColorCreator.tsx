"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { createColorAction } from "@/lib/admin/actions/products";
import { toSlug } from "@/lib/admin/validation";
import { useToast } from "../Toaster";
import styles from "../admin.module.css";

export interface ColorOption { id: string; name: string; slug: string; hex: string | null; enabled: boolean }

/** Creates a reusable colour (name, slug, hex) shared by every product. */
export function ColorCreator({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (color: ColorOption) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const notify = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [hex, setHex] = useState("#1a1a1a");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);
  const reset = () => { setName(""); setSlug(""); setSlugTouched(false); setHex("#1a1a1a"); setErrors({}); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = await createColorAction({ name, slug: slugTouched ? slug : toSlug(name), hex });
    setBusy(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? { name: result.error });
      return;
    }
    notify(result.message ?? "Colour added.");
    onCreated(result.data);
    reset();
    onClose();
  };
  return (
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) { reset(); onClose(); } }}>
      <form onSubmit={submit} noValidate>
        <div className={styles.dialogBody}>
          <h2 id={titleId}>New colour</h2>
          <FormField id="color-name" label="Name" density="compact" value={name} onChange={(event) => setName(event.target.value)} error={errors.name} autoFocus />
          <FormField id="color-slug" label="Slug" density="compact" value={slugTouched ? slug : toSlug(name)} onChange={(event) => { setSlugTouched(true); setSlug(event.target.value); }} error={errors.slug} />
          <div style={{ display: "flex", alignItems: "end", gap: 10 }}>
            <div style={{ flex: 1 }}><FormField id="color-hex" label="Hex" density="compact" value={hex} onChange={(event) => setHex(event.target.value)} error={errors.hex} /></div>
            <label className="sr-only" htmlFor="color-picker">Pick colour</label>
            <input id="color-picker" type="color" value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : "#000000"} onChange={(event) => setHex(event.target.value)} style={{ width: 44, height: 36, border: "1px solid #c9c9c1", borderRadius: 6, background: "#fff", padding: 2 }} />
          </div>
        </div>
        <div className={styles.dialogFoot}>
          <button type="button" className={styles.button} onClick={() => { reset(); onClose(); }} disabled={busy}>Cancel</button>
          <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={busy}>{busy ? "Saving…" : "Add colour"}</button>
        </div>
      </form>
    </dialog>
  );
}
