"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SettingsPage } from "@/lib/settings/registry";
import styles from "./settings.module.css";

export function SettingsNav({ pages }: { pages: Pick<SettingsPage, "slug" | "title" | "group">[] }) {
  const path = usePathname();
  const router = useRouter();
  return <>
    <label className={styles.mobileNav}>Settings category
      <select aria-label="Settings category" value={path.split("/")[3] ?? ""} onChange={(event) => {
        if (document.querySelector("[data-settings-dirty=true]") && !window.confirm("Discard unsaved settings changes?")) return;
        router.push(`/admin/settings/${event.target.value}`);
      }}><option value="">Overview</option>{pages.map((page) => <option key={page.slug} value={page.slug}>{page.title}</option>)}</select>
    </label>
    <nav className={styles.nav} aria-label="Settings sections">
      <Link href="/admin/settings" aria-current={path === "/admin/settings" ? "page" : undefined}>Overview</Link>
      {pages.map((page, index) => <div key={page.slug}>
        {page.group !== pages[index - 1]?.group ? <strong>{page.group}</strong> : null}
        <Link href={`/admin/settings/${page.slug}`} aria-current={path.endsWith(`/${page.slug}`) ? "page" : undefined}>{page.title}</Link>
      </div>)}
    </nav>
  </>;
}
