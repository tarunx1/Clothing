import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { CollectionForm } from "@/components/admin/collections/CollectionForm";
import { requireAdminPage } from "@/lib/admin/authorization";

export const metadata: Metadata = { title: "New collection" };

export default async function NewCollectionPage() {
  await requireAdminPage("catalog:write");
  return (
    <>
      <AdminHeader title="New collection" description="Reel images are added after the collection is created." back={{ href: "/admin/collections", label: "Collections" }} />
      <CollectionForm mode="create" defaults={{ name: "", slug: "", shortDescription: "", description: "", enabled: false, featured: false }} />
    </>
  );
}
