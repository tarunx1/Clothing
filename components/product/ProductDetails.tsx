"use client";
import { useStorePreferences } from "@/components/settings/StorePreferences";
import { productConfig } from "@/config/product";
import type { Product } from "@/types/product";
import { ProductAccordion, type AccordionItem } from "./ProductAccordion";
import styles from "./product.module.css";

/** Details / Fabric / Fit / Care / Shipping, built from product data; empty rows are skipped. */
export function ProductDetails({ product }: { product: Product }) {
  const { shippingAndReturns } = useStorePreferences();
  const fabric = [product.material, product.gsm ? `${product.gsm} GSM` : null, product.print].filter(Boolean) as string[];
  const fit = [...(product.fitNotes ?? (product.fit ? [product.fit] : [])), product.fitAdvice].filter(Boolean) as string[];
  const list = (lines: readonly string[]) => <ul>{lines.map((line) => <li key={line}>{line}</li>)}</ul>;

  const candidates: (AccordionItem | null)[] = [
    { id: "details", title: "Details", content: <p>{product.details ?? product.description}</p> },
    fabric.length ? { id: "fabric", title: "Fabric", content: list(fabric) } : null,
    fit.length ? { id: "fit", title: "Fit", content: list(fit) } : null,
    product.care?.length ? { id: "care", title: "Care", content: list(product.care) } : null,
    { id: "shipping", title: "Shipping & returns", content: list(shippingAndReturns ?? productConfig.shipping) },
  ];
  const items = candidates.filter((item): item is AccordionItem => item !== null);

  return (
    <section aria-labelledby="product-details-heading">
      {/* Keeps the outline h1 → h2 → h3 for the disclosure rows. */}
      <h2 id="product-details-heading" className={styles.visuallyHidden}>Product details</h2>
      <ProductAccordion items={items} />
    </section>
  );
}
