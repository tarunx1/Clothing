import "server-only";
import { DomainError } from "@/lib/errors";

/**
 * CSRF defence for JSON mutations: the request must come from this site's own
 * origin and carry a JSON body (which forces a CORS preflight cross-site).
 * The cart cookie is also SameSite=Lax, so cross-site POSTs arrive without it.
 */
/** True when the request was issued by this site's own pages (Origin + Sec-Fetch-Site). */
export function isSameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * CSRF defence for JSON mutations: the request must come from this site's own
 * origin and carry a JSON body (which forces a CORS preflight cross-site).
 * The cart cookie is also SameSite=Lax, so cross-site POSTs arrive without it.
 */
export function assertSameOriginJson(request: Request) {
  if (!isSameOrigin(request)) throw new DomainError("FORBIDDEN", "Request not allowed.");
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new DomainError("FORBIDDEN", "Request not allowed.");
  }
}

export function clientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}
