"use client";

import { useLenis } from "@/components/animation/SmoothScrollProvider";
import Image from "@/components/ui/StoreImage";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { addItem, openBag, useBag } from "@/hooks/useBag";
import { formatPrice } from "@/lib/shop";
import { isProductAvailable, isVariantAvailable, productImages } from "@/lib/products";
import type { Product, ProductVariant } from "@/types/product";
import styles from "./quickSizeModal.module.css";

const STANDARD_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

interface QuickSizeModalProps {
  product: Product;
  onClose: () => void;
}

/**
 * Centered Quick Buy / Size Selection modal matching the editorial Stooky-style design.
 * Opens when the bag icon is clicked on any product card.
 */
export function QuickSizeModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const router = useRouter();
  const bag = useBag();
  const images = productImages(product).filter((img) => Boolean(img.src));

  let lenisRef: ReturnType<typeof useLenis> | null = null;
  try {
    lenisRef = useLenis();
  } catch {
    lenisRef = null;
  }

  // Find all variants for this product
  const variants = product.variants || [];

  // Default to the first available in-stock size (like "M" or "S")
  const firstInStockVariant = variants.find((v) => isVariantAvailable(v));
  const [selectedSize, setSelectedSize] = useState<string>(
    firstInStockVariant?.size ?? "M"
  );
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Lock body & Lenis smooth scroll when modal is open so background never scrolls
  useEffect(() => {
    const scroll = lenisRef?.current;
    scroll?.stop();

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      scroll?.start();
    };
  }, [lenisRef]);

  const selectedVariant: ProductVariant | undefined = variants.find(
    (v) => v.size === selectedSize
  );
  const isSelectedAvailable = selectedVariant ? isVariantAvailable(selectedVariant) : false;

  const handleAddToCart = useCallback(() => {
    if (!selectedVariant || !isSelectedAvailable) return;
    setIsAdding(true);
    const success = addItem(product.id, selectedVariant.id, 1);
    if (success) {
      setJustAdded(true);
      setTimeout(() => {
        setIsAdding(false);
        setJustAdded(false);
        onClose();
        openBag();
      }, 500);
    } else {
      setIsAdding(false);
    }
  }, [product.id, selectedVariant, isSelectedAvailable, onClose]);

  const handleBuyItNow = useCallback(() => {
    if (!selectedVariant || !isSelectedAvailable) return;
    addItem(product.id, selectedVariant.id, 1);
    onClose();
    router.push("/cart");
  }, [product.id, selectedVariant, isSelectedAvailable, onClose, router]);

  return (
    <div
      className={styles.overlay}
      data-lenis-prevent
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-size-title"
    >
      <div className={styles.modal} data-lenis-prevent>
        {/* Close Button */}
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close modal"
        >
          ×
        </button>

        {/* Left Column - Scrollable Product Images */}
        <div className={styles.mediaColumn} data-lenis-prevent>
          {images.map((img, idx) => (
            <div key={img.id || idx} className={styles.imageCard}>
              <Image
                src={img.src}
                alt={img.alt || `${product.name} - view ${idx + 1}`}
                fill
                sizes="(max-width: 640px) 100vw, 380px"
                className={styles.modalImage}
                priority={idx === 0}
              />
            </div>
          ))}

          {images.length > 1 ? (
            <div className={styles.imageScrollBadge} aria-hidden="true">
              <span>{images.length} VIEWS • SCROLL ↓</span>
            </div>
          ) : null}
        </div>

        {/* Right Column - Details & Size Selection */}
        <div className={styles.detailsColumn}>
          <h2 id="quick-size-title" className={styles.productTitle}>
            {product.name}
          </h2>

          <div className={styles.priceContainer}>
            <span className={styles.currentPrice}>{formatPrice(product.price)}</span>
            {selectedVariant?.compareAtPrice ? (
              <span className={styles.comparePrice}>
                {formatPrice(selectedVariant.compareAtPrice)}
              </span>
            ) : null}
          </div>

          {/* Size Selection Grid */}
          <div className={styles.sizeSection}>
            <span className={styles.sizeLabel}>Size</span>
            <div className={styles.sizeGrid} role="radiogroup" aria-label="Available Sizes">
              {STANDARD_SIZES.map((size) => {
                const variant = variants.find((v) => v.size === size);
                const inStock = variant ? isVariantAvailable(variant) : false;
                const isSelected = selectedSize === size;

                return (
                  <button
                    key={size}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={!inStock}
                    className={`${styles.sizeBox} ${
                      isSelected ? styles.sizeBoxSelected : ""
                    } ${!inStock ? styles.sizeBoxDisabled : ""}`}
                    onClick={() => {
                      if (inStock) setSelectedSize(size);
                    }}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.addToCartButton} ${
                justAdded ? styles.addToCartButtonSuccess : ""
              }`}
              disabled={!isSelectedAvailable || isAdding}
              onClick={handleAddToCart}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span>{justAdded ? "ADDED ✓" : isAdding ? "ADDING..." : "ADD TO CART"}</span>
            </button>

            <button
              type="button"
              className={styles.buyNowButton}
              disabled={!isSelectedAvailable}
              onClick={handleBuyItNow}
            >
              BUY IT NOW
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
