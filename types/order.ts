import type { CurrencyCode } from "@/types/product";

export interface OrderTotals {
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
  currency: CurrencyCode;
}

export interface OrderItemSnapshot {
  productName: string;
  sku: string;
  sizeName: string;
  colorName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  imageUrl?: string;
}
