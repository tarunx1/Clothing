import type { BagLine, CurrencyCode } from "@/types/product";

export interface CartQuote {
  lines: BagLine[];
  subtotal: number;
  currency: CurrencyCode;
}

export interface CartMutationResult extends CartQuote {
  count: number;
}
