"use server";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { runAdminAction } from "@/lib/admin/actionRunner";
import { requireRecentAuthentication, type AdminActor } from "@/lib/admin/authorization";
import { recordAudit } from "@/lib/admin/audit";
import { AdminError } from "@/lib/admin/errors";
import { prisma } from "@/lib/db/prisma";
import { getSettingsFresh } from "@/lib/settings/settingsService";
import { sealCredentialSecret, sealWebhookSecret } from "@/lib/settings/secretRecords";
import { testIntegration } from "@/lib/settings/integrations";
import { assertSafeOutboundUrl } from "@/lib/webhooks/urlSafety";
import { sendTestEvent } from "@/lib/webhooks/dispatcher";
import { STORE_EVENTS } from "@/lib/webhooks/events";
import { invalidateStorefront } from "@/lib/admin/revalidate";

const recent = async (actor: AdminActor) => requireRecentAuthentication(actor, (await getSettingsFresh("security")).stepUpMinutes);
const refresh = () => invalidateStorefront({ paths: ["/admin/settings"] });
const scopes = z.enum(["READ_PRODUCTS", "WRITE_PRODUCTS", "READ_ORDERS", "WRITE_ORDERS", "READ_INVENTORY", "WRITE_INVENTORY"]);

export async function testIntegrationAction(id: string, recipient?: string) {
  return runAdminAction(id === "analytics" ? "settings:write" : "integrations:manage", async (actor) => {
    await recent(actor);
    const result = await testIntegration(z.string().max(80).parse(id), recipient);
    await recordAudit(prisma, actor, "INTEGRATION_TESTED", "integration", id, { success: result.ok });
    refresh(); return result;
  });
}

export async function webhookAction(action: "create" | "update" | "rotate" | "delete" | "test", input: unknown) {
  return runAdminAction("integrations:manage", async (actor) => {
    await recent(actor);
    if (action === "create") {
      const values = z.object({ name: z.string().trim().min(1).max(80), url: z.string().url().max(500), events: z.array(z.string().refine((event) => STORE_EVENTS.some((entry) => entry.value === event))).min(1), enabled: z.boolean() }).parse(input);
      await assertSafeOutboundUrl(values.url);
      const id = randomUUID(), secret = randomBytes(32).toString("base64url");
      await prisma.$transaction(async (tx) => {
        await tx.webhookEndpoint.create({ data: { id, ...values, ...sealWebhookSecret(id, secret), createdById: actor.id } });
        await recordAudit(tx, actor, "WEBHOOK_CREATED", "webhook", id);
      });
      refresh(); return { secret };
    }
    const { id } = z.object({ id: z.string().uuid() }).parse(input);
    if (action === "test") { const result = await sendTestEvent(id); await recordAudit(prisma, actor, "INTEGRATION_TESTED", "webhook", id, { success: result.ok }); return { message: result.ok ? "Test event delivered." : "Delivery failed. See the delivery log." }; }
    if (action === "rotate") {
      const secret = randomBytes(32).toString("base64url");
      await prisma.$transaction(async (tx) => { await tx.webhookEndpoint.update({ where: { id }, data: sealWebhookSecret(id, secret) }); await recordAudit(tx, actor, "WEBHOOK_SECRET_ROTATED", "webhook", id); });
      refresh(); return { secret };
    }
    await prisma.$transaction(async (tx) => {
      if (action === "delete") await tx.webhookEndpoint.delete({ where: { id } });
      else if (action === "update") { const { enabled } = z.object({ enabled: z.boolean() }).parse(input); await tx.webhookEndpoint.update({ where: { id }, data: { enabled } }); }
      else throw new AdminError("VALIDATION", "Unknown action.");
      await recordAudit(tx, actor, action === "delete" ? "WEBHOOK_DELETED" : "WEBHOOK_UPDATED", "webhook", id);
    });
    refresh(); return { message: "Webhook updated." };
  });
}

export async function apiKeyAction(action: "create" | "revoke" | "rotate", input: unknown) {
  return runAdminAction("integrations:manage", async (actor) => {
    await recent(actor);
    if (action === "create" || action === "rotate") {
      const values = action === "create" ? z.object({ name: z.string().trim().min(1).max(80), permissions: z.array(scopes).min(1) }).parse(input) : await prisma.apiKey.findUniqueOrThrow({ where: { id: z.object({ id: z.string().uuid() }).parse(input).id } });
      const secret = `clt_${randomBytes(32).toString("base64url")}`;
      await prisma.$transaction(async (tx) => {
        if ("id" in values) await tx.apiKey.update({ where: { id: values.id }, data: { revokedAt: new Date() } });
        const key = await tx.apiKey.create({ data: { name: values.name, permissions: values.permissions, prefix: secret.slice(0, 12), keyHash: createHash("sha256").update(secret).digest("hex"), createdById: actor.id } });
        await recordAudit(tx, actor, action === "create" ? "API_KEY_CREATED" : "API_KEY_ROTATED", "api-key", key.id);
      });
      refresh(); return { secret };
    }
    if (action !== "revoke") throw new AdminError("VALIDATION", "Unknown action.");
    const { id } = z.object({ id: z.string().uuid() }).parse(input);
    await prisma.$transaction(async (tx) => { await tx.apiKey.update({ where: { id }, data: { revokedAt: new Date() } }); await recordAudit(tx, actor, "API_KEY_REVOKED", "api-key", id); });
    refresh(); return { message: "API key revoked." };
  });
}

export async function credentialAction(action: "save" | "delete", input: unknown) {
  return runAdminAction("integrations:manage", async (actor) => {
    await recent(actor);
    if (action === "save") {
      const value = z.object({ label: z.string().trim().min(1).max(80), service: z.string().trim().min(1).max(80), endpoint: z.union([z.literal(""), z.string().url().max(500)]), secret: z.string().min(1).max(4000) }).parse(input);
      const id = randomUUID();
      await prisma.$transaction(async (tx) => { await tx.customCredential.create({ data: { id, label: value.label, service: value.service, endpoint: value.endpoint || null, ...sealCredentialSecret(id, value.secret), createdById: actor.id } }); await recordAudit(tx, actor, "CUSTOM_CREDENTIAL_SAVED", "credential", id); });
    } else if (action === "delete") {
      const { id } = z.object({ id: z.string().uuid() }).parse(input);
      await prisma.$transaction(async (tx) => { await tx.customCredential.delete({ where: { id } }); await recordAudit(tx, actor, "CUSTOM_CREDENTIAL_DELETED", "credential", id); });
    } else throw new AdminError("VALIDATION", "Unknown action.");
    refresh(); return { message: "Credentials updated." };
  });
}

export async function saveDeliveryAction(input: unknown) {
  return runAdminAction("settings:write", async (actor) => {
    const value = z.object({ id: z.string().uuid().optional(), code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,30}$/), name: z.string().trim().min(1).max(80), description: z.string().max(300), price: z.coerce.number().int().min(0).max(100000000), currency: z.enum(["INR", "CAD", "USD"]), enabled: z.boolean(), estimatedMinDays: z.coerce.number().int().min(1).max(365), estimatedMaxDays: z.coerce.number().int().min(1).max(365) }).refine((v) => v.estimatedMaxDays >= v.estimatedMinDays, "Maximum days must be at least minimum days.").parse(input);
    const { id, ...data } = value;
    await prisma.$transaction(async (tx) => { const record = id ? await tx.deliveryMethod.update({ where: { id }, data }) : await tx.deliveryMethod.create({ data }); await recordAudit(tx, actor, "DELIVERY_METHOD_SAVED", "delivery", record.id); });
    invalidateStorefront({ tags: ["settings", "delivery"], paths: ["/checkout", "/admin/settings/shipping"] });
    return null;
  }, "Delivery method saved.");
}
