import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { SurfaceTheme } from "@/components/layout/SurfaceTheme";
import styles from "@/components/product/product.module.css";

/** Unknown URLs render outside the (store) group, so the storefront chrome is added here. */
export default function NotFound() {
  return (
    <>
      <Header />
      <main className={`${styles.page} ${styles.missing}`} data-paper-surface>
        <SurfaceTheme theme="light" />
        <p className={styles.eyebrow}>404 / Page not found</p>
        <h1 className="display-type">Not here.</h1>
        <p>The link is incorrect or the page has moved. The current edit is waiting in the shop.</p>
        <Link href="/shop">BACK TO SHOP <span aria-hidden="true">↗</span></Link>
      </main>
      <Footer />
    </>
  );
}
