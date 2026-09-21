"use client";

import Image from "@/components/ui/StoreImage";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import type { Product } from "@/types/product";
import { formatPrice } from "@/lib/shop";
import { getProductCollection, isProductAvailable, productImages } from "@/lib/products";
import styles from "./shop.module.css";

interface ProductCardProps {
  product: Product;
  /** Wide editorial card in the shop grid. */
  featured?: boolean;
  priority?: boolean;
  /** Shop grid opens a quick view / size modal */
  onView?: () => void;
  href?: string;
  /** "related" renders the name as an h3 under a section heading. */
  variant?: "grid" | "related";
  sizes?: string;
  aspectRatio?: string;
}

/**
 * Editorial product card featuring auto-changing image cycle on hover,
 * slider navigation arrows, and an expanding quick-add action.
 */
export function ProductCard({
  product,
  featured = false,
  priority = false,
  onView,
  href,
  variant = "grid",
  sizes,
  aspectRatio = "1 / 1.32",
}: ProductCardProps) {
  const allImages = productImages(product).filter((img) => Boolean(img.src));
  const collection = getProductCollection(product);
  const imageSizes = sizes ?? (featured ? "100vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw");
  const Heading = variant === "related" ? "h3" : "h2";
  const targetHref = href || `/product/${product.slug}`;

  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const cycleIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto change images on hover with smooth interval
  useEffect(() => {
    if (isHovered && allImages.length > 1) {
      cycleIntervalRef.current = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % allImages.length);
      }, 1400);
    } else {
      if (cycleIntervalRef.current) {
        clearInterval(cycleIntervalRef.current);
        cycleIntervalRef.current = null;
      }
      setActiveIndex(0);
    }

    return () => {
      if (cycleIntervalRef.current) {
        clearInterval(cycleIntervalRef.current);
      }
    };
  }, [isHovered, allImages.length]);

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (cycleIntervalRef.current) {
      clearInterval(cycleIntervalRef.current);
      cycleIntervalRef.current = null;
    }
    setActiveIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (cycleIntervalRef.current) {
      clearInterval(cycleIntervalRef.current);
      cycleIntervalRef.current = null;
    }
    setActiveIndex((prev) => (prev + 1) % allImages.length);
  };

  const formattedPrice = product.currency === "INR" || !product.currency
    ? `RS. ${product.price.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : formatPrice(product.price);

  const comparePrice = product.compareAtPrice
    ? (product.currency === "INR" || !product.currency
        ? `RS. ${product.compareAtPrice.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : formatPrice(product.compareAtPrice))
    : null;

  return (
    <article
      className={`${styles.card} ${featured ? styles.featured : ""} ${variant === "related" ? styles.related : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setActiveIndex(0);
      }}
    >
      <div className={styles.mediaContainer} style={{ position: "relative", width: "100%", aspectRatio }}>
        {/* Main image link navigating to product page */}
        <Link href={targetHref} className={styles.imageLink} aria-label={`View ${product.name}`}>
          {allImages.map((img, idx) => {
            const isActive = idx === activeIndex;
            return (
              <div
                key={img.id || idx}
                className={`${styles.imageSlide} ${isActive ? styles.imageSlideActive : ""}`}
                style={{ position: "absolute", inset: 0 }}
                aria-hidden={!isActive}
              >
                <Image
                  src={img.src}
                  alt={isActive ? (img.alt || product.name) : ""}
                  fill
                  sizes={imageSizes}
                  preload={priority && idx === 0}
                  className={styles.cardImage}
                />
              </div>
            );
          })}

          {/* Micro indicators during hover auto-cycle */}
          {allImages.length > 1 ? (
            <div
              className={`${styles.indicators} ${isHovered ? styles.indicatorsVisible : ""}`}
              aria-hidden="true"
            >
              {allImages.map((_, idx) => (
                <span
                  key={idx}
                  className={`${styles.indicatorBar} ${idx === activeIndex ? styles.indicatorBarActive : ""}`}
                />
              ))}
            </div>
          ) : null}

          {featured ? <span className={styles.featureLabel}>IN FOCUS / {collection?.name ?? ""}</span> : null}
          {!isProductAvailable(product) ? <span className={styles.stockLabel}>Sold out</span> : null}
        </Link>

        {/* Left / Right Slider Arrows */}
        {allImages.length > 1 ? (
          <>
            <button
              type="button"
              className={`${styles.sliderArrow} ${styles.sliderArrowPrev}`}
              onClick={handlePrev}
              aria-label={`Previous image for ${product.name}`}
              title="Previous image"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
                <line x1="21" y1="12" x2="3" y2="12" />
                <polyline points="8 7.5 3 12 8 16.5" />
              </svg>
            </button>
            <button
              type="button"
              className={`${styles.sliderArrow} ${styles.sliderArrowNext}`}
              onClick={handleNext}
              aria-label={`Next image for ${product.name}`}
              title="Next image"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <polyline points="16 7.5 21 12 16 16.5" />
              </svg>
            </button>
          </>
        ) : null}

        {/* Floating Quick Size / Bag button - sharp streetwear design */}
        <button
          type="button"
          className={styles.quickAddButton}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onView?.();
          }}
          aria-label={`Add ${product.name} to bag`}
          title="Add to bag"
        >
          <svg
            className={styles.quickAddIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <span className={styles.quickAddText}>ADD</span>
        </button>
      </div>

      <div className={styles.cardInfo}>
        <div className={styles.metaMain}>
          <Heading className={styles.productTitle}>
            <Link href={targetHref}>{product.name}</Link>
          </Heading>
          <div className={styles.priceRow}>
            <span className={styles.productPrice}>{formattedPrice}</span>
            {comparePrice ? <span className={styles.comparePrice}>{comparePrice}</span> : null}
          </div>
        </div>
      </div>
    </article>
  );
}
