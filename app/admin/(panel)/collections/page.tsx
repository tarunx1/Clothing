import type { Metadata } from "next";
import Link from "next/link";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CollectionList } from "@/components/admin/collections/CollectionList";
import styles from "@/components/admin/admin.module.css";
import { explorerConfig } from "@/config/site";
import { can, requireAdminPage } from "@/lib/admin/authorization";
import { listCollectionsForAdmin } from "@/lib/admin/services/collectionAdmin";

export const metadata: Metadata = { title: "Collections" };

export default async function AdminCollectionsPage() {
  const actor = await requireAdminPage("dashboard:view");
  const collections = await listCollectionsForAdmin();
  const editable = can(actor, "catalog:write");
  return (
    <>
      <AdminHeader
        title="Collections"
        description="Drag to reorder. The order controls the homepage explorer and shop filters."
        actions={editable ? <Link className={`${styles.button} ${styles.primary}`} href="/admin/collections/new">Add collection</Link> : null}
      />
      {collections.length ? (
        <CollectionList key={collections.map((collection) => `${collection.id}${collection.featured}${collection.enabled}`).join()} collections={collections} maxFeatured={explorerConfig.maxCollections} editable={editable} />
      ) : (
        <div className={`${styles.panel} ${styles.empty}`}><strong>No collections yet</strong><p>Create one to organise products and feature it on the homepage.</p></div>
      )}
    </>
  );
}
