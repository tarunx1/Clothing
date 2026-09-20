import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getPrivateValue, getSettingsFresh } from "./settingsService";

export const STORE_ACCESS_COOKIE = "clothin_preview";
/** Fresh security reads avoid cross-worker cache invalidation delays for access changes. */
export async function storeAccessState() {
  const settings = await getSettingsFresh("status");
  const passwordHash = settings.passwordEnabled ? await getPrivateValue("status", "passwordHash") : null;
  return { ...settings, passwordHash };
}
export function previewToken(passwordHash: string) {
  const expires = String(Date.now() + 24 * 60 * 60_000);
  return `${expires}.${createHmac("sha256", passwordHash).update(expires).digest("base64url")}`;
}
export function validPreviewToken(token: string | undefined, passwordHash: string | null) {
  if (!token || !passwordHash || token.length > 150) return false;
  const [expires, signature] = token.split(".");
  if (!/^\d+$/.test(expires) || Number(expires) <= Date.now() || !signature) return false;
  const expected = createHmac("sha256", passwordHash).update(expires).digest();
  const supplied = Buffer.from(signature, "base64url");
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}
