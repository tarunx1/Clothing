import "server-only";
import { cookies } from "next/headers";

export const CART_COOKIE = "clothin_cart";

export async function getCartSession(create = true): Promise<string | null> {
  const store = await cookies();
  const existing = store.get(CART_COOKIE)?.value;
  if (existing) return existing;
  if (!create) return null;
  const sessionId = crypto.randomUUID();
  store.set(CART_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return sessionId;
}
