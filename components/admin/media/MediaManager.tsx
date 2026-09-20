"use client";

import Image from "@/components/ui/StoreImage";
import { useRef, useState, type ReactNode } from "react";
import type { ActionResult } from "@/lib/admin/errors";
import { ConfirmDialog } from "../ConfirmDialog";
import { Icon } from "../icons";
import { useToast } from "../Toaster";
import { SortableList } from "./SortableList";
import { altFromFileName, useUpload, type UploadFolder } from "./useUpload";
import adminStyles from "../admin.module.css";
import styles from "./media.module.css";

export interface MediaItem {
  id: string;
  src: string;
  alt: string;
}

interface MediaManagerProps<T extends MediaItem> {
  title: string;
  description?: string;
  items: T[];
  folder: UploadFolder;
  scope?: "catalog" | "content";
  readOnly?: boolean;
  onAdd: (files: { url: string; alt: string }[]) => Promise<ActionResult<T[]>>;
  onRemove: (id: string) => Promise<ActionResult<unknown>>;
  onReorder: (ids: string[]) => Promise<ActionResult<unknown>>;
  /** Per-item editor (alt text and any extra fields); receives a save callback. */
  renderEditor: (item: T, save: (patch: Partial<T>) => void) => ReactNode;
  emptyText: string;
}

/**
 * Upload, preview, reorder (drag or keyboard), edit and remove images.
 * Storage is behind /api/admin/uploads; this component never knows the provider.
 */
export function MediaManager<T extends MediaItem>({ title, description, items: initial, folder, scope = "catalog", readOnly, onAdd, onRemove, onReorder, renderEditor, emptyText }: MediaManagerProps<T>) {
  const [items, setItems] = useState(initial);
  const [removing, setRemoving] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const notify = useToast();
  const { upload, progress } = useUpload(folder, "image", scope);

  const addFiles = async (files: File[]) => {
    if (!files.length || readOnly) return;
    const { uploaded, errors } = await upload(files);
    errors.forEach((error) => notify(error, "error"));
    if (!uploaded.length) return;
    const result = await onAdd(uploaded.map((file) => ({ url: file.url, alt: altFromFileName(file.name) })));
    if (result.ok) {
      setItems((current) => [...current, ...result.data]);
      notify(result.message ?? "Images added.");
    } else notify(result.error, "error");
  };

  // Optimistic: the new order shows immediately and is rolled back if the server refuses it.
  const reorder = async (next: T[]) => {
    const previous = items;
    setItems(next);
    const result = await onReorder(next.map((item) => item.id));
    if (!result.ok) {
      setItems(previous);
      notify(result.error, "error");
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setBusy(true);
    const result = await onRemove(removing.id);
    setBusy(false);
    if (result.ok) {
      setItems((current) => current.filter((item) => item.id !== removing.id));
      notify(result.message ?? "Image removed.");
      setRemoving(null);
    } else notify(result.error, "error");
  };

  return (
    <section className={adminStyles.panel} aria-labelledby={`${folder}-media-title`}>
      <div className={adminStyles.panelHead}>
        <div>
          <h2 id={`${folder}-media-title`}>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {!readOnly ? (
          <button type="button" className={adminStyles.button} onClick={() => input.current?.click()} disabled={Boolean(progress)}>
            <Icon name="upload" />{progress ? `Uploading ${progress.done}/${progress.total}…` : "Upload images"}
          </button>
        ) : null}
      </div>
      <div className={adminStyles.panelBody}>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple hidden onChange={(event) => { void addFiles([...(event.target.files ?? [])]); event.target.value = ""; }} />
        {!readOnly ? (
          <div
            className={styles.dropzone}
            data-active={dragActive || undefined}
            onDragOver={(event) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragActive(true); } }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => { event.preventDefault(); setDragActive(false); void addFiles([...event.dataTransfer.files]); }}
          >
            Drop JPEG, PNG, WebP or AVIF files here (max 10 MB each), or use <button type="button" className={adminStyles.linkButton} onClick={() => input.current?.click()}>Upload images</button>.
          </div>
        ) : null}
        {items.length ? (
          <SortableList
            label={`${title} order`}
            items={items}
            getId={(item) => item.id}
            getLabel={(item) => item.alt || "image"}
            onReorder={reorder}
            disabled={readOnly}
            renderItem={(item, index) => (
              <div className={styles.mediaRow}>
                <a href={item.src} target="_blank" rel="noreferrer" className={styles.preview} aria-label={`Open ${item.alt || "image"} full size`}>
                  <Image src={item.src} alt="" fill sizes="96px" />
                  <span className={styles.position}>{index + 1}</span>
                </a>
                <div className={styles.editor}>
                  {renderEditor(item, (patch) => setItems((current) => current.map((candidate) => (candidate.id === item.id ? { ...candidate, ...patch } : candidate))))}
                </div>
                {!readOnly ? (
                  <button type="button" className={adminStyles.iconButton} onClick={() => setRemoving(item)} aria-label={`Remove ${item.alt || "image"}`}><Icon name="trash" /></button>
                ) : null}
              </div>
            )}
          />
        ) : (
          <p className={adminStyles.muted}>{emptyText}</p>
        )}
      </div>
      <ConfirmDialog open={Boolean(removing)} title="Remove this image?" confirmLabel="Remove image" tone="danger" busy={busy} onConfirm={confirmRemove} onCancel={() => setRemoving(null)}>
        <p>The image is removed from the storefront immediately. Uploaded files are deleted from storage once nothing else uses them.</p>
      </ConfirmDialog>
    </section>
  );
}
