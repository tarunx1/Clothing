import "server-only";
import { unstable_cache } from "next/cache";
import { collections as mockCollections } from "@/data/collections";
import { products as mockProducts } from "@/data/products";
import { findVisibleCollections } from "@/lib/repositories/collectionRepository";
import { findEnabledProducts, findProductBySlug as findDbProductBySlug } from "@/lib/repositories/productRepository";
import type { Collection } from "@/types/collection";
import type { Product } from "@/types/product";
import { getInventoryPolicy, sellableQuantity } from "@/lib/services/storePolicy";

const allowDevelopmentFallback = process.env.NODE_ENV !== "production" && process.env.CATALOG_FALLBACK_TO_MOCKS !== "false";

async function withDevelopmentFallback<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (!allowDevelopmentFallback) throw error;
    console.warn("Database catalog unavailable; using development seed data.", error instanceof Error ? error.message : error);
    return fallback;
  }
}

const cachedCollections = unstable_cache(findVisibleCollections, ["storefront-collections"], {
  revalidate: 300,
  tags: ["catalog", "collections"],
});

export const getCollections = (): Promise<Collection[]> => withDevelopmentFallback(cachedCollections, mockCollections);

// Product reads include live inventory, so they intentionally bypass the route cache.
// Stock shown to shoppers follows Settings → Inventory (tracking, overselling, hiding sold-out items).
export async function getProducts(): Promise<Product[]> {
  const policy = await getInventoryPolicy().catch(() => null);
  const products = await withDevelopmentFallback(() => findEnabledProducts(policy ? (inventory) => sellableQuantity(inventory, policy) : undefined), mockProducts);
  if (!policy?.hideSoldOut) return products;
  return products.filter((product) => product.variants.some((variant) => variant.enabled && variant.stock > 0));
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const policy = await getInventoryPolicy().catch(() => null);
  return withDevelopmentFallback(() => findDbProductBySlug(slug, policy ? (inventory) => sellableQuantity(inventory, policy) : undefined), mockProducts.find((product) => product.slug === slug) ?? null);
}

export async function getRelatedProducts(product: Product, limit = 3): Promise<Product[]> {
  const all = await getProducts();
  const picked = new Map<string, Product>();
  for (const id of product.relatedIds ?? []) {
    const match = all.find((candidate) => candidate.id === id);
    if (match && match.id !== product.id) picked.set(match.id, match);
  }
  for (const candidate of all) {
    if (picked.size >= limit) break;
    if (candidate.id !== product.id && candidate.collectionId === product.collectionId) picked.set(candidate.id, candidate);
  }
  return [...picked.values()].slice(0, limit);
}
