import Image from "@/components/ui/StoreImage";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Product } from "@/types/product";
import { formatPrice } from "@/lib/shop";
import { colorSummary, getProductCollection, isProductAvailable, listingImages } from "@/lib/products";
import styles from "./shop.module.css";

interface ProductCardProps {
  product: Product;
  /** Wide editorial card in the shop grid. */
  featured?: boolean;
  priority?: boolean;
  /** Shop grid opens a quick view; linked variants navigate to `href`. */
  onView?: () => void;
  href?: string;
  /** "related" renders the name as an h3 under a section heading. */
  variant?: "grid" | "related";
  sizes?: string;
}

/** The single product card used by the shop grid and related products. */
export function ProductCard({ product, featured = false, priority = false, onView, href, variant = "grid", sizes }: ProductCardProps) {
  const [primary, alternate] = listingImages(product);
  const collection = getProductCollection(product);
  const imageSizes = sizes ?? (featured ? "100vw" : "(max-width: 767px) 100vw, 50vw");
  const Heading = variant === "related" ? "h3" : "h2";

  const media = (
    <>
      {primary ? <Image src={primary.src} alt={primary.alt} fill sizes={imageSizes} preload={priority} className={styles.front} /> : null}
      {alternate ? <Image src={alternate.src} alt="" fill sizes={imageSizes} className={styles.alternate} /> : null}
      {featured ? <span className={styles.featureLabel}>IN FOCUS / {collection?.name ?? ""}</span> : null}
      {!isProductAvailable(product) ? <span className={styles.stockLabel}>Sold out</span> : null}
      <span className={styles.view}>VIEW PIECE <span aria-hidden="true">↗</span></span>
    </>
  );

  const trigger = (children: ReactNode, className?: string, label?: string) =>
    href ? (
      <Link href={href} className={className} aria-label={label}>{children}</Link>
    ) : (
      <button type="button" className={className} onClick={onView} aria-label={label}>{children}</button>
    );

  return (
    <article className={`${styles.card} ${featured ? styles.featured : ""} ${variant === "related" ? styles.related : ""}`}>
      {trigger(media, styles.imageButton, `View ${product.name}`)}
      <div className={styles.cardInfo}>
        <div>
          <Heading>{trigger(product.name)}</Heading>
          <p>{colorSummary(product)}</p>
        </div>
        <span>{formatPrice(product.price)}</span>
      </div>
    </article>
  );
}
