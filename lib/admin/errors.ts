import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { isDomainError } from "@/lib/errors";

export type AdminErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "CONFLICT" | "NOT_FOUND" | "INVALID_STATE" | "REAUTH_REQUIRED" | "CONFIGURATION";

/** An admin-facing failure whose message is safe to show as-is. */
export class AdminError extends Error {
  /** Per-field messages for forms (set by validators that check many fields at once). */
  fieldErrors?: Record<string, string>;
  constructor(public readonly code: AdminErrorCode, message: string, public readonly field?: string) {
    super(message);
    this.name = "AdminError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; code?: AdminErrorCode; fieldErrors?: Record<string, string> };

const uniqueMessages: Record<string, { field: string; message: string }> = {
  sku: { field: "sku", message: "SKU already exists." },
  slug: { field: "slug", message: "Slug is already in use." },
  email: { field: "email", message: "An admin with this email already exists." },
  productId_colorId_sizeId: { field: "variants", message: "That colour and size already exist for this product." },
};

/** Translates any thrown error into a human-readable result. Internals are logged, never returned. */
export function toActionError(error: unknown): Extract<ActionResult, { ok: false }> {
  if (error instanceof AdminError) {
    return { ok: false, error: error.message, code: error.code, fieldErrors: error.fieldErrors ?? (error.field ? { [error.field]: error.message } : undefined) };
  }
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "form";
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false, error: "Check the highlighted fields.", code: "VALIDATION", fieldErrors };
  }
  if (isDomainError(error)) return { ok: false, error: error.message, code: "INVALID_STATE" };
  if (error instanceof Error && error.name === "EncryptionUnavailableError") return { ok: false, error: error.message, code: "CONFIGURATION" };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = ([] as string[]).concat((error.meta?.target as string[] | string | undefined) ?? []).join("_");
      const known = Object.entries(uniqueMessages).find(([key]) => target.includes(key) || target.includes(key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)));
      if (known) return { ok: false, error: known[1].message, code: "CONFLICT", fieldErrors: { [known[1].field]: known[1].message } };
      return { ok: false, error: "That value is already in use.", code: "CONFLICT" };
    }
    if (error.code === "P2025") return { ok: false, error: "This record no longer exists. Refresh the page.", code: "NOT_FOUND" };
    if (error.code === "P2003") return { ok: false, error: "This record is still referenced elsewhere and can't be removed.", code: "CONFLICT" };
    if (error.code === "P2034") return { ok: false, error: "Another change happened at the same time. Try again.", code: "CONFLICT" };
  }
  console.error("[admin] Unexpected error", error instanceof Error ? error.name : "UnknownError");
  return { ok: false, error: "Something went wrong. Try again." };
}
