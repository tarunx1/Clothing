"use client";

import { Drawer } from "@/components/ui/Drawer";
import type { SizeChart } from "@/config/sizeGuide";
import { SizeTable } from "./SizeTable";
import styles from "./product.module.css";

/**
 * Size guide in the shared Drawer: native modal dialog, so focus is trapped,
 * the page behind is inert, ESC closes it and focus returns to the trigger.
 * Right-side panel on desktop, full width on phones.
 */
export function SizeGuide({ chart, selectedSize, fitAdvice, onClose }: { chart: SizeChart; selectedSize: string | null; fitAdvice?: string; onClose: () => void }) {
  return (
    <Drawer title="Size guide" onClose={onClose}>
      <p className={styles.eyebrow}>{chart.label}</p>
      {fitAdvice ? <p className={styles.fitAdvice}><strong>Fit</strong> — {fitAdvice}</p> : null}
      <div style={{ marginTop: 24 }}>
        <SizeTable chart={chart} highlight={selectedSize} />
      </div>
      <ul className={styles.notes}>
        {chart.notes.map((note) => <li key={note}>{note}</li>)}
      </ul>
      <dl className={styles.measure}>
        {chart.columns.map((column) => (
          <div key={column.key}>
            <dt>{column.label}</dt>
            <dd>{column.hint}.</dd>
          </div>
        ))}
      </dl>
    </Drawer>
  );
}
