import "server-only";
import { requireAdminAction, type AdminActor, type Permission } from "@/lib/admin/authorization";
import { toActionError, type ActionResult } from "@/lib/admin/errors";

/**
 * Every admin mutation goes through here: authenticate, authorize the role,
 * then run the service (which validates with Zod). Errors become readable
 * messages; nothing internal reaches the browser.
 */
export async function runAdminAction<T>(permission: Permission, operation: (actor: AdminActor) => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const actor = await requireAdminAction(permission);
    const data = await operation(actor);
    return { ok: true, data, message };
  } catch (error) {
    return toActionError(error);
  }
}
