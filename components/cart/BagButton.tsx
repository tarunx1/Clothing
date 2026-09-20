"use client";

import { useEffect, useState } from "react";
import { siteConfig } from "@/config/site";
import { bagOpenEvent, useBag } from "@/hooks/useBag";
import { cartCount } from "@/lib/cart";
import { CartDrawer } from "./CartDrawer";

/** Header "BAG (N)" (total units) and the bag drawer it opens. */
export function BagButton() {
  const [open, setOpen] = useState(false);
  const count = cartCount(useBag());
  const label = siteConfig.navigation.bagLabel;

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(bagOpenEvent, show);
    return () => window.removeEventListener(bagOpenEvent, show);
  }, []);

  return (
    <>
      <button
        type="button"
        data-intro-nav
        className="nav-link pointer-events-auto col-start-2 row-start-1 cursor-pointer justify-self-end uppercase md:col-start-3"
        aria-label={`${label}, ${count} ${count === 1 ? "item" : "items"}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {label} ({count})
      </button>
      {open ? <CartDrawer onClose={() => setOpen(false)} /> : null}
    </>
  );
}
