import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { requireAdminPage } from "@/lib/admin/authorization";
import { getCatalogOptions } from "@/lib/admin/services/productAdmin";
import { getSettings } from "@/lib/settings/settingsService";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireAdminPage("catalog:write");
  const [{ collections }, settings] = await Promise.all([getCatalogOptions(), getSettings("localization")]);
  return (
    <>
      <AdminHeader title="New product" description="Save the basics first; images and variants are added on the next screen." back={{ href: "/admin/products", label: "Products" }} />
      <ProductForm
        mode="create"
        collections={collections}
        defaults={{ name: "", slug: "", subtitle: "", description: "", details: "", collectionId: collections[0]?.id ?? "", basePrice: "", currency: settings.defaultCurrency, material: "", gsm: "", fit: "", fitAdvice: "", fitNotes: "", print: "", care: "", model3dUrl: "", featured: false, enabled: false }}
      />
    </>
  );
}
