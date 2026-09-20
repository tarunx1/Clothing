import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { SurfaceTheme } from "@/components/layout/SurfaceTheme";
import styles from "@/components/product/product.module.css";

export default function ProductNotFound() {
  return (
    <>
      <main className={`${styles.page} ${styles.missing}`} data-paper-surface>
        <SurfaceTheme theme="light" />
        <p className={styles.eyebrow}>404 / Piece not found</p>
        <h1 className="display-type">Not here.</h1>
        <p>This piece is no longer available, or the link is incorrect. The current edit is waiting in the shop.</p>
        <Link href="/shop">BACK TO SHOP <span aria-hidden="true">↗</span></Link>
      </main>
      <Footer />
    </>
  );
}
