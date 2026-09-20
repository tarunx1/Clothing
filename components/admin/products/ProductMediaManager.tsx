"use client";

import { useState } from "react";
import { addProductImagesAction, removeProductImageAction, reorderProductImagesAction, updateProductImageAction } from "@/lib/admin/actions/products";
import { IMAGE_TYPES } from "@/lib/admin/validation";
import { MediaManager, type MediaItem } from "../media/MediaManager";
import { useToast } from "../Toaster";
import styles from "../admin.module.css";
import media from "../media/media.module.css";

interface ProductImage extends MediaItem { type: string; colorId: string | null }

const TYPE_LABELS: Record<string, string> = { FRONT: "Front", BACK: "Back", DETAIL: "Detail", MODEL: "Model", LIFESTYLE: "Lifestyle", OTHER: "Other" };

function ImageEditor({ image, colors, readOnly, onSaved }: { image: ProductImage; colors: { id: string; name: string }[]; readOnly?: boolean; onSaved: (patch: Partial<ProductImage>) => void }) {
  const notify = useToast();
  const [alt, setAlt] = useState(image.alt);
  const [type, setType] = useState(image.type);
  const [colorId, setColorId] = useState(image.colorId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const dirty = alt !== image.alt || type !== image.type || colorId !== (image.colorId ?? "");
  const save = async () => {
    setBusy(true);
    const result = await updateProductImageAction(image.id, { alt, type, colorId });
    setBusy(false);
    if (!result.ok) {
      setError(result.fieldErrors?.alt ?? result.error);
      return;
    }
    setError(undefined);
    onSaved({ alt, type, colorId: colorId || null });
    notify("Image updated.");
  };
  const id = `img-${image.id}`;
  return (
    <div className={media.editorRow}>
      <label className={styles.small}>
        Alt text
        <input className={styles.select} style={{ width: "100%", paddingRight: 10, background: "#fff" }} value={alt} disabled={readOnly} onChange={(event) => setAlt(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
      </label>
      <label className={styles.small}>
        Type
        <select className={styles.select} style={{ width: "100%" }} value={type} disabled={readOnly} onChange={(event) => setType(event.target.value)}>
          {IMAGE_TYPES.map((value) => <option key={value} value={value}>{TYPE_LABELS[value]}</option>)}
        </select>
      </label>
      <label className={styles.small}>
        Colour
        <select className={styles.select} style={{ width: "100%" }} value={colorId} disabled={readOnly} onChange={(event) => setColorId(event.target.value)}>
          <option value="">All colours</option>
          {colors.map((color) => <option key={color.id} value={color.id}>{color.name}</option>)}
        </select>
      </label>
      {!readOnly ? <button type="button" className={styles.button} disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save"}</button> : null}
      {error ? <span id={`${id}-error`} role="alert" className={styles.small} style={{ color: "var(--a-bad)", gridColumn: "1 / -1" }}>{error}</span> : null}
    </div>
  );
}

export function ProductMediaManager({ productId, images, colors, readOnly }: { productId: string; images: ProductImage[]; colors: { id: string; name: string }[]; readOnly?: boolean }) {
  return (
    <MediaManager<ProductImage>
      title="Images"
      description="The first image is the listing image. Drag or use the arrows to reorder."
      items={images}
      folder="products"
      readOnly={readOnly}
      emptyText="No images yet. Upload front, back and detail shots."
      onAdd={(files) => addProductImagesAction(productId, files)}
      onRemove={(id) => removeProductImageAction(id)}
      onReorder={(ids) => reorderProductImagesAction(productId, ids)}
      renderEditor={(image, save) => <ImageEditor key={image.id} image={image} colors={colors} readOnly={readOnly} onSaved={save} />}
    />
  );
}
