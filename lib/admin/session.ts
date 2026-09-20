import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import type { AdminActor } from "@/lib/admin/authorization";

export const ADMIN_COOKIE = "clothin_admin";
const DEFAULT_SESSION_HOURS = 12;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a server-side session and sets the opaque cookie. Call from a server action only. */
export async function startAdminSession(adminId: string, userAgent?: string | null, sessionHours = DEFAULT_SESSION_HOURS) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionHours * 3_600_000);
  await prisma.adminSession.create({ data: { tokenHash: hashToken(token), adminId, expiresAt, stepUpAt: new Date(), userAgent: userAgent?.slice(0, 250) ?? null } });
  // Opportunistic cleanup keeps the table small without a scheduler.
  await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

let tokenSource: (() => Promise<string | undefined>) | null = null;

/** Test seam: supply the session token without a request (cookies() needs Next's request scope). */
export function setSessionTokenSourceForTesting(source: (() => Promise<string | undefined>) | null) {
  tokenSource = source;
}

export async function readAdminSession(): Promise<{ sessionId: string; stepUpAt: Date | null; admin: AdminActor } | null> {
  const token = tokenSource ? await tokenSource() : (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || token.length > 128) return null;
  return findSessionByToken(token);
}

export async function findSessionByToken(token: string) {
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { admin: { select: { id: true, email: true, name: true, role: true, active: true } } },
  });
  if (!session || session.expiresAt <= new Date() || !session.admin.active) return null;
  const { id, email, name, role } = session.admin;
  return { sessionId: session.id, stepUpAt: session.stepUpAt, admin: { id, email, name, role } };
}

export async function endAdminSession() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (token) await prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(ADMIN_COOKIE);
}

/** Marks the current session as freshly authenticated after a password confirmation. */
export const markSessionStepUp = (sessionId: string) => prisma.adminSession.update({ where: { id: sessionId }, data: { stepUpAt: new Date() } });

/** Signs out every session of an admin (deactivation, role change, password change). */
export const revokeAdminSessions = (adminId: string, exceptSessionId?: string) =>
  prisma.adminSession.deleteMany({ where: { adminId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });

/** Test/provisioning helper: issue a session token without cookies. */
export async function issueSessionToken(adminId: string, options: { stepUpAt?: Date | null } = {}) {
  const token = randomBytes(32).toString("base64url");
  await prisma.adminSession.create({
    data: { tokenHash: hashToken(token), adminId, expiresAt: new Date(Date.now() + DEFAULT_SESSION_HOURS * 3_600_000), stepUpAt: options.stepUpAt === undefined ? new Date() : options.stepUpAt },
  });
  return token;
}
