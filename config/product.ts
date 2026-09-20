/** Product page behaviour and shared copy. Per-product copy lives in the catalog. */
export const productConfig = {
  /** At or below this many units a size is labelled "Low stock". Never shows counts. */
  lowStockThreshold: 3,
  relatedLimit: 3,
  /** How long the button reads "Added" before returning to its label. */
  addedFeedbackMs: 2200,
  copy: {
    collectionSuffix: "Collection",
    color: "Colour",
    size: "Size",
    sizeGuide: "Size guide",
    selectSize: "Select a size",
    selectSizePrompt: "Select a size to continue.",
    addToBag: "Add to bag",
    added: "Added",
    soldOut: "Sold out",
    quantityLimit: "Quantity limit reached",
    viewBag: "View bag",
    inStock: "In stock",
    lowStock: "Low stock",
    related: "You may also like",
    sizeAndFit: "Size & fit",
    rotateHint: "Drag to rotate",
    resetView: "Reset view",
    viewer3d: "3D view",
  },
  shipping: [
    "Complimentary shipping on orders over ₹5,000 within India.",
    "Dispatched within 2–4 working days.",
    "Returns accepted within 14 days, unworn and with tags.",
  ],
} as const;
