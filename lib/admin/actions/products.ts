"use server";

import { runAdminAction } from "@/lib/admin/actionRunner";
import { isProductSlugAvailable } from "@/lib/admin/services/productAdmin";
import * as products from "@/lib/admin/services/productAdmin";
import { requireAdminAction } from "@/lib/admin/authorization";
import { slugField } from "@/lib/admin/validation";

export async function createProductAction(values: unknown) {
  return runAdminAction("catalog:write", (actor) => products.createProduct(actor, values), "Product created.");
}

export async function updateProductAction(id: string, values: unknown) {
  return runAdminAction("catalog:write", (actor) => products.updateProduct(actor, id, values), "Product saved.");
}

export async function setProductEnabledAction(id: string, enabled: boolean) {
  return runAdminAction("catalog:write", (actor) => products.setProductEnabled(actor, id, Boolean(enabled)), enabled ? "Product enabled." : "Product disabled.");
}

export async function deleteProductAction(id: string) {
  return runAdminAction("catalog:write", (actor) => products.deleteProduct(actor, id), "Product deleted.");
}

export async function saveVariantsAction(productId: string, values: unknown) {
  return runAdminAction("catalog:write", (actor) => products.saveVariantMatrix(actor, productId, values), "Variants saved.");
}

export async function createColorAction(values: unknown) {
  return runAdminAction("catalog:write", (actor) => products.createColor(actor, values), "Colour added.");
}

export async function addProductImagesAction(productId: string, items: unknown) {
  return runAdminAction("catalog:write", (actor) => products.addProductImages(actor, productId, items), "Images added.");
}

export async function updateProductImageAction(imageId: string, values: unknown) {
  return runAdminAction("catalog:write", (actor) => products.updateProductImage(actor, imageId, values), "Image updated.");
}

export async function removeProductImageAction(imageId: string) {
  return runAdminAction("catalog:write", (actor) => products.removeProductImage(actor, imageId), "Image removed.");
}

export async function reorderProductImagesAction(productId: string, ids: unknown) {
  return runAdminAction("catalog:write", (actor) => products.reorderProductImages(actor, productId, ids), "Order saved.");
}

/** Live hint while typing; the save still re-checks uniqueness. */
export async function checkProductSlugAction(slug: string, exceptId?: string) {
  await requireAdminAction("catalog:write");
  const parsed = slugField.safeParse(slug);
  if (!parsed.success) return { available: false };
  return { available: await isProductSlugAvailable(parsed.data, exceptId) };
}
