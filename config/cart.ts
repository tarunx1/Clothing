/** Bag / cart behaviour and copy. Stock limits come from variant inventory. */
export const cartConfig = {
  /** The checkout UI validates shipping and prepares a future payment handoff. */
  checkoutHref: "/checkout",
  checkoutEnabled: true,
  continueHref: "/shop",
  copy: {
    title: "Bag",
    pageTitle: "Your bag",
    empty: "Your bag is empty.",
    discover: "Discover the collection",
    subtotal: "Subtotal",
    shipping: "Shipping",
    shippingNote: "Calculated at checkout",
    checkout: "Checkout",
    checkoutSoon: "Your bag is saved on this device.",
    continue: "Continue shopping",
    remove: "Remove",
    maximum: "Maximum available",
    product: "Product",
    price: "Price",
    orderSummary: "Order summary",
    removed: "removed from your bag.",
  },
} as const;
