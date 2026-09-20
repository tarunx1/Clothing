import { ProductCard } from "@/components/shop/ProductCard";
import { productConfig } from "@/config/product";
import { productHref } from "@/lib/products";
import type { Product } from "@/types/product";
import styles from "./product.module.css";

/** Two or three pieces, rendered with the shop's own ProductCard. Hidden when there are none. */
export function RelatedProducts({ products }: { products: Product[] }) {
  if (!products.length) return null;
  return (
    <section className={styles.section} aria-labelledby="related-products">
      <h2 id="related-products" className={`display-type ${styles.sectionTitle}`}>{productConfig.copy.related}</h2>
      <div className={styles.related} style={{ ["--related-count" as string]: Math.min(products.length, 3) }}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            href={productHref(product)}
            variant="related"
            sizes={`(max-width: 767px) 100vw, (max-width: 1023px) 50vw, ${Math.round(100 / Math.min(products.length, 3))}vw`}
          />
        ))}
      </div>
    </section>
  );
}
