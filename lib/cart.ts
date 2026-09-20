import { products as catalog } from "@/data/products";
import { shopConfig } from "@/config/shop";
import { defaultColor, findVariant, findVariantById, isVariantAvailable, listingImages, productHref } from "@/lib/products";
import type { BagLine, Product, ProductImage, ProductVariant } from "@/types/product";

/*
 * Pure cart logic: persisted-data validation, stock limits and totals. The
 * store (hooks/useBag.ts) and every cart surface build on these, so there is
 * one definition of what a valid line, a count and a subtotal are.
 *
 * A cart item's id is its variant id (variant ids are unique across the
 * catalog), so the same product + variant can only ever occupy one row.
 */
export type CartItemId = string;

const findProduct = (productId: string, products: readonly Product[]) => products.find((p) => p.id === productId);

/** Largest quantity a variant may reach in the bag: the per-line cap or its stock. */
export function variantLimit(variant: ProductVariant | null | undefined): number {
  return variant && isVariantAvailable(variant) ? Math.min(shopConfig.maxQuantity, variant.stock) : 0;
}

export function itemLimitIn(lines: readonly BagLine[], itemId: CartItemId, products: readonly Product[] = catalog): number {
  const line = lines.find((l) => l.variantId === itemId);
  const product = line ? findProduct(line.productId, products) : undefined;
  return variantLimit(product ? findVariantById(product, itemId) : null);
}

/**
 * Validates whatever was stored: unknown products/variants and sold-out
 * variants are dropped, quantities are clamped to stock, legacy
 * `{ productId, size }` lines migrate, and duplicate rows merge.
 */
export function parseStoredCart(raw: string | null, products: readonly Product[] = catalog): BagLine[] {
  let value: unknown;
  try { value = JSON.parse(raw ?? "[]"); } catch { return []; }
  if (!Array.isArray(value)) return [];
  const merged = new Map<string, BagLine>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const line = entry as Partial<BagLine> & { size?: unknown };
    if (typeof line.productId !== "string") continue;
    const product = findProduct(line.productId, products);
    if (!product || typeof line.quantity !== "number" || !Number.isInteger(line.quantity) || line.quantity <= 0) continue;
    const variant = typeof line.variantId === "string"
      ? findVariantById(product, line.variantId)
      : typeof line.size === "string" ? findVariant(product, defaultColor(product), line.size) : null;
    const limit = variantLimit(variant);
    if (!variant || limit === 0) continue;
    const existing = merged.get(variant.id);
    const quantity = Math.min((existing?.quantity ?? 0) + line.quantity, limit);
    merged.set(variant.id, { productId: product.id, variantId: variant.id, quantity });
  }
  return [...merged.values()];
}

/** Adds (or merges) a line; returns null when nothing can be added. */
export function withItemAdded(lines: readonly BagLine[], productId: string, variantId: string, quantity: number, products: readonly Product[] = catalog): BagLine[] | null {
  const product = findProduct(productId, products);
  const limit = variantLimit(product ? findVariantById(product, variantId) : null);
  const existing = lines.find((line) => line.variantId === variantId);
  const next = Math.min((existing?.quantity ?? 0) + quantity, limit);
  if (!Number.isInteger(quantity) || quantity <= 0 || next <= (existing?.quantity ?? 0)) return null;
  return existing
    ? lines.map((line) => (line === existing ? { ...line, quantity: next } : line))
    : [...lines, { productId, variantId, quantity: next }];
}

/** Sets a quantity, clamped to 1…limit. Removal is explicit (see withItemRemoved). */
export function withQuantity(lines: readonly BagLine[], itemId: CartItemId, quantity: number, products: readonly Product[] = catalog): BagLine[] {
  const limit = itemLimitIn(lines, itemId, products);
  return lines.map((line) => (line.variantId === itemId ? { ...line, quantity: Math.max(1, Math.min(Math.round(quantity), limit)) } : line));
}

export const withItemRemoved = (lines: readonly BagLine[], itemId: CartItemId) => lines.filter((line) => line.variantId !== itemId);

/** Header convention: total units, not unique rows (2 tees + 1 hoodie = 3). */
export const cartCount = (lines: readonly BagLine[]) => lines.reduce((sum, line) => sum + line.quantity, 0);

export interface CartLineView {
  id: CartItemId;
  quantity: number;
  product: Product;
  variant: ProductVariant;
  image: ProductImage | null;
  href: string;
  unitPrice: number;
  lineTotal: number;
  limit: number;
}

/** Joins stored lines with live catalog data (no product copies are stored). */
export function resolveCart(lines: readonly BagLine[], products: readonly Product[] = catalog): CartLineView[] {
  return lines.flatMap((line) => {
    const product = findProduct(line.productId, products);
    const variant = product ? findVariantById(product, line.variantId) : null;
    if (!product || !variant) return [];
    return [{
      id: variant.id,
      quantity: line.quantity,
      product,
      variant,
      image: listingImages(product)[0],
      href: productHref(product),
      unitPrice: variant.price,
      lineTotal: variant.price * line.quantity,
      limit: variantLimit(variant),
    }];
  });
}

/** Subtotal is variant price × quantity; no discounts, taxes or shipping are invented. */
export const cartSubtotal = (views: readonly CartLineView[]) => views.reduce((sum, line) => sum + line.lineTotal, 0);

/** Store currency: the bag holds one currency (the catalog's). */
export const cartCurrency = (views: readonly CartLineView[]) => views[0]?.product.currency ?? shopConfig.currency;

export interface CartIssue { itemId: CartItemId; kind: "unavailable" | "reduced"; available: number }

/** Pre-checkout check against current inventory (the backend will re-validate). */
export function validateCart(lines: readonly BagLine[], products: readonly Product[] = catalog): CartIssue[] {
  return lines.flatMap((line): CartIssue[] => {
    const limit = itemLimitIn(lines, line.variantId, products);
    if (limit === 0) return [{ itemId: line.variantId, kind: "unavailable", available: 0 }];
    return line.quantity > limit ? [{ itemId: line.variantId, kind: "reduced", available: limit }] : [];
  });
}
