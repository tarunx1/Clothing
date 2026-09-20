import { productAttributes } from "@/lib/products";
import type { Product } from "@/types/product";
import styles from "./product.module.css";

/** Editorial fact strip (e.g. 240 GSM / 100% COTTON / OVERSIZED FIT), derived from data. */
export function ProductAttributes({ product }: { product: Product }) {
  const attributes = productAttributes(product);
  if (!attributes.length) return null;
  return (
    <section className={styles.section} aria-labelledby="product-attributes">
      <h2 id="product-attributes" className={styles.eyebrow}>The make</h2>
      <ul className={styles.attributes} style={{ ["--attribute-count" as string]: attributes.length }}>
        {attributes.map((attribute) => (
          <li key={attribute} className={styles.attribute}>{attribute}</li>
        ))}
      </ul>
    </section>
  );
}
