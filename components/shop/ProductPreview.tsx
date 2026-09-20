"use client";
import Image from "@/components/ui/StoreImage";
import Link from "next/link";
import { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { addItem, useBag } from "@/hooks/useBag";
import { variantLimit } from "@/lib/cart";
import { formatPrice } from "@/lib/shop";
import { colorSummary, defaultColor, isProductAvailable, isVariantAvailable, listingImages, productHref, sizeOptions } from "@/lib/products";
import type { Product } from "@/types/product";
import styles from "./shop.module.css";
export function ProductPreview({ product, onClose }: { product: Product; onClose: () => void }) {
  const color = defaultColor(product);
  const options = sizeOptions(product, color);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const bag = useBag();
  const [image] = listingImages(product);
  const selected = options.find(option => option.variant?.id === variantId)?.variant ?? null;
  const available = isProductAvailable(product);
  const atLimit = Boolean(selected && bag.some(line => line.variantId === selected.id && line.quantity >= variantLimit(selected)));
  return <Drawer title={product.name} onClose={onClose}>
    {image ? <Image className={styles.previewImage} src={image.src} alt={image.alt} width={600} height={750} sizes="(max-width: 500px) 90vw, 440px" /> : null}
    <div className={styles.previewMeta}><span>{colorSummary(product)}</span><span>{formatPrice(product.price)}</span></div>
    <p className={styles.description}>{product.description}</p>
    <fieldset className={styles.fieldset}><legend>Select size</legend><div className={styles.sizes}>{options.map(({ size, variant }) => <button type="button" key={size} aria-pressed={variant !== null && variantId === variant.id} disabled={!isVariantAvailable(variant)} onClick={() => { if (variant) { setVariantId(variant.id); setMessage(""); } }}>{size}</button>)}</div></fieldset>
    <button className={styles.primary} disabled={!available || !selected || atLimit} onClick={() => { if (selected && addItem(product.id, selected.id)) setMessage(`${product.name} / ${selected.size} added to your bag.`); }}>{!available ? "SOLD OUT" : atLimit ? "QUANTITY LIMIT REACHED" : selected ? "ADD TO BAG +" : "SELECT A SIZE"}</button>
    <p role="status" className={styles.status}>{message}</p>
    <Link className={styles.detailsLink} href={productHref(product)}>VIEW FULL DETAILS <span aria-hidden="true">↗</span></Link>
  </Drawer>;
}
