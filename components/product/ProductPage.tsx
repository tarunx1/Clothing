import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { SurfaceTheme } from "@/components/layout/SurfaceTheme";
import { getProductCollection } from "@/lib/products";
import type { Product } from "@/types/product";
import { ProductAttributes } from "./ProductAttributes";
import { ProductSizeFit } from "./ProductSizeFit";
import { ProductView } from "./ProductView";
import { RelatedProducts } from "./RelatedProducts";
import styles from "./product.module.css";

/** Page composition. Data arrives resolved from the route; nothing here is product-specific. */
export function ProductPage({ product, related }: { product: Product; related: Product[] }) {
  const collection = getProductCollection(product);
  return (
    <>
      <main className={styles.page} data-paper-surface>
        <SurfaceTheme theme="light" />
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <ol>
            <li><Link href="/shop">Shop</Link></li>
            {collection ? <li>{collection.name}</li> : null}
            <li aria-current="page">{product.name}</li>
          </ol>
        </nav>
        <ProductView product={product} collection={collection} />
        <ProductAttributes product={product} />
        <ProductSizeFit product={product} />
        <RelatedProducts products={related} />
      </main>
      <Footer />
    </>
  );
}
