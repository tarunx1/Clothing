"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveVariantsAction } from "@/lib/admin/actions/products";
import { suggestSku } from "@/lib/admin/validation";
import { InventoryAdjustmentDialog, type AdjustTarget } from "../inventory/InventoryAdjustmentDialog";
import { StatusBadge } from "../StatusBadge";
import { useToast } from "../Toaster";
import { ColorCreator, type ColorOption } from "./ColorCreator";
import styles from "../admin.module.css";
import matrix from "./variants.module.css";

export interface ExistingVariant {
  id: string;
  colorId: string;
  sizeId: string;
  sku: string;
  price: string;
  compareAtPrice: string;
  enabled: boolean;
  quantity: number;
  reserved: number;
}

interface Cell {
  active: boolean;
  sku: string;
  price: string;
  compareAtPrice: string;
  initialStock: string;
  existing?: ExistingVariant;
}

interface VariantMatrixProps {
  productId: string;
  productSlug: string;
  basePrice: string;
  colors: ColorOption[];
  sizes: { id: string; name: string; enabled: boolean }[];
  variants: ExistingVariant[];
  editable: boolean;
  canAdjustStock: boolean;
}

const keyOf = (colorId: string, sizeId: string) => `${colorId}:${sizeId}`;

/**
 * Colour × size grid. Ticking a cell creates or re-enables that variant;
 * unticking an existing one disables it (history is kept). Per-variant SKU,
 * price override, compare-at price and stock are edited in the table below.
 */
export function VariantMatrix({ productId, productSlug, basePrice, colors: initialColors, sizes, variants, editable, canAdjustStock }: VariantMatrixProps) {
  const router = useRouter();
  const notify = useToast();
  const [colors, setColors] = useState(initialColors);
  const [colorIds, setColorIds] = useState(() => [...new Set(variants.map((variant) => variant.colorId))]);
  const [sizeIds, setSizeIds] = useState(() => {
    const used = new Set(variants.map((variant) => variant.sizeId));
    return sizes.filter((size) => (used.size ? used.has(size.id) : size.enabled)).map((size) => size.id);
  });
  const [cells, setCells] = useState<Record<string, Cell>>(() =>
    Object.fromEntries(variants.map((variant) => [keyOf(variant.colorId, variant.sizeId), { active: variant.enabled, sku: variant.sku, price: variant.price, compareAtPrice: variant.compareAtPrice, initialStock: "", existing: variant }])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [creatingColor, setCreatingColor] = useState(false);
  const [adjusting, setAdjusting] = useState<AdjustTarget | null>(null);

  const colorName = (id: string) => colors.find((color) => color.id === id)?.name ?? "Colour";
  const sizeName = (id: string) => sizes.find((size) => size.id === id)?.name ?? "Size";
  const orderedSizes = sizes.filter((size) => sizeIds.includes(size.id));
  const orderedColors = colorIds.map((id) => colors.find((color) => color.id === id)).filter((color): color is ColorOption => Boolean(color));

  const update = (key: string, patch: Partial<Cell>) => {
    setCells((current) => ({ ...current, [key]: { ...(current[key] ?? { active: false, sku: "", price: "", compareAtPrice: "", initialStock: "" }), ...patch } }));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([errorKey]) => !errorKey.startsWith(key))));
  };

  const toggle = (colorId: string, sizeId: string, active: boolean) => {
    const key = keyOf(colorId, sizeId);
    const current = cells[key];
    update(key, { active, sku: current?.sku || suggestSku(productSlug, colorName(colorId), sizeName(sizeId)) });
  };

  const setRow = (colorId: string, active: boolean) => orderedSizes.forEach((size) => toggle(colorId, size.id, active));
  const setColumn = (sizeId: string, active: boolean) => orderedColors.forEach((color) => toggle(color.id, sizeId, active));

  // Rows sent to the server: every existing variant plus newly ticked cells, in a stable order.
  const rows = orderedColors.flatMap((color) => sizes.map((size) => ({ color, size, key: keyOf(color.id, size.id) })))
    .filter(({ key }) => cells[key]?.existing || cells[key]?.active);

  const save = async () => {
    setSaving(true);
    setErrors({});
    const payload = rows.map(({ color, size, key }) => ({ colorId: color.id, sizeId: size.id, active: Boolean(cells[key]?.active), sku: cells[key]?.sku ?? "", price: cells[key]?.price ?? "", compareAtPrice: cells[key]?.compareAtPrice ?? "", initialStock: cells[key]?.initialStock ?? "" }));
    const result = await saveVariantsAction(productId, { rows: payload });
    setSaving(false);
    if (!result.ok) {
      const mapped: Record<string, string> = {};
      for (const [path, message] of Object.entries(result.fieldErrors ?? {})) {
        const match = path.match(/^rows\.(\d+)\.(\w+)$/);
        if (match && rows[Number(match[1])]) mapped[`${rows[Number(match[1])].key}.${match[2]}`] = message;
      }
      setErrors(mapped);
      notify(result.error, "error");
      return;
    }
    const { created, updated, disabled } = result.data;
    notify(`Variants saved: ${created} created, ${updated} updated, ${disabled} disabled.`);
    router.refresh();
  };

  const unusedColors = colors.filter((color) => !colorIds.includes(color.id) && color.enabled);

  return (
    <section className={styles.panel} aria-labelledby="variant-matrix-title">
      <div className={styles.panelHead}>
        <div>
          <h2 id="variant-matrix-title">Variants</h2>
          <p>Tick a colour and size to sell it. Unticking an existing variant disables it and keeps its history.</p>
        </div>
        {editable ? <button type="button" className={`${styles.button} ${styles.primary}`} onClick={save} disabled={saving} aria-busy={saving || undefined}>{saving ? "Saving…" : "Save variants"}</button> : null}
      </div>
      <div className={styles.panelBody} style={{ display: "grid", gap: 16 }}>
        <fieldset className={matrix.options} disabled={!editable}>
          <legend>Sizes</legend>
          {sizes.map((size) => (
            <label key={size.id} className={matrix.chip}>
              <input type="checkbox" checked={sizeIds.includes(size.id)} onChange={(event) => setSizeIds((current) => (event.target.checked ? [...current, size.id] : current.filter((id) => id !== size.id)))} disabled={variants.some((variant) => variant.sizeId === size.id)} />
              {size.name}
            </label>
          ))}
        </fieldset>
        <div className={matrix.options}>
          <span className={matrix.legend}>Colours</span>
          {orderedColors.map((color) => (
            <span key={color.id} className={matrix.chip} data-static>
              <span className={matrix.swatch} style={{ background: color.hex ?? "#ccc" }} aria-hidden="true" />{color.name}
              {editable && !variants.some((variant) => variant.colorId === color.id) ? (
                <button type="button" className={matrix.chipRemove} aria-label={`Remove ${color.name}`} onClick={() => setColorIds((current) => current.filter((id) => id !== color.id))}>×</button>
              ) : null}
            </span>
          ))}
          {editable ? (
            <>
              <label className="sr-only" htmlFor="add-color">Add colour</label>
              <select id="add-color" className={styles.select} value="" onChange={(event) => { if (event.target.value) setColorIds((current) => [...current, event.target.value]); }}>
                <option value="">Add existing colour…</option>
                {unusedColors.map((color) => <option key={color.id} value={color.id}>{color.name}</option>)}
              </select>
              <button type="button" className={styles.button} onClick={() => setCreatingColor(true)}>New colour</button>
            </>
          ) : null}
        </div>

        {orderedColors.length && orderedSizes.length ? (
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${matrix.grid}`}>
              <caption>Available colour and size combinations</caption>
              <thead>
                <tr>
                  <th scope="col">Colour</th>
                  {orderedSizes.map((size) => (
                    <th key={size.id} scope="col" className={matrix.center}>
                      {editable ? <button type="button" className={matrix.axisButton} onClick={() => setColumn(size.id, !orderedColors.every((color) => cells[keyOf(color.id, size.id)]?.active))} aria-label={`Toggle size ${size.name} for all colours`}>{size.name}</button> : size.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderedColors.map((color) => (
                  <tr key={color.id}>
                    <th scope="row">
                      {editable ? (
                        <button type="button" className={matrix.axisButton} onClick={() => setRow(color.id, !orderedSizes.every((size) => cells[keyOf(color.id, size.id)]?.active))} aria-label={`Toggle all sizes for ${color.name}`}>
                          <span className={matrix.swatch} style={{ background: color.hex ?? "#ccc" }} aria-hidden="true" />{color.name}
                        </button>
                      ) : color.name}
                    </th>
                    {orderedSizes.map((size) => {
                      const cell = cells[keyOf(color.id, size.id)];
                      return (
                        <td key={size.id} className={matrix.center}>
                          <input type="checkbox" className={matrix.check} checked={Boolean(cell?.active)} disabled={!editable} onChange={(event) => toggle(color.id, size.id, event.target.checked)} aria-label={`${color.name} / ${size.name}`} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.muted}>Choose at least one colour and one size to build the matrix.</p>
        )}

        {rows.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption>Variant details</caption>
              <thead>
                <tr>
                  <th scope="col">Variant</th>
                  <th scope="col">SKU</th>
                  <th scope="col">Price override</th>
                  <th scope="col">Compare-at</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ color, size, key }) => {
                  const cell = cells[key]!;
                  const status = cell.existing ? (cell.active ? (cell.existing.enabled ? "Live" : "Will be re-enabled") : cell.existing.enabled ? "Will be disabled" : "Disabled") : "New";
                  return (
                    <tr key={key} style={{ opacity: cell.active ? 1 : 0.6 }}>
                      <th scope="row" className={matrix.variantName}><span className={matrix.swatch} style={{ background: color.hex ?? "#ccc" }} aria-hidden="true" />{color.name} / {size.name}</th>
                      <td>
                        <span className={matrix.inline}>
                          <input className={matrix.input} value={cell.sku} disabled={!editable} onChange={(event) => update(key, { sku: event.target.value.toUpperCase() })} aria-label={`SKU for ${color.name} / ${size.name}`} aria-invalid={Boolean(errors[`${key}.sku`])} aria-describedby={errors[`${key}.sku`] ? `${key}-sku-error` : undefined} />
                          {editable ? <button type="button" className={styles.linkButton} onClick={() => update(key, { sku: suggestSku(productSlug, color.name, size.name) })}>Generate</button> : null}
                        </span>
                        {errors[`${key}.sku`] ? <span id={`${key}-sku-error`} className={matrix.error} role="alert">{errors[`${key}.sku`]}</span> : null}
                      </td>
                      <td><input className={matrix.inputSmall} inputMode="decimal" placeholder={basePrice} value={cell.price} disabled={!editable} onChange={(event) => update(key, { price: event.target.value })} aria-label={`Price override for ${color.name} / ${size.name}`} /></td>
                      <td>
                        <input className={matrix.inputSmall} inputMode="decimal" placeholder="—" value={cell.compareAtPrice} disabled={!editable} onChange={(event) => update(key, { compareAtPrice: event.target.value })} aria-label={`Compare-at price for ${color.name} / ${size.name}`} aria-invalid={Boolean(errors[`${key}.compareAtPrice`])} />
                        {errors[`${key}.compareAtPrice`] ? <span className={matrix.error} role="alert">{errors[`${key}.compareAtPrice`]}</span> : null}
                      </td>
                      <td>
                        {cell.existing ? (
                          <span className={matrix.inline}>
                            <span className={styles.num}>{cell.existing.quantity - cell.existing.reserved}<span className={styles.cellSub}>{cell.existing.quantity} total · {cell.existing.reserved} reserved</span></span>
                            {canAdjustStock ? <button type="button" className={styles.linkButton} onClick={() => setAdjusting({ variantId: cell.existing!.id, label: `${color.name} / ${size.name}`, sku: cell.existing!.sku, quantity: cell.existing!.quantity, reserved: cell.existing!.reserved })}>Adjust</button> : null}
                          </span>
                        ) : (
                          <input className={matrix.inputSmall} inputMode="numeric" placeholder="0" value={cell.initialStock} disabled={!editable} onChange={(event) => update(key, { initialStock: event.target.value.replace(/\D/g, "") })} aria-label={`Initial stock for ${color.name} / ${size.name}`} />
                        )}
                      </td>
                      <td><StatusBadge tone={status === "Live" ? "ok" : status === "New" ? "info" : status.startsWith("Will") ? "warn" : "neutral"}>{status}</StatusBadge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      <ColorCreator open={creatingColor} onClose={() => setCreatingColor(false)} onCreated={(color) => { setColors((current) => [...current, color]); setColorIds((current) => [...current, color.id]); }} />
      <InventoryAdjustmentDialog
        target={adjusting}
        onClose={() => setAdjusting(null)}
        onAdjusted={(next) => {
          if (!adjusting) return;
          const key = Object.keys(cells).find((candidate) => cells[candidate].existing?.id === adjusting.variantId);
          if (key) update(key, { existing: { ...cells[key].existing!, quantity: next.quantity, reserved: next.reserved } });
        }}
      />
    </section>
  );
}
