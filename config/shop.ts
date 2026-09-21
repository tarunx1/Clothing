export const shopConfig = {
  currency: "INR",
  locale: "en-IN",
  initialCount: 8,
  pageSize: 8,
  maxQuantity: 10,
  bagStorageKey: "clothin.bag.v1",
  sortOptions: [
    { value: "featured", label: "Featured" },
    { value: "price-asc", label: "Price: low to high" },
    { value: "price-desc", label: "Price: high to low" },
    { value: "newest", label: "Newest" },
  ],
} as const;
