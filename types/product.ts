/**
 * Catalog model. Every storefront surface (shop grid, quick view, bag, product
 * page) derives from these records, so a future admin/API can own them.
 */
export const productSizes = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export type ProductSize = (typeof productSizes)[number];

export type CurrencyCode = "INR" | "CAD" | "USD";
export type ProductImageType = "front" | "back" | "detail" | "model" | "lifestyle" | "other";

export interface ProductImage {
  id: string;
  src: string;
  alt: string;
  type?: ProductImageType;
  order: number;
  /** Colorway this image shows; untagged images apply to every color. */
  color?: string;
  /** Art direction: focus point (0–1) and optional crop zoom for close-ups. */
  focalPoint?: { x: number; y: number };
  zoom?: number;
}

export interface ProductVariant {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex?: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  enabled: boolean;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  subtitle?: string;
  /** Short product statement, shown under the price. */
  description: string;
  /** Longer copy for the Details disclosure; falls back to `description`. */
  details?: string;
  /** Base price for listings; a selected variant's own price takes precedence. */
  price: number;
  currency: CurrencyCode;
  collectionId: string;
  collection?: Collection;
  material?: string;
  gsm?: number;
  fit?: string;
  /** Short fit facts, e.g. "Dropped shoulder". */
  fitNotes?: string[];
  /** One line of sizing advice shown beside the size selector. */
  fitAdvice?: string;
  /** Print or finish technique, e.g. "High-density print". */
  print?: string;
  care?: string[];
  /** Key into config/sizeGuide.ts charts. */
  sizeChart?: string;
  images: ProductImage[];
  variants: ProductVariant[];
  featured?: boolean;
  /** Higher is newer; drives the shop's "Newest" sort. */
  releaseOrder: number;
  /** Curated related products; same-collection pieces fill any gap. */
  relatedIds?: string[];
  /** Optional interactive garment. Skipped when the file is missing. */
  model3d?: { glb: string };
}

export interface ShopFilters {
  collections: string[];
  sizes: ProductSize[];
  colors: string[];
  maxPrice: number;
  inStock: boolean;
}

export type ShopSort = "featured" | "price-asc" | "price-desc" | "newest";

/** One bag line per product variant. */
export interface BagLine {
  productId: string;
  variantId: string;
  quantity: number;
}
import type { Collection } from "@/types/collection";
