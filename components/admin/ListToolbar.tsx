"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "./icons";
import styles from "./admin.module.css";

interface FilterDefinition {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface ListToolbarProps {
  searchLabel: string;
  filters?: FilterDefinition[];
  sorts?: { value: string; label: string }[];
  total: number;
  noun: string;
}

/** Search (debounced), filters and sort, all kept in the URL so views can be refreshed, bookmarked and navigated back. */
export function ListToolbar({ searchLabel, filters = [], sorts = [], total, noun }: ListToolbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const first = useRef(true);

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    const search = next.toString();
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      if ((params.get("q") ?? "") !== query.trim()) update({ q: query.trim() });
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce reacts to typing only
  }, [query]);

  return (
    <div className={styles.toolbar} aria-busy={pending || undefined}>
      <label className={styles.search}>
        <span className="sr-only">{searchLabel}</span>
        <Icon name="search" />
        <input type="search" value={query} placeholder={searchLabel} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {filters.map((filter) => (
        <label key={filter.key}>
          <span className="sr-only">{filter.label}</span>
          <select className={styles.select} value={params.get(filter.key) ?? ""} onChange={(event) => update({ [filter.key]: event.target.value })}>
            <option value="">{filter.label}: All</option>
            {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      ))}
      {sorts.length ? (
        <label>
          <span className="sr-only">Sort</span>
          <select className={styles.select} value={params.get("sort") ?? sorts[0].value} onChange={(event) => update({ sort: event.target.value === sorts[0].value ? "" : event.target.value })}>
            {sorts.map((sort) => <option key={sort.value} value={sort.value}>Sort: {sort.label}</option>)}
          </select>
        </label>
      ) : null}
      <span className={styles.toolbarSpacer} />
      <span className={styles.resultCount} aria-live="polite">{pending ? "Updating…" : `${total} ${noun}${total === 1 ? "" : "s"}`}</span>
    </div>
  );
}
