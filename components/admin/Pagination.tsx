import Link from "next/link";
import styles from "./admin.module.css";

export function Pagination({ page, limit, total, href }: { page: number; limit: number; total: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <span>{from}–{to} of {total}</span>
      <span className={styles.pageLinks}>
        {page > 1 ? <Link href={href(page - 1)} rel="prev">Previous</Link> : <span aria-disabled="true">Previous</span>}
        {page < pages ? <Link href={href(page + 1)} rel="next">Next</Link> : <span aria-disabled="true">Next</span>}
      </span>
    </nav>
  );
}

/** Builds list URLs that keep the current search/filters while changing one param. */
export function listHref(base: string, current: Record<string, string | undefined>, changes: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...current, ...changes })) {
    if (value !== undefined && value !== "" && !(key === "page" && Number(value) === 1)) params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
