"use client";

import Link from "next/link";
import type { Ref } from "react";
import { productConfig } from "@/config/product";
import { formatMoney } from "@/lib/money";
import type { Product } from "@/types/product";
import type { Collection } from "@/types/collection";
import { AddToBagButton } from "./AddToBagButton";
import { ProductColorSelector } from "./ProductColorSelector";
import { ProductDetails } from "./ProductDetails";
import { ProductSizeSelector } from "./ProductSizeSelector";
import type { ProductPurchase } from "./useProductPurchase";
import styles from "./product.module.css";

const { copy } = productConfig;
const stockCopy = { "in-stock": copy.inStock, "low-stock": copy.lowStock, "sold-out": copy.soldOut } as const;

interface ProductInfoPanelProps {
  product: Product;
  collection: Collection | null;
  purchase: ProductPurchase;
  onOpenSizeGuide: () => void;
  ctaRef?: Ref<HTMLButtonElement>;
  sizeGroupRef?: Ref<HTMLFieldSetElement>;
}

/** Title, price, color, size and purchase. Open layout: no card, thin rules only. */
export function ProductInfoPanel({ product, collection, purchase, onOpenSizeGuide, ctaRef, sizeGroupRef }: ProductInfoPanelProps) {
  const money = (value: number) => formatMoney(value, product.currency);
  const { state } = purchase;

  return (
    <div>
      {collection ? (
        <p className={styles.collectionLabel}>
          <Link href="/shop">{collection.name} {copy.collectionSuffix}</Link>
        </p>
      ) : null}
      <h1 className={styles.title}>{product.name}</h1>
      {product.subtitle ? <p className={styles.subtitle}>{product.subtitle}</p> : null}
      <p className={styles.priceRow}>
        <span>{money(purchase.price)}</span>
        {purchase.compareAtPrice && purchase.compareAtPrice > purchase.price ? (
          <span className={styles.compareAt}>
            <span className={styles.visuallyHidden}>Was </span>
            {money(purchase.compareAtPrice)}
          </span>
        ) : null}
      </p>
      <p className={styles.statement}>{product.description}</p>

      <div className={styles.selectors}>
        <ProductColorSelector colors={purchase.colors} value={purchase.color} onChange={purchase.setColor} />
        <ProductSizeSelector
          ref={sizeGroupRef}
          options={purchase.options}
          value={purchase.size}
          onChange={purchase.chooseSize}
          onOpenGuide={onOpenSizeGuide}
          fit={product.fit}
          fitAdvice={product.fitAdvice}
          attention={purchase.attention}
        />
      </div>

      <div className={styles.purchase}>
        <p className={styles.stock} aria-live="polite">
          {state !== "sold-out" && purchase.stock ? stockCopy[purchase.stock] : ""}
        </p>
        <AddToBagButton ref={ctaRef} state={state} price={money(purchase.price)} onClick={purchase.add} />
        <div className={styles.confirmation} role="status">
          {purchase.added && purchase.variant ? (
            <>
              <span>{product.name} / {purchase.variant.size} added to your bag.</span>
              <button type="button" onClick={purchase.viewBag}>{copy.viewBag}</button>
            </>
          ) : null}
        </div>
      </div>

      <ProductDetails product={product} />
    </div>
  );
}
