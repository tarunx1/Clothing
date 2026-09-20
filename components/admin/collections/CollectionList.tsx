"use client";

import Link from "next/link";
import { useState } from "react";
import { reorderCollectionsAction, setCollectionFlagsAction } from "@/lib/admin/actions/collections";
import { SortableList } from "../media/SortableList";
import { StatusBadge } from "../StatusBadge";
import { Thumb } from "../Thumb";
import { useToast } from "../Toaster";
import styles from "../admin.module.css";

export interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  featured: boolean;
  productCount: number;
  imageCount: number;
  cover: { src: string; alt: string } | null;
}

/**
 * Drag (or arrow-button) ordering that drives the homepage Collection Explorer.
 * Order and flag changes are optimistic and rolled back if the server refuses.
 */
export function CollectionList({ collections: initial, maxFeatured, editable }: { collections: CollectionRow[]; maxFeatured: number; editable: boolean }) {
  const [collections, setCollections] = useState(initial);
  const notify = useToast();
  const featuredCount = collections.filter((collection) => collection.featured).length;
  const homepage = (collections.some((collection) => collection.featured) ? collections.filter((collection) => collection.featured) : collections).filter((collection) => collection.enabled).slice(0, maxFeatured);

  const reorder = async (next: CollectionRow[]) => {
    const previous = collections;
    setCollections(next);
    const result = await reorderCollectionsAction(next.map((collection) => collection.id));
    if (!result.ok) {
      setCollections(previous);
      notify(result.error, "error");
    } else notify(result.message ?? "Order saved.");
  };

  const setFlag = async (row: CollectionRow, flag: "enabled" | "featured", value: boolean) => {
    const previous = collections;
    setCollections((current) => current.map((collection) => (collection.id === row.id ? { ...collection, [flag]: value } : collection)));
    const result = await setCollectionFlagsAction(row.id, { [flag]: value });
    if (!result.ok) {
      setCollections(previous);
      notify(result.error, "error");
    } else notify(`${row.name}: ${flag === "enabled" ? (value ? "enabled" : "disabled") : value ? "featured on homepage" : "removed from homepage"}.`);
  };

  return (
    <div className={styles.stack}>
      <p className={`${styles.callout} ${styles.calloutInfo}`}>
        Homepage explorer ({homepage.length}/{maxFeatured}): {homepage.map((collection) => collection.name).join(" · ") || "none"}.
        {" "}Featured and enabled collections appear in this order{featuredCount ? "" : ". With none featured, the first enabled ones show"}.
      </p>
      <SortableList
        label="Collection order"
        items={collections}
        disabled={!editable}
        getId={(collection) => collection.id}
        getLabel={(collection) => collection.name}
        onReorder={reorder}
        renderItem={(collection, index) => (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <span className={styles.num} style={{ width: 18, color: "var(--a-faint)" }}>{index + 1}</span>
            <Thumb src={collection.cover?.src} />
            <span style={{ flex: "1 1 180px", minWidth: 0 }}>
              <Link className={styles.rowLink} href={`/admin/collections/${collection.id}`}>{collection.name}</Link>
              <span className={styles.cellSub}>/{collection.slug} · {collection.productCount} product{collection.productCount === 1 ? "" : "s"} · {collection.imageCount} reel image{collection.imageCount === 1 ? "" : "s"}</span>
            </span>
            <label className={styles.small} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" role="switch" checked={collection.enabled} disabled={!editable} onChange={(event) => void setFlag(collection, "enabled", event.target.checked)} />
              Enabled
            </label>
            <label className={styles.small} style={{ display: "inline-flex", alignItems: "center", gap: 6 }} title={!collection.featured && featuredCount >= maxFeatured ? `Maximum of ${maxFeatured} featured` : undefined}>
              <input type="checkbox" role="switch" checked={collection.featured} disabled={!editable || (!collection.featured && featuredCount >= maxFeatured)} onChange={(event) => void setFlag(collection, "featured", event.target.checked)} />
              Feature on homepage
            </label>
            {homepage.some((entry) => entry.id === collection.id) ? <StatusBadge tone="ok">On homepage</StatusBadge> : <StatusBadge tone="neutral">Shop only</StatusBadge>}
          </div>
        )}
      />
    </div>
  );
}
