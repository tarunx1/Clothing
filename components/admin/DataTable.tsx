import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./admin.module.css";

export interface Column<Row> {
  key: string;
  header: string;
  /** Sort value written to ?sort= when the header is clicked. */
  sort?: string;
  align?: "end";
  /** 1 = always visible, 2 = hidden under 760px, 3 = hidden under 1100px. */
  priority?: 1 | 2 | 3;
  render: (row: Row) => ReactNode;
}

interface DataTableProps<Row> {
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  empty: { title: string; body?: string; action?: ReactNode };
  /** Current URL state, used to build sort links. */
  sortHref?: (sort: string) => string;
  currentSort?: string;
}

/** One table for every admin list: semantic markup, sortable headers, priority columns and an empty state. */
export function DataTable<Row>({ caption, columns, rows, rowKey, empty, sortHref, currentSort }: DataTableProps<Row>) {
  if (!rows.length) {
    return (
      <div className={styles.empty}>
        <strong>{empty.title}</strong>
        {empty.body ? <p>{empty.body}</p> : null}
        {empty.action}
      </div>
    );
  }
  const cls = (column: Column<Row>) => [column.align === "end" ? styles.alignEnd : "", column.priority === 2 ? styles.p2 : column.priority === 3 ? styles.p3 : ""].join(" ").trim() || undefined;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cls(column)} aria-sort={column.sort && currentSort?.startsWith(column.sort) ? "ascending" : undefined}>
                {column.sort && sortHref ? <Link href={sortHref(column.sort)}>{column.header}</Link> : column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => <td key={column.key} className={cls(column)}>{column.render(row)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
