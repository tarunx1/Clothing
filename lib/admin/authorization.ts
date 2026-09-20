import "server-only";
import type { AdminRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { cache } from "react";
import { AdminError } from "@/lib/admin/errors";
import { hasPermission, type Permission } from "@/lib/admin/permissions";
import { readAdminSession } from "@/lib/admin/session";

export { PERMISSIONS, type Permission } from "@/lib/admin/permissions";

export interface AdminActor {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  /** Present for browser sessions; absent for system/test actors. */
  sessionId?: string;
  /** Last time this session confirmed the password (sign-in or step-up). */
  authenticatedAt?: Date | null;
}

export const can = (actor: Pick<AdminActor, "role"> | null | undefined, permission: Permission) => hasPermission(actor?.role, permission);

/** Data Access Layer entry: the verified admin for this request, memoized per render. */
export const getAdminActor = cache(async (): Promise<AdminActor | null> => {
  const session = await readAdminSession();
  return session ? { ...session.admin, sessionId: session.sessionId, authenticatedAt: session.stepUpAt } : null;
});

/** For admin pages: redirects to login when signed out, to the dashboard when the role lacks access. */
export async function requireAdminPage(permission: Permission = "dashboard:view"): Promise<AdminActor> {
  const actor = await getAdminActor();
  if (!actor) redirect("/admin/login");
  if (!can(actor, permission)) redirect("/admin?denied=1");
  return actor;
}

/** For server actions and route handlers. Never trusts that the call came from the admin UI. */
export async function requireAdminAction(permission: Permission): Promise<AdminActor> {
  const actor = await getAdminActor();
  if (!actor) throw new AdminError("UNAUTHENTICATED", "Your session has ended. Sign in again.");
  if (!can(actor, permission)) throw new AdminError("FORBIDDEN", "Your role does not allow this action.");
  return actor;
}

/**
 * Step-up check for sensitive changes (secrets, payment mode, storage, API keys,
 * team). The session must have confirmed the password within `windowMinutes`,
 * so an unattended signed-in browser can't silently replace critical keys.
 */
export function requireRecentAuthentication(actor: AdminActor, windowMinutes: number) {
  if (!actor.sessionId) return; // system/test actors
  const at = actor.authenticatedAt?.getTime() ?? 0;
  if (Date.now() - at > windowMinutes * 60_000) {
    throw new AdminError("REAUTH_REQUIRED", "Confirm your password to make this change.");
  }
}
