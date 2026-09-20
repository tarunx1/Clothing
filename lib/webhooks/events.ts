/** Outbound webhook events a store can subscribe to. Shared by the admin UI and the dispatcher. */
export const STORE_EVENTS = [
  { value: "ORDER_CREATED", label: "Order created (checkout started)" },
  { value: "ORDER_PAID", label: "Order paid" },
  { value: "ORDER_CANCELLED", label: "Order cancelled" },
  { value: "ORDER_SHIPPED", label: "Order shipped" },
  { value: "ORDER_DELIVERED", label: "Order delivered" },
  { value: "PRODUCT_UPDATED", label: "Product updated" },
  { value: "INVENTORY_LOW", label: "Inventory low" },
] as const;
export type StoreEvent = (typeof STORE_EVENTS)[number]["value"];
