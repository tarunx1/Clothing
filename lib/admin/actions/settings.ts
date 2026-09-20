"use server";

import { z } from "zod";
import { runAdminAction } from "@/lib/admin/actionRunner";
import { requireRecentAuthentication } from "@/lib/admin/authorization";
import { AdminError } from "@/lib/admin/errors";
import { verifyPassword, hashPassword } from "@/lib/admin/password";
import { markSessionStepUp } from "@/lib/admin/session";
import { isRateLimited, recordAttempt, clearRateLimit } from "@/lib/http/rateLimit";
import { prisma } from "@/lib/db/prisma";
import { getNamespace } from "@/lib/settings/registry";
import { exportSettings, getSettingsFresh, importSettings, invalidateSettings, reencryptAllSecrets, setPrivateValue, updateSettings } from "@/lib/settings/settingsService";

export async function saveSettingsAction(namespace: string, input: unknown) {
  const def = getNamespace(namespace);
  return runAdminAction(def?.permission ?? "security:manage", async (actor) => {
    const parsed = z.object({ values: z.record(z.unknown()).optional(), secrets: z.record(z.string().nullable()).optional(), confirmed: z.boolean().optional() }).parse(input);
    if (!def) throw new AdminError("VALIDATION", "Unknown section.");
    const current = await getSettingsFresh(namespace as Parameters<typeof getSettingsFresh>[0]) as Record<string, unknown>;
    const sensitive = def.fields.some((field) => field.sensitive && parsed.values && field.key in parsed.values && JSON.stringify(current[field.key]) !== JSON.stringify(parsed.values[field.key]));
    if ((sensitive || Object.values(parsed.secrets ?? {}).some((value) => value === null)) && !parsed.confirmed) throw new AdminError("VALIDATION", "Confirm this sensitive change before saving.");
    return updateSettings(actor, namespace, parsed);
  }, "Settings saved.");
}

export async function confirmPasswordAction(password: unknown) {
  return runAdminAction("settings:write", async (actor) => {
    const input = z.string().min(1).max(200).parse(password);
    if (!actor.sessionId) throw new AdminError("UNAUTHENTICATED", "Sign in again.");
    const key = `settings-stepup:${actor.id}`;
    if (isRateLimited(key, 5)) throw new AdminError("FORBIDDEN", "Too many attempts. Try again in 15 minutes.");
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { id: actor.id } });
    if (!await verifyPassword(input, admin.passwordHash)) {
      recordAttempt(key, 15 * 60_000);
      throw new AdminError("VALIDATION", "Password is incorrect.");
    }
    clearRateLimit(key);
    await markSessionStepUp(actor.sessionId);
    return null;
  }, "Password confirmed. You can save your changes.");
}

export async function setStorePasswordAction(password: unknown) {
  return runAdminAction("security:manage", async (actor) => {
    requireRecentAuthentication(actor, (await getSettingsFresh("security")).stepUpMinutes);
    const value = z.string().min(12, "Use at least 12 characters.").max(200).parse(password);
    await setPrivateValue(actor, "status", "passwordHash", await hashPassword(value), "STORE_PASSWORD_UPDATED");
    invalidateSettings("status");
    return null;
  }, "Store password replaced. Existing preview sessions are invalidated.");
}

export async function exportSettingsAction() {
  return runAdminAction("security:manage", () => exportSettings());
}

export async function importSettingsAction(input: unknown, dryRun = true) {
  return runAdminAction("security:manage", async (actor) => {
    requireRecentAuthentication(actor, (await getSettingsFresh("security")).stepUpMinutes);
    return importSettings(actor, input, { dryRun });
  });
}

export async function advancedSettingsAction(action: "cache" | "reencrypt") {
  return runAdminAction("security:manage", async (actor) => {
    requireRecentAuthentication(actor, (await getSettingsFresh("security")).stepUpMinutes);
    if (action === "reencrypt") return reencryptAllSecrets(actor);
    if (action !== "cache") throw new AdminError("VALIDATION", "Unknown action.");
    invalidateSettings("general");
    const { recordAudit } = await import("@/lib/admin/audit");
    await recordAudit(prisma, actor, "SETTINGS_CACHE_CLEARED" as never, "settings", null);
    return { rotated: 0 };
  }, "Completed.");
}
