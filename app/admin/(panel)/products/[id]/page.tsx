import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { DeleteProductButton } from "@/components/admin/products/DeleteProductButton";
import { ProductForm } from "@/components/admin/products/ProductForm";
import { ProductMediaManager } from "@/components/admin/products/ProductMediaManager";
import { VariantMatrix } from "@/components/admin/products/VariantMatrix";
import { StatusBadge } from "@/components/admin/StatusBadge";
import styles from "@/components/admin/admin.module.css";
import { can, requireAdminPage } from "@/lib/admin/authorization";
import { getCatalogOptions, getProductEditor } from "@/lib/admin/services/productAdmin";
import { fromMinorUnits } from "@/lib/admin/validation";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  const actor = await requireAdminPage("dashboard:view");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [product, options] = await Promise.all([getProductEditor(id), getCatalogOptions()]);
  if (!product) notFound();
  const editable = can(actor, "catalog:write");
  const productColors = options.colors.filter((color) => product.variants.some((variant) => variant.colorId === color.id));
  const variantKey = product.variants.map((variant) => `${variant.id}${variant.sku}${variant.enabled}${variant.inventory?.quantity}`).join("|");
  return (
    <>
      <AdminHeader
        title={product.name}
        description={<><StatusBadge tone={product.enabled ? "ok" : "neutral"}>{product.enabled ? "Live" : "Disabled"}</StatusBadge>{product.featured ? <> <StatusBadge tone="info">Featured</StatusBadge></> : null}</>}
        back={{ href: "/admin/products", label: "Products" }}
        actions={
          <>
            {product.enabled ? <a className={styles.button} href={`/product/${product.slug}`} target="_blank" rel="noreferrer">View in store</a> : null}
            {editable ? <DeleteProductButton id={product.id} name={product.name} orderLines={product._count.orderItems} enabled={product.enabled} /> : null}
          </>
        }
      />
      {!editable ? <p className={`${styles.callout} ${styles.calloutInfo}`} style={{ marginBottom: 16 }}>You can view this product. Editing the catalog needs an administrator role.</p> : null}
      <div className={styles.stack}>
        <ProductForm
          mode="edit"
          productId={product.id}
          readOnly={!editable}
          collections={options.collections}
          defaults={{
            name: product.name,
            slug: product.slug,
            subtitle: product.subtitle ?? "",
            description: product.description,
            details: product.details ?? "",
            collectionId: product.collectionId,
            basePrice: fromMinorUnits(product.basePrice),
            currency: product.currency,
            material: product.material ?? "",
            gsm: product.gsm ? String(product.gsm) : "",
            fit: product.fit ?? "",
            fitAdvice: product.fitAdvice ?? "",
            fitNotes: product.fitNotes.join("\n"),
            print: product.print ?? "",
            care: product.care.join("\n"),
            model3dUrl: product.model3dUrl ?? "",
            featured: product.featured,
            enabled: product.enabled,
          }}
        />
        <ProductMediaManager
          productId={product.id}
          readOnly={!editable}
          colors={productColors.map((color) => ({ id: color.id, name: color.name }))}
          images={product.images.map((image) => ({ id: image.id, src: image.src, alt: image.alt, type: image.type, colorId: image.colorId }))}
        />
        <VariantMatrix
          key={variantKey}
          productId={product.id}
          productSlug={product.slug}
          basePrice={fromMinorUnits(product.basePrice)}
          colors={options.colors}
          sizes={options.sizes}
          editable={editable}
          canAdjustStock={can(actor, "inventory:write")}
          variants={product.variants.map((variant) => ({
            id: variant.id,
            colorId: variant.colorId,
            sizeId: variant.sizeId,
            sku: variant.sku,
            price: variant.price == null ? "" : fromMinorUnits(variant.price),
            compareAtPrice: variant.compareAtPrice == null ? "" : fromMinorUnits(variant.compareAtPrice),
            enabled: variant.enabled,
            quantity: variant.inventory?.quantity ?? 0,
            reserved: variant.inventory?.reservedQuantity ?? 0,
          }))}
        />
      </div>
    </>
  );
}
