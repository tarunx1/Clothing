"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { productImages } from "@/lib/products";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { defaultSizeChart, sizeCharts } from "@/config/sizeGuide";
import type { Product } from "@/types/product";
import type { Collection } from "@/types/collection";
import { MobilePurchaseBar } from "./MobilePurchaseBar";
import { ProductInfoPanel } from "./ProductInfoPanel";
import { ProductMediaGallery } from "./ProductMediaGallery";
import { SizeGuide } from "./SizeGuide";
import { useProductPurchase } from "./useProductPurchase";
import styles from "./product.module.css";

// WebGL is client-only and only downloaded for products that have a 3D asset.
const ProductGarmentView = dynamic(() => import("./ProductGarmentView"), {
  ssr: false,
  loading: () => <div className={styles.viewer} aria-hidden="true" />,
});

/**
 * Media + purchase split. Owns the local UI state (color, size, size guide);
 * the bag is the only global state.
 */
export function ProductView({ product, collection }: { product: Product; collection: Collection | null }) {
  const sizeGroupRef = useRef<HTMLFieldSetElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const purchase = useProductPurchase(product, sizeGroupRef);
  const [guideOpen, setGuideOpen] = useState(false);
  const phone = useMediaQuery("(max-width: 767px)", false);

  const images = productImages(product, purchase.color);
  const chart = sizeCharts[product.sizeChart ?? defaultSizeChart] ?? sizeCharts[defaultSizeChart];
  const model = product.model3d ? <ProductGarmentView glb={product.model3d.glb} productName={product.name} /> : null;

  return (
    <>
      <div className={styles.hero}>
        <ProductMediaGallery images={images} productName={product.name} modelView={phone ? null : model} />
        <div className={styles.panelColumn}>
          <ProductInfoPanel
            product={product}
            collection={collection}
            purchase={purchase}
            onOpenSizeGuide={() => setGuideOpen(true)}
            ctaRef={ctaRef}
            sizeGroupRef={sizeGroupRef}
          />
        </div>
      </div>
      {phone && model ? <div className={styles.mobileViewer}>{model}</div> : null}
      <MobilePurchaseBar product={product} purchase={purchase} ctaRef={ctaRef} hidden={guideOpen} />
      {guideOpen ? (
        <SizeGuide chart={chart} selectedSize={purchase.size} fitAdvice={product.fitAdvice} onClose={() => setGuideOpen(false)} />
      ) : null}
    </>
  );
}
