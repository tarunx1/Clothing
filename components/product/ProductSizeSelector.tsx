"use client";

import { useId, type Ref } from "react";
import { productConfig } from "@/config/product";
import { isVariantAvailable } from "@/lib/products";
import type { ProductVariant } from "@/types/product";
import styles from "./product.module.css";

interface ProductSizeSelectorProps {
  options: { size: string; variant: ProductVariant | null }[];
  value: string | null;
  onChange: (size: string) => void;
  onOpenGuide?: () => void;
  fitAdvice?: string;
  fit?: string;
  /** Visually flags the group after an add attempt without a size. */
  attention: boolean;
  ref?: Ref<HTMLFieldSetElement>;
}

/**
 * Square size controls backed by native radios. Sizes that are sold out or
 * not offered in the chosen color are disabled and cannot be selected.
 */
export function ProductSizeSelector({ options, value, onChange, onOpenGuide, fitAdvice, fit, attention, ref }: ProductSizeSelectorProps) {
  const name = useId();
  const { copy } = productConfig;
  return (
    <fieldset ref={ref} className={styles.fieldset} data-attention={attention || undefined} aria-describedby={`${name}-prompt`}>
      <div className={styles.fieldHead}>
        <legend>
          {copy.size}
          <span className={styles.fieldValue}>{value ?? ""}</span>
        </legend>
        {onOpenGuide ? (
          <button type="button" className={styles.linkButton} onClick={onOpenGuide}>
            {copy.sizeGuide}
          </button>
        ) : null}
      </div>
      <div className={styles.sizes}>
        {options.map(({ size, variant }) => {
          const id = `${name}-${size}`;
          const available = isVariantAvailable(variant);
          return (
            <span key={size}>
              <input
                id={id}
                className={styles.visuallyHidden}
                type="radio"
                name={name}
                value={size}
                checked={value === size}
                disabled={!available}
                onChange={() => onChange(size)}
              />
              <label htmlFor={id} className={styles.size}>
                {size}
                {!available ? <span className={styles.visuallyHidden}>, {copy.soldOut}</span> : null}
              </label>
            </span>
          );
        })}
      </div>
      {fit || fitAdvice ? (
        <p className={styles.fitAdvice}>
          {fit ? <strong>{fit} fit</strong> : null}
          {fit && fitAdvice ? " — " : null}
          {fitAdvice}
        </p>
      ) : null}
      <p id={`${name}-prompt`} className={styles.prompt} role="alert">
        {attention ? copy.selectSizePrompt : ""}
      </p>
    </fieldset>
  );
}
