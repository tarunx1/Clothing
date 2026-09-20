import Link from "next/link";
import { cartConfig } from "@/config/cart";
import styles from "./cart.module.css";

export function EmptyCart({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className={styles.empty}>
      <p>{cartConfig.copy.empty}</p>
      <Link href={cartConfig.continueHref} className={styles.emptyLink} onClick={onNavigate} data-cart-focus>
        {cartConfig.copy.discover} <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
