"use client";

import { useState } from "react";
import { addCollectionImagesAction, removeCollectionImageAction, reorderCollectionImagesAction, updateCollectionImageAction } from "@/lib/admin/actions/collections";
import { MediaManager, type MediaItem } from "../media/MediaManager";
import { useToast } from "../Toaster";
import styles from "../admin.module.css";

function AltEditor({ item, readOnly, onSaved }: { item: MediaItem; readOnly?: boolean; onSaved: (patch: Partial<MediaItem>) => void }) {
  const notify = useToast();
  const [alt, setAlt] = useState(item.alt);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const result = await updateCollectionImageAction(item.id, { alt });
    setBusy(false);
    if (!result.ok) return notify(result.fieldErrors?.alt ?? result.error, "error");
    onSaved({ alt });
    notify("Alt text saved.");
  };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
      <label className={styles.small} style={{ flex: "1 1 220px" }}>
        Alt text
        <input className={styles.select} style={{ width: "100%", paddingRight: 10, background: "#fff" }} value={alt} disabled={readOnly} onChange={(event) => setAlt(event.target.value)} />
      </label>
      {!readOnly ? <button type="button" className={styles.button} disabled={alt === item.alt || busy} onClick={save}>{busy ? "Saving…" : "Save"}</button> : null}
    </div>
  );
}

/** Film-reel frames for one homepage explorer segment. The existing roll animation reads them in this order. */
export function CollectionMediaManager({ collectionId, images, readOnly }: { collectionId: string; images: MediaItem[]; readOnly?: boolean }) {
  return (
    <MediaManager
      title="Collection reel images"
      description="These frames roll vertically in the homepage explorer. Two or more enable the film-roll; portrait images work best."
      items={images}
      folder="collections"
      readOnly={readOnly}
      emptyText="No reel images yet. The explorer shows a placeholder frame until you upload one."
      onAdd={(files) => addCollectionImagesAction(collectionId, files)}
      onRemove={(id) => removeCollectionImageAction(id)}
      onReorder={(ids) => reorderCollectionImagesAction(collectionId, ids)}
      renderEditor={(item, save) => <AltEditor key={item.id} item={item} readOnly={readOnly} onSaved={save} />}
    />
  );
}
