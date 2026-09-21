"use client";

import Link from "next/link";
import { useState } from "react";
import { ProductCard } from "@/components/shop/ProductCard";
import { QuickSizeModal } from "@/components/shop/QuickSizeModal";
import type { Product } from "@/types/product";
import styles from "./featuredGrid.module.css";

export function FeaturedGrid({ products }: { products: Product[] }) {
  const displayProducts = products.slice(0, 6);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  return (
    <section className={styles.section} aria-label="Featured Releases">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>CURATED DROPS / 01</span>
          <h2 className={styles.heading}>FEATURED PIECES</h2>
        </div>
        <Link href="/shop" className={styles.shopLink}>
          VIEW ALL ({products.length}) <span>↗</span>
        </Link>
      </div>
      <div className={styles.grid}>
        {displayProducts.map((product, idx) => (
          <ProductCard
            key={product.id}
            product={product}
            href={`/product/${product.slug}`}
            priority={idx < 2}
            onView={() => setSelectedProduct(product)}
          />
        ))}
      </div>

      {selectedProduct ? (
        <QuickSizeModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      ) : null}
    </section>
  );
}
