"use client";

import { useEffect, useId, useRef, useState } from "react";
import { shopConfig } from "@/config/shop";
import type { ShopSort } from "@/types/product";
import styles from "./shop.module.css";

export function SortDropdown({ value, onChange }: { value: ShopSort; onChange: (value: ShopSort) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const initialFocus = useRef(0);
  const id = useId();
  const selected = shopConfig.sortOptions.findIndex((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    options.current[initialFocus.current]?.focus();
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  function show(index = selected) {
    initialFocus.current = index;
    setOpen(true);
  }

  return <div ref={root} className={styles.sort} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className={styles.sortTrigger}
      aria-label={`Sort products: ${shopConfig.sortOptions[selected].label}`}
      aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => open ? setOpen(false) : show()}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          show(event.key === "ArrowUp" ? shopConfig.sortOptions.length - 1 : selected);
        }
      }}>
      <span className={styles.sortLabel}>SORT</span>
      <span>{shopConfig.sortOptions[selected].label}</span>
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>
    </button>
    {open ? <div id={id} role="menu" aria-label="Sort products" className={styles.sortMenu}>
      {shopConfig.sortOptions.map((option, index) => <button key={option.value}
        ref={(node) => { options.current[index] = node; }}
        type="button" role="menuitemradio" aria-checked={value === option.value} tabIndex={-1}
        className={styles.sortOption}
        onKeyDown={(event) => {
          let next: number | undefined;
          if (event.key === "ArrowDown") next = (index + 1) % options.current.length;
          if (event.key === "ArrowUp") next = (index - 1 + options.current.length) % options.current.length;
          if (event.key === "Home") next = 0;
          if (event.key === "End") next = options.current.length - 1;
          if (event.key.length === 1 && event.key !== " ") {
            next = shopConfig.sortOptions.findIndex((_, offset) => {
              const candidate = (index + 1 + offset) % shopConfig.sortOptions.length;
              return shopConfig.sortOptions[candidate].label.toLowerCase().startsWith(event.key.toLowerCase());
            });
            if (next >= 0) next = (index + 1 + next) % options.current.length;
          }
          if (next !== undefined && next >= 0) { event.preventDefault(); options.current[next]?.focus(); }
          if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
          if (event.key === "Tab") { setOpen(false); trigger.current?.focus(); }
        }}
        onClick={() => { onChange(option.value); setOpen(false); trigger.current?.focus(); }}>
        <span>{option.label}</span>
        {value === option.value ? <svg viewBox="0 0 14 14" aria-hidden="true"><path d="m3 7 2.5 2.5L11 4" /></svg> : null}
      </button>)}
    </div> : null}
  </div>;
}
