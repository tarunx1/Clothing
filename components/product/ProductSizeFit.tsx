import { productConfig } from "@/config/product";
import { defaultSizeChart, sizeCharts } from "@/config/sizeGuide";
import type { Product } from "@/types/product";
import { SizeTable } from "./SizeTable";
import styles from "./product.module.css";

/** Size & fit: the fit facts beside the same measurement table the size guide uses. */
export function ProductSizeFit({ product }: { product: Product }) {
  const chart = sizeCharts[product.sizeChart ?? defaultSizeChart];
  if (!chart) return null;
  const facts = [...(product.fitNotes ?? []), product.fitAdvice].filter(Boolean) as string[];
  return (
    <section className={`${styles.section} ${styles.sizeFit}`} aria-labelledby="size-fit">
      <div>
        <p className={styles.eyebrow}>{chart.label}</p>
        <h2 id="size-fit" className={`display-type ${styles.sectionTitle}`}>{productConfig.copy.sizeAndFit}</h2>
        {facts.length ? (
          <ul className={styles.fitList}>
            {facts.map((fact) => <li key={fact}>{fact}</li>)}
          </ul>
        ) : null}
      </div>
      <div>
        <SizeTable chart={chart} />
        <ul className={styles.notes}>
          {chart.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      </div>
    </section>
  );
}
