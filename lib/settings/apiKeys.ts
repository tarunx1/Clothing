import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

/** Verification boundary for future external API routes. No route accepts a key until it calls this with a scope. */
export async function verifyStoreApiKey(token: string, permission: string) {
  if (!/^clt_[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const key = await prisma.apiKey.findUnique({ where: { keyHash: createHash("sha256").update(token).digest("hex") } });
  if (!key || key.revokedAt || key.expiresAt && key.expiresAt <= new Date() || !key.permissions.includes(permission)) return false;
  await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return true;
}
