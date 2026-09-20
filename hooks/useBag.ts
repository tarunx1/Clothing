"use client";

import { useMemo, useSyncExternalStore } from "react";
import { shopConfig } from "@/config/shop";
import {
  cartCount,
  cartCurrency,
  cartSubtotal,
  itemLimitIn,
  parseStoredCart,
  resolveCart,
  withItemAdded,
  withItemRemoved,
  withQuantity,
  type CartItemId,
} from "@/lib/cart";
import type { BagLine } from "@/types/product";

/*
 * The one cart store. Lines ({ productId, variantId, quantity }) persist to
 * localStorage, sync across tabs, and are validated on every read (see
 * lib/cart.ts). Components subscribe with useSyncExternalStore, so only cart
 * surfaces re-render when the bag changes. Checkout is out of scope.
 */

const empty: BagLine[] = [];
let cached: BagLine[] = empty;
let serialized: string | null | undefined;
const changeEvent = "clothin-bag-change";
const openEvent = "clothin-bag-open";
const errorEvent = "clothin-cart-error";
let mutationRevision = 0;

function getSnapshot() {
  let raw: string | null;
  try { raw = localStorage.getItem(shopConfig.bagStorageKey); } catch { return cached; }
  if (raw === serialized) return cached;
  serialized = raw;
  const parsed = parseStoredCart(raw);
  cached = parsed.length ? parsed : empty;
  return cached;
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(changeEvent, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(changeEvent, listener);
  };
}

function write(lines: BagLine[]) {
  cached = lines.length ? lines : empty;
  try {
    serialized = JSON.stringify(cached);
    localStorage.setItem(shopConfig.bagStorageKey, serialized);
  } catch { /* Keep the bag usable in memory when storage is unavailable. */ }
  window.dispatchEvent(new Event(changeEvent));
}

async function reconcile(method: "POST" | "PATCH" | "DELETE", body: unknown, previous: BagLine[], revision: number) {
  try {
    const response = await fetch("/api/cart/items", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json() as { lines?: BagLine[]; error?: { message?: string } };
    if (!response.ok || !payload.lines) throw new Error(payload.error?.message ?? "Bag update failed");
    if (revision === mutationRevision) write(payload.lines);
  } catch (error) {
    if (revision === mutationRevision) write(previous);
    window.dispatchEvent(new CustomEvent(errorEvent, { detail: error instanceof Error ? error.message : "Bag update failed" }));
  }
}

/** Adds a purchasable variant (merging with an existing row); false when nothing could be added. */
export function addItem(productId: string, variantId: string, quantity = 1): boolean {
  const previous = getSnapshot();
  const next = withItemAdded(previous, productId, variantId, quantity);
  if (!next) return false;
  write(next);
  const revision = ++mutationRevision;
  void reconcile("POST", { productId, variantId, quantity }, previous, revision);
  return true;
}

/** Sets a row's quantity, clamped to 1…available stock. */
export const updateQuantity = (itemId: CartItemId, quantity: number) => {
  const previous = getSnapshot();
  const next = withQuantity(previous, itemId, quantity);
  write(next);
  const revision = ++mutationRevision;
  void reconcile("PATCH", { variantId: itemId, quantity: next.find((line) => line.variantId === itemId)?.quantity ?? quantity }, previous, revision);
};

export const removeItem = (itemId: CartItemId) => {
  const previous = getSnapshot();
  write(withItemRemoved(previous, itemId));
  const revision = ++mutationRevision;
  void reconcile("DELETE", { variantId: itemId }, previous, revision);
};

export const clearCart = () => {
  const previous = getSnapshot();
  write(empty);
  const revision = ++mutationRevision;
  void fetch("/api/cart", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lines: [] }) })
    .then((response) => { if (!response.ok) throw new Error("Bag update failed"); })
    .catch((error: Error) => {
      if (revision === mutationRevision) write(previous);
      window.dispatchEvent(new CustomEvent(errorEvent, { detail: error.message }));
    });
};

/** Largest quantity this row may hold (0 when the variant is not in the bag or unavailable). */
export const itemLimit = (itemId: CartItemId) => itemLimitIn(getSnapshot(), itemId);

/** Ask the header bag drawer to open (e.g. from an "Added" confirmation). */
export const openBag = () => window.dispatchEvent(new Event(openEvent));
export const bagOpenEvent = openEvent;

/** Raw lines. Server render (and hydration) sees an empty bag. */
export const useBag = () => useSyncExternalStore(subscribe, getSnapshot, () => empty);

const noop = () => () => undefined;
/** False during server render and hydration, true once the persisted bag can be read. */
export const useBagReady = () => useSyncExternalStore(noop, () => true, () => false);

/** Lines joined with catalog data, plus count and subtotal, derived once per change. */
export function useCart() {
  const lines = useBag();
  return useMemo(() => {
    const items = resolveCart(lines);
    return { items, count: cartCount(lines), subtotal: cartSubtotal(items), currency: cartCurrency(items) };
  }, [lines]);
}
