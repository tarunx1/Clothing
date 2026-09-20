"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import { productConfig } from "@/config/product";
import { addItem, openBag, useBag } from "@/hooks/useBag";
import { variantLimit } from "@/lib/cart";
import {
  defaultColor,
  findVariant,
  isProductAvailable,
  isVariantAvailable,
  productColors,
  sizeOptions,
  stockStatus,
} from "@/lib/products";
import type { Product } from "@/types/product";

export type PurchaseState = "select" | "ready" | "added" | "limit" | "sold-out";

/**
 * Local selection + add-to-bag logic for one product. Shared by the purchase
 * panel and the mobile bar, so there is exactly one implementation. Selected
 * color/size stay local; only the bag is global. `initial` lets a future
 * `?color=&size=` URL preselect a variant.
 */
export function useProductPurchase(
  product: Product,
  sizeGroupRef: RefObject<HTMLFieldSetElement | null>,
  initial?: { color?: string | null; size?: string | null },
) {
  const colors = productColors(product);
  const [color, setColorState] = useState<string | null>(() =>
    initial?.color && colors.some((c) => c.name === initial.color) ? initial.color : defaultColor(product),
  );
  const [size, setSize] = useState<string | null>(() =>
    initial?.size && isVariantAvailable(findVariant(product, color, initial.size)) ? initial.size : null,
  );
  const [attention, setAttention] = useState(false);
  const [added, setAdded] = useState(false);
  const bag = useBag();

  const options = sizeOptions(product, color);
  const variant = findVariant(product, color, size);
  const purchasable = isVariantAvailable(variant) ? variant : null;
  const colorAvailable = colors.find((c) => c.name === color)?.available ?? false;
  const inBag = purchasable ? (bag.find((line) => line.variantId === purchasable.id)?.quantity ?? 0) : 0;
  const atLimit = purchasable ? inBag >= variantLimit(purchasable) : false;

  const state: PurchaseState = !isProductAvailable(product) || !colorAvailable
    ? "sold-out"
    : added ? "added"
    : !purchasable ? "select"
    : atLimit ? "limit"
    : "ready";

  // Price follows the chosen variant; otherwise the lowest price in this color.
  const colorPrices = options.flatMap(({ variant: v }) => (v ? [v.price] : []));
  const price = purchasable?.price ?? (colorPrices.length ? Math.min(...colorPrices) : product.price);
  const compareAtPrice = purchasable?.compareAtPrice;

  useEffect(() => {
    if (!added) return;
    const id = window.setTimeout(() => setAdded(false), productConfig.addedFeedbackMs);
    return () => window.clearTimeout(id);
  }, [added]);

  const setColor = useCallback((next: string) => {
    setColorState(next);
    // Keep the size only when it exists (and is in stock) in the new color.
    setSize((current) => (isVariantAvailable(findVariant(product, next, current)) ? current : null));
    setAttention(false);
  }, [product]);

  const chooseSize = useCallback((next: string) => {
    setSize(next);
    setAttention(false);
    setAdded(false);
  }, []);

  const add = useCallback(() => {
    if (state === "select") {
      setAttention(true);
      const first = sizeGroupRef.current?.querySelector<HTMLInputElement>("input:not(:disabled)");
      sizeGroupRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      first?.focus({ preventScroll: true });
      return;
    }
    if (state !== "ready" || !purchasable) return;
    if (addItem(product.id, purchasable.id, 1)) setAdded(true);
  }, [state, purchasable, product.id, sizeGroupRef]);

  return {
    colors,
    color,
    setColor,
    options,
    size,
    chooseSize,
    variant: purchasable,
    stock: purchasable ? stockStatus(purchasable) : null,
    price,
    compareAtPrice,
    state,
    attention,
    add,
    added,
    viewBag: openBag,
  };
}

export type ProductPurchase = ReturnType<typeof useProductPurchase>;
