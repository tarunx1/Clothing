"use client";

import { useEffect } from "react";
import { checkoutConfig } from "@/config/checkout";
import { clearCart, useBagReady } from "@/hooks/useBag";

const CLEARED_KEY = "clothin.orders.cleared";

/**
 * Rendered only for server-verified PAID orders. Clears the local bag and saved
 * checkout form the first time this order's confirmation is seen, so revisiting
 * an old confirmation never empties a newer bag.
 */
export function ClearBagOnConfirm({ orderNumber }: { orderNumber: string }) {
  const ready = useBagReady();
  useEffect(() => {
    if (!ready) return;
    let cleared: string[] = [];
    try { cleared = JSON.parse(localStorage.getItem(CLEARED_KEY) ?? "[]") as string[]; } catch { /* Treat as empty. */ }
    if (Array.isArray(cleared) && cleared.includes(orderNumber)) return;
    clearCart();
    try {
      sessionStorage.removeItem(checkoutConfig.storageKey);
      localStorage.setItem(CLEARED_KEY, JSON.stringify([...(Array.isArray(cleared) ? cleared : []), orderNumber].slice(-20)));
    } catch { /* Storage is optional. */ }
  }, [ready, orderNumber]);
  return null;
}
