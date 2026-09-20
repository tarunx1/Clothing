"use client";

import { SurfaceTheme } from "@/components/layout/SurfaceTheme";
import { cartConfig } from "@/config/cart";
import { useBagReady, useCart } from "@/hooks/useBag";
import { CartContents } from "./CartContents";
import styles from "./cart.module.css";

/** /cart: the same contents as the drawer, laid out as a page. */
export function CartPage({ storeNotice = "" }: { storeNotice?: string }) {
  const ready = useBagReady();
  const { count } = useCart();
  return (
    <main className={styles.page} data-paper-surface>
      <SurfaceTheme theme="light" />
      <div className={styles.pageHead}>
        <h1 className="display-type">{cartConfig.copy.title}</h1>
        {ready && count ? <p className={styles.pageCount}>{count} {count === 1 ? "piece" : "pieces"}</p> : null}
      </div>
      {storeNotice ? <p role="note">{storeNotice}</p> : null}
      {/* The bag lives in localStorage: render it only once it can be read (no empty-state flash). */}
      {ready ? <CartContents variant="page" /> : <div className={styles.placeholder} aria-busy="true" />}
    </main>
  );
}
