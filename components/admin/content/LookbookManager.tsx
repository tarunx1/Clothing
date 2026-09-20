"use client";

import { useState } from "react";
import { addLookbookImagesAction, removeLookbookImageAction, reorderLookbookLaneAction, updateLookbookImageAction } from "@/lib/admin/actions/content";
import { MediaManager, type MediaItem } from "../media/MediaManager";
import { useToast } from "../Toaster";
import styles from "../admin.module.css";

interface LookbookItem extends MediaItem { lane: number; enabled: boolean; creditName: string; creditUrl: string }

function LookbookEditor({ item, onSaved, onMoved }: { item: LookbookItem; onSaved: (patch: Partial<LookbookItem>) => void; onMoved: (item: LookbookItem) => void }) {
  const notify = useToast();
  const [draft, setDraft] = useState(item);
  const [busy, setBusy] = useState(false);
  const dirty = draft.alt !== item.alt || draft.lane !== item.lane || draft.enabled !== item.enabled || draft.creditName !== item.creditName || draft.creditUrl !== item.creditUrl;
  const save = async () => {
    setBusy(true);
    const result = await updateLookbookImageAction(item.id, { alt: draft.alt, lane: draft.lane, enabled: draft.enabled, creditName: draft.creditName, creditUrl: draft.creditUrl });
    setBusy(false);
    if (!result.ok) return notify(Object.values(result.fieldErrors ?? {})[0] ?? result.error, "error");
    notify("Image updated.");
    if (draft.lane !== item.lane) onMoved({ ...draft });
    else onSaved(draft);
  };
  const input = { className: styles.select, style: { width: "100%", paddingRight: 10, background: "#fff" } };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label className={styles.small}>Alt text<input {...input} value={draft.alt} onChange={(event) => setDraft({ ...draft, alt: event.target.value })} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, alignItems: "end" }}>
        <label className={styles.small}>Lane
          <select className={styles.select} style={{ width: "100%" }} value={draft.lane} onChange={(event) => setDraft({ ...draft, lane: Number(event.target.value) })}>
            {[1, 2, 3].map((lane) => <option key={lane} value={lane}>Lane {lane}</option>)}
          </select>
        </label>
        <label className={styles.small}>Credit<input {...input} value={draft.creditName} placeholder="Photographer" onChange={(event) => setDraft({ ...draft, creditName: event.target.value })} /></label>
        <label className={styles.small}>Credit URL<input {...input} value={draft.creditUrl} placeholder="https://" onChange={(event) => setDraft({ ...draft, creditUrl: event.target.value })} /></label>
        <label className={styles.small} style={{ display: "inline-flex", gap: 6, alignItems: "center", minHeight: 34 }}>
          <input type="checkbox" role="switch" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} /> Visible
        </label>
        <button type="button" className={styles.button} disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

/** Three lanes, matching the homepage layout. Each lane is ordered independently. */
export function LookbookManager({ images }: { images: LookbookItem[] }) {
  const [lanes, setLanes] = useState(() => ({ 1: images.filter((image) => image.lane === 1), 2: images.filter((image) => image.lane === 2), 3: images.filter((image) => image.lane === 3) }));
  const [version, setVersion] = useState(0);
  const move = (item: LookbookItem, from: number) => {
    setLanes((current) => ({ ...current, [from]: current[from as 1].filter((entry) => entry.id !== item.id), [item.lane]: [...current[item.lane as 1], item] }));
    setVersion((value) => value + 1);
  };
  return (
    <div className={styles.stack}>
      {([1, 2, 3] as const).map((lane) => (
        <MediaManager<LookbookItem>
          key={`${lane}-${version}`}
          title={`Lookbook lane ${lane}`}
          description={lane === 1 ? "Lanes are the three columns of the homepage lookbook, top to bottom." : undefined}
          items={lanes[lane]}
          folder="lookbook"
          scope="content"
          emptyText="No images in this lane."
          onAdd={async (files) => {
            const result = await addLookbookImagesAction(lane, files);
            if (result.ok) setLanes((current) => ({ ...current, [lane]: [...current[lane], ...result.data] }));
            return result;
          }}
          onRemove={async (id) => {
            const result = await removeLookbookImageAction(id);
            if (result.ok) setLanes((current) => ({ ...current, [lane]: current[lane].filter((entry) => entry.id !== id) }));
            return result;
          }}
          onReorder={async (ids) => {
            const result = await reorderLookbookLaneAction(lane, ids);
            if (result.ok) setLanes((current) => ({ ...current, [lane]: ids.map((id) => current[lane].find((entry) => entry.id === id)!).filter(Boolean) }));
            return result;
          }}
          renderEditor={(item, save) => <LookbookEditor key={item.id} item={item} onSaved={save} onMoved={(moved) => move(moved, lane)} />}
        />
      ))}
    </div>
  );
}
