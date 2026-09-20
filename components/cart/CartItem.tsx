"use client";

import Image from "@/components/ui/StoreImage";
import Link from "next/link";
import { useRef } from "react";
import { cartConfig } from "@/config/cart";
import { removeItem } from "@/hooks/useBag";
import { gsap } from "@/lib/gsap";
import { formatMoney } from "@/lib/money";
import type { CartLineView } from "@/lib/cart";
import { CartQuantity } from "./CartQuantity";
import styles from "./cart.module.css";

const { copy } = cartConfig;

interface CartItemProps {
  line: CartLineView;
  variant: "drawer" | "page";
  /** Navigating to the product from the drawer closes it. */
  onNavigate?: () => void;
  /** Called after the row has collapsed and left the bag. */
  onRemoved?: (line: CartLineView) => void;
}

/** One bag row: image, name, colour / size, price, quantity and remove. */
export function CartItem({ line, variant, onNavigate, onRemoved }: CartItemProps) {
  const rowRef = useRef<HTMLLIElement>(null);
  const removing = useRef(false);
  const { product, variant: v, quantity, limit, image, href, id } = line;
  const label = `${product.name}, ${v.color}, size ${v.size}`;
  const money = (value: number) => formatMoney(value, product.currency);

  const remove = () => {
    const row = rowRef.current;
    if (removing.current || !row) return;
    removing.current = true;
    const done = () => {
      removeItem(id);
      onRemoved?.(line);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return done();
    // Collapse the row in place so the rows below slide up, then leave the bag.
    gsap.set(row, { height: row.offsetHeight });
    gsap.to(row, { opacity: 0, duration: 0.2, ease: "power1.out" });
    gsap.to(row, { height: 0, paddingTop: 0, paddingBottom: 0, borderBottomWidth: 0, duration: 0.42, delay: 0.12, ease: "power3.inOut", onComplete: done });
  };

  return (
    <li ref={rowRef} className={styles.item} data-cart-item={id}>
      <Link href={href} className={styles.thumb} onClick={onNavigate} tabIndex={-1} aria-hidden="true">
        {image ? <Image src={image.src} alt="" fill sizes={variant === "page" ? "132px" : "96px"} /> : null}
      </Link>
      <div className={styles.info}>
        <div className={styles.top}>
          <h3 className={styles.name}>
            <Link href={href} onClick={onNavigate} data-cart-focus>{product.name}</Link>
          </h3>
          <p className={styles.price}>
            <span className={styles.visuallyHidden}>Price </span>
            {money(variant === "page" ? line.lineTotal : v.price)}
          </p>
        </div>
        <p className={styles.variant}>{v.color} / {v.size}</p>
        {variant === "page" && quantity > 1 ? <p className={styles.unit}>{money(v.price)} each</p> : null}
        <div className={styles.actions}>
          <CartQuantity id={id} quantity={quantity} limit={limit} label={label} />
          <button type="button" className={styles.remove} onClick={remove} aria-label={`${copy.remove} ${label}`}>
            {copy.remove}
          </button>
        </div>
        {quantity >= limit ? <p className={styles.note}>{copy.maximum}</p> : null}
      </div>
    </li>
  );
}
