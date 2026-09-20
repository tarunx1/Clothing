"use client";

import { useState } from "react";
import { toUnit, type MeasurementUnit, type SizeChart } from "@/config/sizeGuide";
import styles from "./product.module.css";
import { useStorePreferences } from "@/components/settings/StorePreferences";

/** Measurement table with a CM / IN switch. Shared by the size guide and the size & fit section. */
export function SizeTable({ chart, highlight }: { chart: SizeChart; highlight?: string | null }) {
  const { sizeUnit } = useStorePreferences();
  const [unit, setUnit] = useState<MeasurementUnit>(sizeUnit);
  return (
    <div>
      <div className={styles.tableHead}>
        <span>Measurements ({unit === "cm" ? "centimetres" : "inches"})</span>
        <div className={styles.unitToggle} role="group" aria-label="Measurement unit">
          {(["cm", "in"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={unit === value} onClick={() => setUnit(value)}>
              {value.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>
          {chart.label} measurements in {unit === "cm" ? "centimetres" : "inches"}
        </caption>
        <thead>
          <tr>
            <th scope="col">Size</th>
            {chart.columns.map((column) => (
              <th key={column.key} scope="col" title={column.hint}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.rows.map((row) => (
            <tr key={row.size} aria-current={row.size === highlight ? "true" : undefined}>
              <th scope="row">{row.size}{row.size === highlight ? <span className={styles.visuallyHidden}> (selected)</span> : null}</th>
              {chart.columns.map((column) => (
                <td key={column.key}>{toUnit(row[column.key], unit)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
