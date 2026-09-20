"use client";

import { useId } from "react";
import { productConfig } from "@/config/product";
import type { ProductColor } from "@/lib/products";
import styles from "./product.module.css";

/** Minimal square swatches backed by native radios (arrow keys, labels, disabled states). */
export function ProductColorSelector({ colors, value, onChange }: { colors: ProductColor[]; value: string | null; onChange: (color: string) => void }) {
  const name = useId();
  return (
    <fieldset className={styles.fieldset}>
      <div className={styles.fieldHead}>
        <legend>
          {productConfig.copy.color}
          <span className={styles.fieldValue}>{value ?? "—"}</span>
        </legend>
      </div>
      <div className={styles.swatches}>
        {colors.map((color) => {
          const id = `${name}-${color.name}`;
          return (
            <span key={color.name}>
              <input
                id={id}
                className={styles.visuallyHidden}
                type="radio"
                name={name}
                value={color.name}
                checked={value === color.name}
                disabled={!color.available}
                onChange={() => onChange(color.name)}
              />
              <label htmlFor={id} className={styles.swatch} title={color.name}>
                <span style={{ background: color.hex ?? "transparent" }} aria-hidden="true" />
                <span className={styles.visuallyHidden}>{color.name}{color.available ? "" : `, ${productConfig.copy.soldOut}`}</span>
              </label>
            </span>
          );
        })}
      </div>
    </fieldset>
  );
}
