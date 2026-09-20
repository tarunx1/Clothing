import { products as catalog } from "@/data/products";
import { collections } from "@/data/collections";
import { productConfig } from "@/config/product";
import { productSizes, type Product, type ProductImage, type ProductVariant } from "@/types/product";

/** Development seed helpers retained for pure unit tests and offline fallback. */
export async function getProducts(): Promise<Product[]> { return catalog; }
export async function getProductBySlug(slug: string): Promise<Product | null> {
  return catalog.find((product) => product.slug === slug) ?? null;
}
export async function getRelatedProducts(product: Product, limit: number = productConfig.relatedLimit): Promise<Product[]> {
  const picked = new Map<string, Product>();
  for (const id of product.relatedIds ?? []) {
    const match = catalog.find((candidate) => candidate.id === id);
    if (match && match.id !== product.id) picked.set(match.id, match);
  }
  for (const candidate of catalog) {
    if (picked.size >= limit) break;
    if (candidate.id !== product.id && candidate.collectionId === product.collectionId) picked.set(candidate.id, candidate);
  }
  return [...picked.values()].slice(0, limit);
}

export const productHref = (product: Pick<Product, "slug">) => `/product/${product.slug}`;

export function getProductCollection(product: Pick<Product, "collectionId" | "collection">) {
  if (product.collection) return product.collection;
  return collections.find((collection) => collection.id === product.collectionId || collection.slug === product.collectionId) ?? null;
}

// ---------------------------------------------------------------- variants

export const enabledVariants = (product: Product) => product.variants.filter((variant) => variant.enabled);

export const isVariantAvailable = (variant: ProductVariant | null | undefined) => Boolean(variant?.enabled && variant.stock > 0);

export const isProductAvailable = (product: Product) => enabledVariants(product).some(isVariantAvailable);

export type StockStatus = "in-stock" | "low-stock" | "sold-out";

export function stockStatus(variant: ProductVariant): StockStatus {
  if (!isVariantAvailable(variant)) return "sold-out";
  return variant.stock <= productConfig.lowStockThreshold ? "low-stock" : "in-stock";
}

const sizeRank = (size: string) => {
  const index = (productSizes as readonly string[]).indexOf(size);
  return index === -1 ? productSizes.length : index;
};

export const sortSizes = <T extends string>(sizes: T[]) => [...sizes].sort((a, b) => sizeRank(a) - sizeRank(b));

/** Every size offered in any color, in canonical order. */
export const productSizeList = (product: Product) => sortSizes([...new Set(enabledVariants(product).map((v) => v.size))]);

export interface ProductColor {
  name: string;
  hex?: string;
  available: boolean;
}

/** Colors in catalog order, flagged by whether any size is in stock. */
export function productColors(product: Product): ProductColor[] {
  const colors = new Map<string, ProductColor>();
  for (const variant of enabledVariants(product)) {
    const current = colors.get(variant.color);
    colors.set(variant.color, {
      name: variant.color,
      hex: current?.hex ?? variant.colorHex,
      available: Boolean(current?.available) || isVariantAvailable(variant),
    });
  }
  return [...colors.values()];
}

/** First color with stock (or the first color when everything is sold out). */
export function defaultColor(product: Product): string | null {
  const colors = productColors(product);
  return (colors.find((c) => c.available) ?? colors[0])?.name ?? null;
}

/** One entry per size for a color: the variant, or null when that size does not exist. */
export function sizeOptions(product: Product, color: string | null) {
  return productSizeList(product).map((size) => ({
    size,
    variant: enabledVariants(product).find((v) => v.color === color && v.size === size) ?? null,
  }));
}

export function findVariant(product: Product, color: string | null, size: string | null) {
  if (!color || !size) return null;
  return enabledVariants(product).find((v) => v.color === color && v.size === size) ?? null;
}

export const findVariantById = (product: Product, variantId: string) =>
  product.variants.find((variant) => variant.id === variantId) ?? null;

/** Ordered imagery for a color: color-tagged images when they exist, otherwise the shared set. */
export function productImages(product: Product, color?: string | null): ProductImage[] {
  const sorted = [...product.images].sort((a, b) => a.order - b.order);
  const tagged = color ? sorted.filter((image) => image.color === color) : [];
  return tagged.length ? [...tagged, ...sorted.filter((image) => !image.color)] : sorted.filter((image) => !image.color || !color);
}

/** Listing image pair (primary + hover), independent of seed shape. */
export function listingImages(product: Product): [ProductImage | null, ProductImage | null] {
  const images = productImages(product).filter((image) => !image.zoom);
  return [images[0] ?? null, images[1] ?? null];
}

/** Human color summary for listings: "Washed black" or "3 colours". */
export function colorSummary(product: Product) {
  const colors = productColors(product);
  return colors.length === 1 ? colors[0].name : `${colors.length} colours`;
}

/** Facts for the editorial attribute strip, derived from data (never hard-coded). */
export function productAttributes(product: Product): string[] {
  return [
    product.gsm ? `${product.gsm} GSM` : null,
    product.material ?? null,
    product.fit ? `${product.fit} fit` : null,
    product.print ?? null,
  ].filter((value): value is string => Boolean(value));
}
