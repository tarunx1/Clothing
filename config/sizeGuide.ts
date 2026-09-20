/**
 * Garment measurements in centimetres, measured flat. Inches are derived.
 * Charts are keyed so each product can point at the one matching its cut.
 */
export interface SizeChart {
  id: string;
  label: string;
  columns: { key: "chest" | "length" | "shoulder"; label: string; hint: string }[];
  rows: { size: string; chest: number; length: number; shoulder: number }[];
  notes: string[];
}

const columns: SizeChart["columns"] = [
  { key: "chest", label: "Chest", hint: "Armpit to armpit, measured flat" },
  { key: "length", label: "Length", hint: "Highest shoulder point to hem" },
  { key: "shoulder", label: "Shoulder", hint: "Seam to seam across the back" },
];

export const sizeCharts: Record<string, SizeChart> = {
  oversized: {
    id: "oversized",
    label: "Oversized tee",
    columns,
    rows: [
      { size: "XS", chest: 56, length: 68, shoulder: 54 },
      { size: "S", chest: 59, length: 70, shoulder: 56 },
      { size: "M", chest: 62, length: 72, shoulder: 58 },
      { size: "L", chest: 65, length: 74, shoulder: 60 },
      { size: "XL", chest: 68, length: 76, shoulder: 62 },
      { size: "XXL", chest: 71, length: 78, shoulder: 64 },
    ],
    notes: [
      "Cut roomy through the body with a dropped shoulder.",
      "Between sizes, or for a closer fit, choose the smaller size.",
    ],
  },
  boxy: {
    id: "boxy",
    label: "Boxy tee",
    columns,
    rows: [
      { size: "XS", chest: 57, length: 64, shoulder: 53 },
      { size: "S", chest: 60, length: 66, shoulder: 55 },
      { size: "M", chest: 63, length: 68, shoulder: 57 },
      { size: "L", chest: 66, length: 70, shoulder: 59 },
      { size: "XL", chest: 69, length: 72, shoulder: 61 },
      { size: "XXL", chest: 72, length: 74, shoulder: 63 },
    ],
    notes: [
      "Wide through the body with a cropped, boxy length.",
      "Take your usual size; size up for extra room.",
    ],
  },
};

export const defaultSizeChart = "oversized";
export type MeasurementUnit = "cm" | "in";
export const toUnit = (cm: number, unit: MeasurementUnit) => (unit === "cm" ? cm : Math.round((cm / 2.54) * 2) / 2);
