import { shopConfig } from "@/config/shop";
import { formatMoney } from "@/lib/money";
import { getProductCollection, isProductAvailable, productColors, productSizeList } from "@/lib/products";
import type { Product, ShopFilters, ShopSort } from "@/types/product";

/** Listing prices in the storefront currency. Product pages format with the product's own currency. */
export const formatPrice = (price: number) => formatMoney(price, shopConfig.currency);
export const emptyFilters = (maxPrice: number): ShopFilters => ({ collections: [], sizes: [], colors: [], maxPrice, inStock: false });

export function filterProducts(products: readonly Product[], filters: ShopFilters, sort: ShopSort) {
  const result = products.filter(product => {
    const collection = getProductCollection(product)?.slug;
    const sizes = productSizeList(product);
    const colors = productColors(product).map(color => color.name);
    return (!filters.collections.length || (collection !== undefined && filters.collections.includes(collection))) &&
      (!filters.sizes.length || filters.sizes.some(size => sizes.includes(size))) &&
      (!filters.colors.length || filters.colors.some(color => colors.includes(color))) &&
      product.price <= filters.maxPrice && (!filters.inStock || isProductAvailable(product));
  });
  if (sort === "price-asc") result.sort((a, b) => a.price - b.price);
  if (sort === "price-desc") result.sort((a, b) => b.price - a.price);
  if (sort === "newest") result.sort((a, b) => b.releaseOrder - a.releaseOrder);
  return result;
}

export const countFilters = (filters: ShopFilters, ceiling: number) => filters.collections.length + filters.sizes.length + filters.colors.length + Number(filters.maxPrice < ceiling) + Number(filters.inStock);
