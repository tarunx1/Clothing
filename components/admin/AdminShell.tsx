"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { logoutAction } from "@/lib/admin/actions/auth";
import { Icon, type IconName } from "./icons";
import { ToastProvider } from "./Toaster";
import styles from "./admin.module.css";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/products", label: "Products", icon: "products" },
  { href: "/admin/collections", label: "Collections", icon: "collections" },
  { href: "/admin/inventory", label: "Inventory", icon: "inventory" },
  { href: "/admin/orders", label: "Orders", icon: "orders" },
  { href: "/admin/content", label: "Content", icon: "content" },
  { href: "/admin/settings", label: "Settings", icon: "settings" },
];

interface AdminShellProps {
  storeName: string;
  admin: { name: string; email: string; role: string };
  /** Sections this role may open. The server enforces the same rules on every page and action. */
  sections: string[];
  environment?: string;
  children: ReactNode;
}

export function AdminShell({ storeName, admin, sections, environment, children }: AdminShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  // Move focus into the drawer when it opens and back to the menu button when it closes.
  useEffect(() => {
    if (open) closeButton.current?.focus();
    else if (wasOpen.current) menuButton.current?.focus();
    wasOpen.current = open;
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  return (
    <ToastProvider>
      <div className={styles.root}>
        <button type="button" className={styles.scrim} data-open={open} aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} />
        <aside id="admin-sidebar" className={styles.sidebar} data-open={open} aria-label="Admin">
          <div className={styles.brandRow}>
            <p className={styles.brand}>{storeName}<span>Store admin · {environment}</span></p>
            <button ref={closeButton} type="button" className={`${styles.iconButton} ${styles.closeButton}`} onClick={() => setOpen(false)} aria-label="Close menu"><Icon name="close" /></button>
          </div>
          <nav aria-label="Admin sections">
            <ul className={styles.nav}>
              {NAV.filter((item) => sections.includes(item.href)).map((item) => (
                <li key={item.href}>
                  <Link href={item.href} aria-current={active(item.href) ? "page" : undefined}><Icon name={item.icon} />{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.sidebarFoot}>
            <p className={styles.who}>{admin.name}<span>{admin.email} · {admin.role.toLowerCase()}</span></p>
            <a className={styles.storeLink} href="/" target="_blank" rel="noreferrer">View store</a>
            <form action={logoutAction}><button type="submit" className={`${styles.button} ${styles.ghost}`}>Sign out</button></form>
          </div>
        </aside>
        <main className={styles.main} id="admin-main">
          <div className={styles.topbar}>
            <button ref={menuButton} type="button" className={`${styles.iconButton} ${styles.menuButton}`} onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="admin-sidebar"><Icon name="menu" /></button>
            <strong>{storeName}</strong>
            <span>{environment}</span>
          </div>
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
