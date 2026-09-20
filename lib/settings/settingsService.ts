import "server-only";
import { Prisma, type SettingValueType } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { can, requireRecentAuthentication, type AdminActor } from "@/lib/admin/authorization";
import { recordAudit } from "@/lib/admin/audit";
import { AdminError } from "@/lib/admin/errors";
import { invalidateStorefront } from "@/lib/admin/revalidate";
import { prisma } from "@/lib/db/prisma";
import { decryptSecret, encryptSecret, EncryptionUnavailableError, isEncryptionConfigured, secretHint } from "./encryption";
import { bpsToPercent, minorToDecimal, secretValueSchema, type FieldDef } from "./fields";
import { getNamespace, NAMESPACE_IDS, NAMESPACES, namespaceDefaults, type NamespaceId, type SecretKeyOf, type SettingsOf } from "./registry";

/**
 * Typed access to store settings. Components ask `getSettings("payments.razorpay")`
 * instead of touching rows. Non-secret values are cached (tag `settings:<ns>`);
 * secrets are decrypted on demand, never cached and never returned to the client.
 */

const aad = (namespace: string, key: string) => `setting:${namespace}:${key}`;
const nextCacheAvailable = () => Boolean(process.env.NEXT_RUNTIME);
const fieldsOf = (id: string) => (getNamespace(id)?.fields ?? []) as readonly FieldDef[];

function valueTypeOf(field: FieldDef): SettingValueType {
  if (field.type === "secret") return "SECRET";
  if (field.type === "switch") return "BOOLEAN";
  if (field.type === "number" || field.type === "money" || field.type === "percent") return "NUMBER";
  if (field.type === "multiselect" || field.type === "list" || field.type === "rows") return "JSON";
  return "STRING";
}

/** Non-secret values from the database, validated field by field; bad or missing values fall back to defaults. */
async function readNamespace<N extends NamespaceId>(id: N, strict = false): Promise<SettingsOf<N>> {
  const values = namespaceDefaults(id) as Record<string, unknown>;
  let rows: { key: string; value: Prisma.JsonValue }[] = [];
  try {
    rows = await prisma.systemSetting.findMany({ where: { namespace: id, isSecret: false }, select: { key: true, value: true } });
  } catch (error) {
    if (strict || process.env.NODE_ENV === "production") throw error;
    console.warn(`[settings] Database unavailable; using defaults for "${id}".`);
  }
  for (const field of fieldsOf(id)) {
    if (field.type === "secret") continue;
    const row = rows.find((candidate) => candidate.key === field.key);
    if (!row) continue;
    const parsed = field.schema.safeParse(row.value);
    if (parsed.success) values[field.key] = parsed.data;
    else console.warn(`[settings] Stored ${id}.${field.key} is invalid; using the default.`);
  }
  return values as SettingsOf<N>;
}

const cachedReaders = new Map<string, () => Promise<unknown>>();

/** Server-side read of one namespace (non-secret values only). */
export function getSettings<N extends NamespaceId>(id: N): Promise<SettingsOf<N>> {
  if (!nextCacheAvailable()) return readNamespace(id);
  let reader = cachedReaders.get(id);
  if (!reader) {
    reader = unstable_cache(() => readNamespace(id), ["settings", id], { revalidate: 300, tags: ["settings", `settings:${id}`] });
    cachedReaders.set(id, reader);
  }
  return reader() as Promise<SettingsOf<N>>;
}

/** Always-fresh read (for admin forms and security decisions). */
export const getSettingsFresh = <N extends NamespaceId>(id: N) => readNamespace(id, true);

/**
 * Decrypts one secret for server-side use (e.g. calling a provider). Never
 * cached, never logged, never sent to the browser.
 */
export async function getSecret<N extends NamespaceId>(id: N, key: SecretKeyOf<N>): Promise<string | null> {
  const row = await prisma.systemSetting.findUnique({ where: { namespace_key: { namespace: id, key } } });
  if (!row?.isSecret || !row.encrypted || !row.ciphertext || !row.iv || !row.authTag || !row.keyId) return null;
  try {
    return decryptSecret({ ciphertext: row.ciphertext, iv: row.iv, authTag: row.authTag, keyId: row.keyId }, aad(id, key));
  } catch (error) {
    console.error(`[settings] Could not decrypt ${id}.${key}: ${error instanceof Error ? error.name : "error"}`);
    return null;
  }
}

export interface SecretStatus {
  configured: boolean;
  hint: string | null;
  updatedAt: string | null;
}

/** What the admin may see about secrets: whether one is set and its last characters. */
export async function getSecretStatuses(id: NamespaceId): Promise<Record<string, SecretStatus>> {
  const secretKeys = fieldsOf(id).filter((field) => field.type === "secret").map((field) => field.key);
  if (!secretKeys.length) return {};
  const rows = await prisma.systemSetting.findMany({ where: { namespace: id, key: { in: secretKeys }, isSecret: true }, select: { key: true, secretHint: true, updatedAt: true, ciphertext: true } });
  return Object.fromEntries(secretKeys.map((key) => {
    const row = rows.find((candidate) => candidate.key === key);
    return [key, { configured: Boolean(row?.ciphertext), hint: row?.secretHint ?? null, updatedAt: row?.updatedAt.toISOString() ?? null }];
  }));
}

// ---------- public projection ----------

export type PublicSettings = { [N in NamespaceId]?: Partial<SettingsOf<N>> };

async function buildPublicSettings(): Promise<PublicSettings> {
  const out: Record<string, Record<string, unknown>> = {};
  await Promise.all(NAMESPACE_IDS.map(async (id) => {
    const publicFields = fieldsOf(id).filter((field) => field.public && field.type !== "secret");
    if (!publicFields.length) return;
    const values = (await getSettings(id)) as Record<string, unknown>;
    out[id] = Object.fromEntries(publicFields.map((field) => [field.key, values[field.key]]));
  }));
  return out as PublicSettings;
}

const cachedPublic = unstable_cache(buildPublicSettings, ["settings-public"], { revalidate: 300, tags: ["settings"] });

/**
 * The only settings object that may be serialized to the browser. Built from
 * fields explicitly marked public in the registry; secrets are never included.
 */
export const getPublicSettings = (): Promise<PublicSettings> => (nextCacheAvailable() ? cachedPublic() : buildPublicSettings());

// ---------- writes ----------

interface UpdateInput {
  values?: unknown;
  /** New secret values; null removes (disconnects) the secret. Omitted keys are unchanged. */
  secrets?: Record<string, string | null>;
}

type Guard = (next: Record<string, unknown>, context: { secrets: Record<string, SecretStatus>; pending: Record<string, string | null> }) => Promise<void> | void;

const secretSet = (key: string, context: Parameters<Guard>[1]) => (key in context.pending ? context.pending[key] !== null : context.secrets[key]?.configured === true);

/** Cross-namespace safety rules that need the database (e.g. no live mode without live keys). */
const GUARDS: Partial<Record<NamespaceId, Guard>> = {
  "payments.razorpay": (next, context) => {
    if (next.mode === "live" && (!next.liveKeyId || !secretSet("liveKeySecret", context))) throw new AdminError("VALIDATION", "Add the live key ID and live key secret before switching to live mode.", "mode");
  },
  "payments.stripe": (next, context) => {
    if (next.mode === "live" && (!next.livePublishableKey || !secretSet("liveSecretKey", context))) throw new AdminError("VALIDATION", "Add live Stripe keys before switching to live mode.", "mode");
  },
  "payments.paypal": (next, context) => {
    if (next.mode === "live" && (!next.liveClientId || !secretSet("liveClientSecret", context))) throw new AdminError("VALIDATION", "Add live PayPal credentials before switching to live mode.", "mode");
  },
  storage: async (next) => {
    const driver = next.driver as string;
    if (driver === "local") return;
    const { storageReadiness } = await import("@/lib/storage");
    const ready = await storageReadiness(driver as "s3" | "r2" | "cloudinary");
    if (!ready.ok) throw new AdminError("VALIDATION", `${ready.reason} Save and test the provider before switching uploads to it.`, "driver");
  },
  status: async (next) => {
    if (!next.passwordEnabled) return;
    const row = await prisma.systemSetting.findUnique({ where: { namespace_key: { namespace: "status", key: "passwordHash" } } });
    if (!row) throw new AdminError("VALIDATION", "Set a store password before turning password protection on.", "passwordEnabled");
  },
};

const display = (field: FieldDef, value: unknown) =>
  /key|token|clientId|password|username/i.test(field.key) ? (value ? "[configured]" : "[empty]") : field.type === "money" && typeof value === "number" ? minorToDecimal(value) : field.type === "percent" && typeof value === "number" ? `${bpsToPercent(value)}%` : value;

/**
 * Saves one namespace. Validates every field server-side, enforces the
 * namespace permission, requires a recent password confirmation for secrets and
 * sensitive fields, records history (values for normal settings, only the
 * action for secrets) and an audit event, then expires caches.
 */
export async function updateSettings(actor: AdminActor, id: string, input: UpdateInput, transaction?: Prisma.TransactionClient) {
  const def = getNamespace(id);
  if (!def) throw new AdminError("VALIDATION", "Unknown settings section.");
  if (!can(actor, def.permission)) throw new AdminError("FORBIDDEN", "Your role can’t change these settings.");
  const namespace = id as NamespaceId;
  const fields = def.fields as readonly FieldDef[];
  const current = (await readNamespace(namespace)) as Record<string, unknown>;

  // 1. Validate submitted non-secret values (unknown keys are ignored).
  const submitted = z.record(z.unknown()).catch({}).parse(input.values ?? {});
  const next: Record<string, unknown> = { ...current };
  const fieldErrors: Record<string, string> = {};
  for (const field of fields) {
    if (field.type === "secret" || field.readOnly || !(field.key in submitted)) continue;
    const parsed = field.schema.safeParse(submitted[field.key]);
    if (parsed.success) next[field.key] = parsed.data;
    else fieldErrors[field.key] = parsed.error.issues[0]?.message ?? "Invalid value";
  }
  // 2. Validate secret changes.
  const pending: Record<string, string | null> = {};
  for (const [key, raw] of Object.entries(input.secrets ?? {})) {
    const field = fields.find((candidate) => candidate.key === key && candidate.type === "secret");
    if (!field) continue;
    if (raw === null) { pending[key] = null; continue; }
    const parsed = secretValueSchema.safeParse(raw);
    if (!parsed.success) { fieldErrors[key] = parsed.error.issues[0].message; continue; }
    if (field.secretFormat && !field.secretFormat.pattern.test(parsed.data)) { fieldErrors[key] = field.secretFormat.message; continue; }
    pending[key] = parsed.data;
  }
  if (Object.keys(fieldErrors).length) throw Object.assign(new AdminError("VALIDATION", "Check the highlighted fields."), { fieldErrors });
  const crossField = def.refine?.(next);
  if (crossField) throw Object.assign(new AdminError("VALIDATION", Object.values(crossField)[0]), { fieldErrors: crossField });

  const changed = fields.filter((field) => field.type !== "secret" && JSON.stringify(next[field.key]) !== JSON.stringify(current[field.key]));
  const secretChanges = Object.keys(pending);
  if (!changed.length && !secretChanges.length) return { changed: [] as string[], secretsChanged: [] as string[] };

  // 3. Security: step-up for secrets and sensitive fields; encryption must be available for new secrets.
  if (secretChanges.length && !can(actor, "integrations:manage")) throw new AdminError("FORBIDDEN", "Only administrators can manage credentials.");
  if (secretChanges.length || changed.some((field) => field.sensitive) || def.permission === "integrations:manage" || def.permission === "security:manage") {
    const { stepUpMinutes } = await readNamespace("security");
    requireRecentAuthentication(actor, stepUpMinutes);
  }
  if (Object.values(pending).some((value) => value !== null) && !isEncryptionConfigured()) {
    throw new AdminError("CONFIGURATION", "Secrets can’t be saved: SETTINGS_ENCRYPTION_KEY is not configured on the server.");
  }
  const statuses = await getSecretStatuses(namespace);
  await GUARDS[namespace]?.(next, { secrets: statuses, pending });

  // 4. Persist, with history and audit, in one transaction.
  const persist = async (tx: Prisma.TransactionClient) => {
    for (const field of changed) {
      const value = next[field.key] as Prisma.InputJsonValue;
      await tx.systemSetting.upsert({
        where: { namespace_key: { namespace, key: field.key } },
        update: { value, valueType: valueTypeOf(field), updatedById: actor.id },
        create: { namespace, key: field.key, value, valueType: valueTypeOf(field), description: field.label, updatedById: actor.id },
      });
      await tx.settingChange.create({ data: { namespace, key: field.key, action: "UPDATED", previousValue: display(field, current[field.key]) as Prisma.InputJsonValue, newValue: display(field, next[field.key]) as Prisma.InputJsonValue, adminId: actor.id } });
    }
    for (const [key, secret] of Object.entries(pending)) {
      const field = fields.find((candidate) => candidate.key === key)!;
      if (secret === null) {
        await tx.systemSetting.deleteMany({ where: { namespace, key, isSecret: true } });
      } else {
        const encrypted = encryptSecret(secret, aad(namespace, key));
        const data = { value: Prisma.DbNull, valueType: "SECRET" as const, isSecret: true, encrypted: true, ciphertext: encrypted.ciphertext, iv: encrypted.iv, authTag: encrypted.authTag, keyId: encrypted.keyId, encryptionVersion: encrypted.version, secretHint: secretHint(secret), updatedById: actor.id };
        await tx.systemSetting.upsert({ where: { namespace_key: { namespace, key } }, update: data, create: { namespace, key, description: field.label, ...data } });
      }
      await tx.settingChange.create({ data: { namespace, key, action: secret === null ? "SECRET_REMOVED" : "SECRET_UPDATED", adminId: actor.id } });
    }
    await recordAudit(tx, actor, def.auditAction as never, "settings", namespace, {
      changed: changed.map((field) => field.key),
      ...(secretChanges.length ? { secrets: secretChanges.map((key) => `${key}:${pending[key] === null ? "removed" : "updated"}`) } : {}),
    });
  };
  if (transaction) await persist(transaction);
  else await prisma.$transaction(persist);

  await (transaction ?? prisma).integrationHealth.updateMany({ where: { OR: [{ id: namespace }, { id: namespace.split(".")[0] }] }, data: { status: "UNVERIFIED", lastError: null } });
  if (!transaction) invalidateSettings(namespace);
  return { changed: changed.map((field) => field.key), secretsChanged: secretChanges };
}

/** Expires cached settings (and the storefront when the namespace affects it). */
export function invalidateSettings(id: NamespaceId) {
  const def = NAMESPACES[id];
  invalidateStorefront({ tags: ["settings", `settings:${id}`], layouts: "affectsStorefront" in def && def.affectsStorefront ? ["/"] : [] });
}

// ---------- private singletons stored alongside settings ----------

/** Stores a non-reversible value (e.g. the storefront password hash) as a private setting. */
export async function setPrivateValue(actor: AdminActor, namespace: string, key: string, value: string | null, auditAction: string) {
  await prisma.$transaction(async (tx) => {
    if (value === null) await tx.systemSetting.deleteMany({ where: { namespace, key } });
    else await tx.systemSetting.upsert({ where: { namespace_key: { namespace, key } }, update: { value, isSecret: true, valueType: "SECRET", updatedById: actor.id }, create: { namespace, key, value, isSecret: true, valueType: "SECRET", updatedById: actor.id } });
    await tx.settingChange.create({ data: { namespace, key, action: value === null ? "SECRET_REMOVED" : "SECRET_UPDATED", adminId: actor.id } });
    await recordAudit(tx, actor, auditAction as never, "settings", `${namespace}.${key}`, { action: value === null ? "removed" : "updated" });
  });
}

export async function getPrivateValue(namespace: string, key: string) {
  const row = await prisma.systemSetting.findUnique({ where: { namespace_key: { namespace, key } } });
  return typeof row?.value === "string" ? row.value : null;
}

// ---------- history, export, import ----------

export async function getSettingsHistory(options: { namespace?: string; take?: number } = {}) {
  const rows = await prisma.settingChange.findMany({
    where: options.namespace ? { namespace: { startsWith: options.namespace } } : {},
    orderBy: { createdAt: "desc" },
    take: options.take ?? 20,
  });
  const admins = await prisma.adminUser.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.adminId).filter(Boolean) as string[])] } }, select: { id: true, name: true } });
  return rows.map((row) => ({
    id: row.id,
    namespace: row.namespace,
    key: row.key,
    label: fieldsOf(row.namespace).find((field) => field.key === row.key)?.label ?? row.key,
    action: row.action,
    previous: row.previousValue,
    next: row.newValue,
    by: admins.find((admin) => admin.id === row.adminId)?.name ?? "System",
    at: row.createdAt.toISOString(),
  }));
}

/** Non-secret configuration as JSON. Secrets, hashes and credentials are never exported. */
export async function exportSettings() {
  const settings: Record<string, unknown> = {};
  for (const id of NAMESPACE_IDS) {
    if (NAMESPACES[id].permission === "integrations:manage") continue;
    settings[id] = await readNamespace(id);
  }
  return { format: "clothin-settings", version: 1, exportedAt: new Date().toISOString(), settings };
}

const importSchema = z.object({ format: z.literal("clothin-settings"), version: z.literal(1), settings: z.record(z.record(z.unknown())) });

/**
 * Validates an export file against every namespace schema before applying
 * anything; then saves each namespace through the normal (audited) path.
 */
export async function importSettings(actor: AdminActor, file: unknown, options: { dryRun?: boolean } = {}) {
  const parsed = importSchema.safeParse(file);
  if (!parsed.success) throw new AdminError("VALIDATION", "This isn’t a settings export file.");
  const problems: string[] = [];
  const plan: { id: NamespaceId; values: Record<string, unknown>; changes: number }[] = [];
  for (const [id, values] of Object.entries(parsed.data.settings)) {
    const def = getNamespace(id);
    if (!def) { problems.push(`Unknown section “${id}” skipped.`); continue; }
    if (!can(actor, def.permission)) { problems.push(`${def.title}: your role can’t change this section.`); continue; }
    const current = (await readNamespace(id as NamespaceId)) as Record<string, unknown>;
    let changes = 0;
    const next = { ...current };
    for (const field of def.fields as readonly FieldDef[]) {
      if (field.type === "secret" || field.readOnly || !(field.key in values)) continue;
      const result = field.schema.safeParse(values[field.key]);
      if (!result.success) problems.push(`${def.title} → ${field.label}: ${result.error.issues[0]?.message}`);
      else { next[field.key] = result.data; if (JSON.stringify(result.data) !== JSON.stringify(current[field.key])) changes += 1; }
    }
    const crossField = def.refine?.(next);
    if (crossField) problems.push(`${def.title}: ${Object.values(crossField).join("; ")}`);
    if (changes) {
      try {
        requireRecentAuthentication(actor, (await readNamespace("security")).stepUpMinutes);
        await GUARDS[id as NamespaceId]?.(next, { secrets: await getSecretStatuses(id as NamespaceId), pending: {} });
      } catch (error) { problems.push(`${def.title}: ${error instanceof AdminError ? error.message : "Configuration validation failed."}`); }
    }
    if (changes) plan.push({ id: id as NamespaceId, values, changes });
  }
  if (problems.length) return { applied: false, problems, plan: plan.map(({ id, changes }) => ({ id, changes })) };
  if (!options.dryRun) {
    await prisma.$transaction(async (tx) => {
      for (const item of plan) await updateSettings(actor, item.id, { values: item.values }, tx);
    }, { timeout: 30000 });
    for (const item of plan) invalidateSettings(item.id);
  }
  return { applied: !options.dryRun, problems, plan: plan.map(({ id, changes }) => ({ id, changes })) };
}

/** Re-encrypts every stored secret with the current key (after rotating SETTINGS_ENCRYPTION_KEY). */
export async function reencryptAllSecrets(actor: AdminActor) {
  if (!isEncryptionConfigured()) throw new EncryptionUnavailableError();
  const { currentKeyId } = await import("./encryption");
  const target = currentKeyId();
  let rotated = 0;
  const rows = await prisma.systemSetting.findMany({ where: { encrypted: true, keyId: { not: target } } });
  for (const row of rows) {
    const plain = decryptSecret({ ciphertext: row.ciphertext!, iv: row.iv!, authTag: row.authTag!, keyId: row.keyId! }, aad(row.namespace, row.key));
    const next = encryptSecret(plain, aad(row.namespace, row.key));
    await prisma.systemSetting.update({ where: { id: row.id }, data: { ciphertext: next.ciphertext, iv: next.iv, authTag: next.authTag, keyId: next.keyId, encryptionVersion: next.version } });
    rotated += 1;
  }
  const { reencryptWebhookAndCredentialSecrets } = await import("@/lib/settings/secretRecords");
  rotated += await reencryptWebhookAndCredentialSecrets(target!);
  await recordAudit(prisma, actor, "SECRETS_REENCRYPTED" as never, "settings", null, { rotated });
  return { rotated };
}
