"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";
import { FormField, SelectField, SwitchField, TextareaField } from "@/components/ui/FormField";
import { checkProductSlugAction, createProductAction, updateProductAction } from "@/lib/admin/actions/products";
import { productFormSchema, toSlug, type ProductFormValues } from "@/lib/admin/validation";
import { useToast } from "../Toaster";
import { useUpload } from "../media/useUpload";
import styles from "../admin.module.css";

interface ProductFormProps {
  mode: "create" | "edit";
  productId?: string;
  defaults: ProductFormValues;
  collections: { id: string; name: string; enabled: boolean }[];
  readOnly?: boolean;
}

/** One form for NEW and EDIT. Validation is shared with the server action (lib/admin/validation). */
export function ProductForm({ mode, productId, defaults, collections, readOnly }: ProductFormProps) {
  const router = useRouter();
  const notify = useToast();
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [slugHint, setSlugHint] = useState<string | undefined>();
  const { register, handleSubmit, setValue, setError, control, reset, formState: { errors, isSubmitting, isDirty } } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });
  const name = useWatch({ control, name: "name" });
  const slug = useWatch({ control, name: "slug" });
  const model = useWatch({ control, name: "model3dUrl" });
  const { upload, progress } = useUpload("models", "model");
  const modelInput = useRef<HTMLInputElement>(null);

  // Slug follows the name until edited by hand.
  useEffect(() => {
    if (!slugTouched) setValue("slug", toSlug(name ?? ""), { shouldDirty: true });
  }, [name, slugTouched, setValue]);

  useEffect(() => {
    if (!slug || readOnly) return;
    const timer = window.setTimeout(async () => {
      const result = await checkProductSlugAction(slug, productId);
      setSlugHint(result.available ? undefined : "Another product already uses this slug.");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [slug, productId, readOnly]);

  const submit = async (values: ProductFormValues) => {
    const result = mode === "create" ? await createProductAction(values) : await updateProductAction(productId!, values);
    if (!result.ok) {
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) setError(field as Path<ProductFormValues>, { message }, { shouldFocus: true });
      notify(result.error, "error");
      return;
    }
    notify(result.message ?? "Product saved.");
    if (mode === "create") router.push(`/admin/products/${result.data.id}`);
    else {
      reset(values);
      router.refresh();
    }
  };

  const uploadModel = async (file?: File) => {
    if (!file) return;
    const { uploaded, errors: uploadErrors } = await upload([file]);
    uploadErrors.forEach((message) => notify(message, "error"));
    if (uploaded[0]) {
      setValue("model3dUrl", uploaded[0].url, { shouldDirty: true, shouldValidate: true });
      notify("Model uploaded. Save the product to use it.");
    }
  };

  const field = (id: keyof ProductFormValues) => ({ id: `product-${id}`, density: "compact" as const, error: errors[id]?.message, disabled: readOnly });

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className={styles.stack} aria-label={mode === "create" ? "New product" : "Product details"}>
      <section className={styles.panel} aria-labelledby="product-basics">
        <div className={styles.panelHead}><h2 id="product-basics">Basics</h2></div>
        <div className={`${styles.panelBody} ${styles.fields}`}>
          <FormField label="Name" {...field("name")} {...register("name")} />
          <FormField
            label="Slug"
            hint={slugHint ?? `Store URL: /product/${slug || "…"}`}
            {...field("slug")}
            {...register("slug", { onChange: () => setSlugTouched(true) })}
          />
          <FormField label="Subtitle" optional {...field("subtitle")} {...register("subtitle")} />
          <TextareaField label="Description" rows={4} {...field("description")} {...register("description")} />
          <TextareaField label="Details" optional rows={3} hint="Construction and fabric notes shown in the product accordion." {...field("details")} {...register("details")} />
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="product-pricing">
        <div className={styles.panelHead}><h2 id="product-pricing">Pricing and organisation</h2></div>
        <div className={`${styles.panelBody} ${styles.fields}`}>
          <div className={styles.fieldRow3}>
            <FormField label="Base price" inputMode="decimal" hint="Variants inherit this unless overridden." {...field("basePrice")} {...register("basePrice")} />
            <SelectField label="Currency" {...field("currency")} {...register("currency")}>
              <option value="INR">INR ₹</option>
              <option value="USD">USD $</option>
              <option value="CAD">CAD $</option>
            </SelectField>
            <SelectField label="Collection" {...field("collectionId")} {...register("collectionId")}>
              <option value="">Select a collection</option>
              {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}{collection.enabled ? "" : " (disabled)"}</option>)}
            </SelectField>
          </div>
          <div className={styles.fieldRow3}>
            <FormField label="Material" optional {...field("material")} {...register("material")} />
            <FormField label="GSM" optional inputMode="numeric" {...field("gsm")} {...register("gsm")} />
            <FormField label="Fit" optional placeholder="Oversized" {...field("fit")} {...register("fit")} />
          </div>
          <div className={styles.fieldRow}>
            <TextareaField label="Fit notes" optional rows={3} hint="One note per line." {...field("fitNotes")} {...register("fitNotes")} />
            <TextareaField label="Care" optional rows={3} hint="One instruction per line." {...field("care")} {...register("care")} />
          </div>
          <div className={styles.fieldRow}>
            <FormField label="Fit advice" optional {...field("fitAdvice")} {...register("fitAdvice")} />
            <FormField label="Print" optional {...field("print")} {...register("print")} />
          </div>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="product-visibility">
        <div className={styles.panelHead}><h2 id="product-visibility">Visibility and 3D</h2></div>
        <div className={`${styles.panelBody} ${styles.fields}`}>
          <div className={styles.fieldRow}>
            <SwitchField id="product-enabled" label="Live in the store" hint="Disabled products are hidden from the shop but keep their order history." disabled={readOnly} {...register("enabled")} />
            <SwitchField id="product-featured" label="Featured" hint="Featured products sort first in the shop." disabled={readOnly} {...register("featured")} />
          </div>
          <FormField
            label="3D model (GLB)"
            optional
            placeholder="/models/tee.glb or https://…"
            hint={model ? "The product page offers the 3D view when this file is available." : "Upload a .glb (max 30 MB) or paste a URL. Used later for AR."}
            {...field("model3dUrl")}
            {...register("model3dUrl")}
          />
          {!readOnly ? (
            <div className={styles.actions}>
              <input ref={modelInput} type="file" accept=".glb,model/gltf-binary" hidden onChange={(event) => { void uploadModel(event.target.files?.[0]); event.target.value = ""; }} />
              <button type="button" className={styles.button} onClick={() => modelInput.current?.click()} disabled={Boolean(progress)}>{progress ? "Uploading…" : "Upload GLB"}</button>
              {model ? <button type="button" className={`${styles.button} ${styles.ghost}`} onClick={() => setValue("model3dUrl", "", { shouldDirty: true })}>Remove model</button> : null}
            </div>
          ) : null}
        </div>
      </section>

      {!readOnly ? (
        <div className={styles.actions} style={{ justifyContent: "flex-end" }}>
          {mode === "edit" && isDirty ? <span className={styles.muted} role="status">Unsaved changes</span> : null}
          <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={isSubmitting} aria-busy={isSubmitting || undefined}>
            {isSubmitting ? "Saving…" : mode === "create" ? "Create product" : "Save product"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
