import { NextResponse, type NextRequest } from "next/server";
import { storeAccessState, validPreviewToken, STORE_ACCESS_COOKIE } from "@/lib/settings/storeAccess";

/**
 * Optimistic gate only: sends visitors without an admin cookie to the login
 * page. Every admin page, action and route still verifies the session against
 * the database (lib/admin/authorization.ts).
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login" || request.cookies.has("clothin_admin")) return NextResponse.next();
    const login = new URL("/admin/login", request.url);
    if (pathname !== "/admin") login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }
  // Admin APIs enforce their own sessions; in-flight payments must still verify and settle.
  if (pathname.startsWith("/api/admin/") || pathname === "/api/webhooks/payment" || pathname === "/api/checkout/payment/verify" || pathname === "/api/checkout/payment/cancel" || pathname.startsWith("/order/confirmation/") || pathname === "/store-access") return NextResponse.next();
  try {
    const state = await storeAccessState();
    if (!state.maintenanceEnabled && (!state.passwordEnabled || validPreviewToken(request.cookies.get(STORE_ACCESS_COOKIE)?.value, state.passwordHash))) return NextResponse.next();
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: { code: "STORE_UNAVAILABLE", message: "The store is not open right now." } }, { status: 503, headers: { "cache-control": "no-store" } });
    const target = new URL("/store-access", request.url);
    target.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(target);
  } catch {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("The store is temporarily unavailable.", { status: 503, headers: { "cache-control": "no-store" } });
  }
}

export const config = {
  matcher: ["/((?!_next/|images/|media/|models/|textures/|favicon.ico|robots.txt|sitemap.xml).*)"],
};
