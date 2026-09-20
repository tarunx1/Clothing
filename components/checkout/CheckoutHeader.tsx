import Link from "next/link";
import { checkoutConfig } from "@/config/checkout";
import styles from "./checkout.module.css";

export function CheckoutHeader({ storeName }: { storeName: string }) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label={`${storeName} home`}>{storeName}</Link>
      <p className={styles.secure}><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" /><path d="M5.5 7V4.8a2.5 2.5 0 0 1 5 0V7" /></svg>{checkoutConfig.copy.secure}</p>
    </header>
  );
}
