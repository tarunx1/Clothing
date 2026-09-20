import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { isDomainError, type DomainErrorCode } from "@/lib/errors";

const domainStatus: Partial<Record<DomainErrorCode, number>> = {
  CART_NOT_FOUND: 404,
  PRODUCT_NOT_FOUND: 404,
  VARIANT_NOT_FOUND: 404,
  SESSION_EXPIRED: 410,
  PAYMENT_VERIFICATION_FAILED: 400,
  PAYMENT_FAILED: 402,
  PAYMENT_MISMATCH: 400,
  PAYMENT_UNAVAILABLE: 503,
  DATABASE_UNAVAILABLE: 503,
  RATE_LIMITED: 429,
  FORBIDDEN: 403,
};

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "Check the submitted values.", issues: error.flatten() } }, { status: 400 });
  }
  if (isDomainError(error)) {
    const status = domainStatus[error.code] ?? 409;
    return NextResponse.json({ error: { code: error.code, message: error.message, details: error.details } }, { status });
  }
  console.error(error);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } }, { status: 500 });
}
