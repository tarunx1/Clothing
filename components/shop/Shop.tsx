"use client";
import { useEffect, useState } from "react";
import { shopConfig } from "@/config/shop";
import { emptyFilters, filterProducts, countFilters } from "@/lib/shop";
import { setSurfaceTheme } from "@/lib/surfaceTheme";
import type { Product, ShopFilters, ShopSort } from "@/types/product";
import type { Collection } from "@/types/collection";
import { ProductCard } from "./ProductCard";
import { ProductPreview } from "./ProductPreview";
import { FilterDrawer } from "./FilterDrawer";
import { SortDropdown } from "./SortDropdown";
import styles from "./shop.module.css";
export function Shop({ products, collections }: { products: Product[]; collections: Collection[] }) {
  const ceiling = Math.max(0, ...products.map(product => product.price));
  const [filters, setFilters] = useState(() => emptyFilters(ceiling));
  const [sort, setSort] = useState<ShopSort>("featured");
  const [limit, setLimit] = useState<number>(shopConfig.initialCount);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  useEffect(() => { setSurfaceTheme("light"); }, []);
  const filtered = filterProducts(products, filters, sort);
  const activeCount = countFilters(filters, ceiling);
  const updateFilters = (next: ShopFilters) => { setFilters(next); setLimit(shopConfig.initialCount); };
  const reset = () => updateFilters(emptyFilters(ceiling));
  return <main className={styles.shop} data-paper-surface>
    <div className={styles.intro}><div><p className={styles.eyebrow}>THE EVERYDAY, REDEFINED / COLLECTION 01</p><h1 className="display-type">SHOP<span className={styles.headingCount}>({String(products.length).padStart(2, "0")})</span></h1></div><p className={styles.introCopy}>Graphic essentials.<br />A point of view of your own.</p></div>
    <div className={styles.toolbar}><nav className={styles.collections} aria-label="Shop collections"><button aria-pressed={!filters.collections.length} onClick={() => updateFilters({ ...filters, collections: [] })}>ALL</button>{collections.map(collection => <button key={collection.slug} aria-pressed={filters.collections.length === 1 && filters.collections[0] === collection.slug} onClick={() => updateFilters({ ...filters, collections: [collection.slug] })}>{collection.name}</button>)}</nav>
      <div className={styles.controls}><span className={styles.count} role="status">{filtered.length} PIECES</span><button onClick={() => setFilterOpen(true)}>FILTER {activeCount ? `(${activeCount})` : "+"}</button><SortDropdown value={sort} onChange={(value) => { setSort(value); setLimit(shopConfig.initialCount); }} /></div>
    </div>
    {activeCount ? <div className={styles.activeFilters}><span>{activeCount} active {activeCount === 1 ? "filter" : "filters"}</span><button onClick={reset}>CLEAR ALL ×</button></div> : null}
    <div className={styles.grid}>{filtered.slice(0, limit).map((product, index) => <ProductCard key={product.id} product={product} featured={sort === "featured" && index === 2} priority={index < 2} onView={() => setSelected(product)} />)}</div>
    {!filtered.length ? <div className={styles.empty}><h2>No pieces match this selection.</h2><p>Try another collection, size, or price.</p><button className={styles.primary} onClick={reset}>CLEAR FILTERS</button></div> : <div className={styles.load}><p>SHOWING {Math.min(limit, filtered.length)} OF {filtered.length} PIECES</p>{limit < filtered.length ? <button onClick={() => setLimit(value => value + shopConfig.pageSize)}>LOAD MORE <span aria-hidden="true">↓</span></button> : <span>YOU’VE SEEN THE WHOLE EDIT.</span>}</div>}
    {filterOpen ? <FilterDrawer products={products} collections={collections} filters={filters} ceiling={ceiling} count={filtered.length} onChange={updateFilters} onReset={reset} onClose={() => setFilterOpen(false)} /> : null}
    {selected ? <ProductPreview key={selected.id} product={selected} onClose={() => setSelected(null)} /> : null}
  </main>;
}
