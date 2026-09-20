import Image from "@/components/ui/StoreImage";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { CartLineView } from "@/lib/cart";
import styles from "./checkout.module.css";

export function CheckoutItem({ item }: { item: CartLineView }) {
  return (
    <li className={styles.item}>
      <Link href={item.href} className={styles.itemImage} tabIndex={-1} aria-hidden="true">
        {item.image ? <Image src={item.image.src} alt="" fill sizes="72px" /> : null}
        <span>{item.quantity}</span>
      </Link>
      <div className={styles.itemInfo}>
        <h3><Link href={item.href}>{item.product.name}</Link></h3>
        <p>{item.variant.color} / {item.variant.size}</p>
      </div>
      <p className={styles.itemPrice}>{formatMoney(item.lineTotal, item.product.currency)}</p>
    </li>
  );
}
