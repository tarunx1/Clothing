"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { FormField, SwitchField, TextareaField } from "@/components/ui/FormField";
import { createCollectionAction, updateCollectionAction } from "@/lib/admin/actions/collections";
import { collectionFormSchema, toSlug, type CollectionFormValues } from "@/lib/admin/validation";
import { useToast } from "../Toaster";
import styles from "../admin.module.css";

export function CollectionForm({ mode, collectionId, defaults, readOnly }: { mode: "create" | "edit"; collectionId?: string; defaults: CollectionFormValues; readOnly?: boolean }) {
  const router = useRouter();
  const notify = useToast();
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const { register, handleSubmit, setValue, setError, control, reset, formState: { errors, isSubmitting } } = useForm<CollectionFormValues>({ resolver: zodResolver(collectionFormSchema), defaultValues: defaults, mode: "onBlur" });
  const name = useWatch({ control, name: "name" });
  useEffect(() => {
    if (!slugTouched) setValue("slug", toSlug(name ?? ""));
  }, [name, slugTouched, setValue]);
  const submit = async (values: CollectionFormValues) => {
    const result = mode === "create" ? await createCollectionAction(values) : await updateCollectionAction(collectionId!, values);
    if (!result.ok) {
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) setError(field as Path<CollectionFormValues>, { message }, { shouldFocus: true });
      notify(result.error, "error");
      return;
    }
    notify(result.message ?? "Saved.");
    if (mode === "create" && result.data && typeof result.data === "object" && "id" in result.data) router.push(`/admin/collections/${(result.data as { id: string }).id}`);
    else {
      reset(values);
      router.refresh();
    }
  };
  const field = (id: keyof CollectionFormValues) => ({ id: `collection-${id}`, density: "compact" as const, error: errors[id]?.message, disabled: readOnly });
  return (
    <form onSubmit={handleSubmit(submit)} noValidate className={styles.panel} aria-labelledby="collection-details">
      <div className={styles.panelHead}><h2 id="collection-details">Details</h2></div>
      <div className={`${styles.panelBody} ${styles.fields}`}>
        <div className={styles.fieldRow}>
          <FormField label="Name" {...field("name")} {...register("name")} />
          <FormField label="Slug" hint="Used in shop filters and future collection pages." {...field("slug")} {...register("slug", { onChange: () => setSlugTouched(true) })} />
        </div>
        <FormField label="Short description" hint="Shown on the homepage explorer." {...field("shortDescription")} {...register("shortDescription")} />
        <TextareaField label="Description" rows={4} {...field("description")} {...register("description")} />
        <div className={styles.fieldRow}>
          <SwitchField id="collection-enabled" label="Enabled" hint="Disabled collections are hidden, with their products." disabled={readOnly} {...register("enabled")} />
          <SwitchField id="collection-featured" label="Feature on homepage" hint="Up to 5 featured collections appear in the homepage explorer." disabled={readOnly} error={errors.featured?.message} {...register("featured")} />
        </div>
        {!readOnly ? (
          <div className={styles.actions} style={{ justifyContent: "flex-end" }}>
            <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={isSubmitting}>{isSubmitting ? "Saving…" : mode === "create" ? "Create collection" : "Save collection"}</button>
          </div>
        ) : null}
      </div>
    </form>
  );
}
