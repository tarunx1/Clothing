export type DomainErrorCode =
  | "PRODUCT_NOT_FOUND"
  | "VARIANT_NOT_FOUND"
  | "OUT_OF_STOCK"
  | "INVALID_QUANTITY"
  | "CART_NOT_FOUND"
  | "CHECKOUT_INVALID"
  | "DATABASE_UNAVAILABLE"
  | "SESSION_EXPIRED"
  | "ORDER_ALREADY_PAID"
  | "PAYMENT_UNAVAILABLE"
  | "PAYMENT_VERIFICATION_FAILED"
  | "PAYMENT_FAILED"
  | "PAYMENT_MISMATCH"
  | "RATE_LIMITED"
  | "FORBIDDEN";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const isDomainError = (error: unknown): error is DomainError => error instanceof DomainError;
