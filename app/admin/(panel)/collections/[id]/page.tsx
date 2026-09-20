import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CollectionForm } from "@/components/admin/collections/CollectionForm";
import { CollectionMediaManager } from "@/components/admin/collections/CollectionMediaManager";
import { DeleteCollectionButton } from "@/components/admin/collections/DeleteCollectionButton";
import { StatusBadge } from "@/components/admin/StatusBadge";
import styles from "@/components/admin/admin.module.css";
import { can, requireAdminPage } from "@/lib/admin/authorization";
import { getCollectionEditor } from "@/lib/admin/services/collectionAdmin";

export const metadata: Metadata = { title: "Edit collection" };

export default async function EditCollectionPage({ params }: PageProps<"/admin/collections/[id]">) {
  const actor = await requireAdminPage("dashboard:view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const collection = await getCollectionEditor(id);
  if (!collection) notFound();
  const editable = can(actor, "catalog:write");
  return (
    <>
      <AdminHeader
        title={collection.name}
        description={<><StatusBadge tone={collection.enabled ? "ok" : "neutral"}>{collection.enabled ? "Enabled" : "Disabled"}</StatusBadge>{collection.featured ? <> <StatusBadge tone="info">Featured on homepage</StatusBadge></> : null} <span className={styles.muted}>{collection._count.products} products</span></>}
        back={{ href: "/admin/collections", label: "Collections" }}
        actions={editable ? <DeleteCollectionButton id={collection.id} name={collection.name} productCount={collection._count.products} /> : null}
      />
      <div className={styles.stack}>
        <CollectionForm
          mode="edit"
          collectionId={collection.id}
          readOnly={!editable}
          defaults={{ name: collection.name, slug: collection.slug, shortDescription: collection.shortDescription, description: collection.description, enabled: collection.enabled, featured: collection.featured }}
        />
        <CollectionMediaManager collectionId={collection.id} readOnly={!editable} images={collection.images.map((image) => ({ id: image.id, src: image.src, alt: image.alt }))} />
      </div>
    </>
  );
}
