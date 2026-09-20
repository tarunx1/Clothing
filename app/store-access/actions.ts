"use server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "@/lib/admin/password";
import { isRateLimited, recordAttempt } from "@/lib/http/rateLimit";
import { previewToken, storeAccessState, STORE_ACCESS_COOKIE } from "@/lib/settings/storeAccess";

export async function unlockStore(_state: { error: string }, form: FormData) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `store-unlock:${ip}`;
  if (isRateLimited(key, 10)) return { error: "Too many attempts. Try again in 15 minutes." };
  const state = await storeAccessState();
  if (state.maintenanceEnabled) return { error: "The store is currently under maintenance." };
  const password = form.get("password");
  if (typeof password !== "string" || password.length > 200 || !state.passwordHash || !await verifyPassword(password, state.passwordHash)) {
    recordAttempt(key, 15 * 60_000); return { error: "Incorrect store password." };
  }
  (await cookies()).set(STORE_ACCESS_COOKIE, previewToken(state.passwordHash), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 24 * 60 * 60 });
  const next = String(form.get("next") ?? "/");
  redirect(/^\/(?!\/)[A-Za-z0-9/_?=&%.-]*$/.test(next) && !next.startsWith("/store-access") ? next : "/");
}
