import { Drawer } from "@/components/ui/Drawer";
import { productSizes, type Product, type ShopFilters } from "@/types/product";
import type { Collection } from "@/types/collection";
import { formatPrice } from "@/lib/shop";
import { productColors } from "@/lib/products";
import styles from "./shop.module.css";
function toggle<T>(values: T[], value: T) { return values.includes(value) ? values.filter(item => item !== value) : [...values, value]; }
export function FilterDrawer({ products, collections, filters, ceiling, count, onChange, onReset, onClose }: { products: Product[]; collections: Collection[]; filters: ShopFilters; ceiling: number; count: number; onChange: (filters: ShopFilters) => void; onReset: () => void; onClose: () => void }) {
  const colors = [...new Set(products.flatMap(product => productColors(product).map(color => color.name)))];
  return <Drawer title="Filters" onClose={onClose}>
    <fieldset className={styles.fieldset}><legend>Collection</legend>{collections.map(collection => <label className={styles.check} key={collection.slug}><input type="checkbox" checked={filters.collections.includes(collection.slug)} onChange={() => onChange({ ...filters, collections: toggle(filters.collections, collection.slug) })} />{collection.name}</label>)}</fieldset>
    <fieldset className={styles.fieldset}><legend>Size</legend><div className={styles.sizes}>{productSizes.map(size => <button key={size} aria-pressed={filters.sizes.includes(size)} onClick={() => onChange({ ...filters, sizes: toggle(filters.sizes, size) })}>{size}</button>)}</div></fieldset>
    <fieldset className={styles.fieldset}><legend>Color</legend>{colors.map(color => <label className={styles.check} key={color}><input type="checkbox" checked={filters.colors.includes(color)} onChange={() => onChange({ ...filters, colors: toggle(filters.colors, color) })} />{color}</label>)}</fieldset>
    <fieldset className={styles.fieldset}><legend>Maximum price · {formatPrice(filters.maxPrice)}</legend><input className={styles.range} aria-label="Maximum price" type="range" min="0" max={ceiling} step="100" value={filters.maxPrice} onChange={event => onChange({ ...filters, maxPrice: Number(event.target.value) })} /></fieldset>
    <label className={styles.check}><input type="checkbox" checked={filters.inStock} onChange={event => onChange({ ...filters, inStock: event.target.checked })} />In stock only</label>
    <button className={styles.primary} onClick={onClose}>SHOW {count} {count === 1 ? "PIECE" : "PIECES"}</button><button className={styles.reset} onClick={onReset}>Clear all filters</button>
  </Drawer>;
}
