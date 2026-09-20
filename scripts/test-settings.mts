import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("/clothin_settings_qa")) throw new Error("Run through scripts/with-settings-qa.cjs");
process.env.SETTINGS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
const { prisma } = await import("@/lib/db/prisma");
const settings = await import("@/lib/settings/settingsService");
const actions = await import("@/lib/admin/actions/settings");
const integrations = await import("@/lib/admin/actions/integrations");
const { encryptSecret, decryptSecret } = await import("@/lib/settings/encryption");
const { issueSessionToken, setSessionTokenSourceForTesting } = await import("@/lib/admin/session");
const { setInvalidationRecorderForTesting } = await import("@/lib/admin/revalidate");
const { hashPassword } = await import("@/lib/admin/password");
const { verifyStoreApiKey } = await import("@/lib/settings/apiKeys");
const { previewToken, validPreviewToken } = await import("@/lib/settings/storeAccess");
const { assertSafeOutboundUrl } = await import("@/lib/webhooks/urlSafety");
const { openWebhookSecret } = await import("@/lib/settings/secretRecords");
const { signPayload } = await import("@/lib/webhooks/dispatcher");
const { razorpayCredentials } = await import("@/lib/payments/provider");
const { computeTax } = await import("@/lib/domain/tax");
const { buildCheckoutSchema } = await import("@/lib/checkout/rules");
const tag = randomUUID();
const ids: string[] = [];
const tokens: Record<string, string> = {};
let token = "";
const invalidations: unknown[] = [];
const secret = `settings-test-${randomBytes(24).toString("hex")}`;
before(async () => {
  for (const role of ["ADMIN", "MANAGER", "STAFF"] as const) {
    const user = await prisma.adminUser.create({ data: { email: `${role}-${tag}@test.local`, name: role, role, passwordHash: await hashPassword("settings-test-password") } });
    ids.push(user.id); tokens[role] = await issueSessionToken(user.id);
  }
  token = tokens.ADMIN;
  setSessionTokenSourceForTesting(async () => token);
  setInvalidationRecorderForTesting((value) => invalidations.push(value));
});
after(async () => {
  await prisma.systemSetting.deleteMany({ where: { updatedById: { in: ids } } });
  await prisma.settingChange.deleteMany({ where: { adminId: { in: ids } } });
  await prisma.apiKey.deleteMany({ where: { createdById: { in: ids } } });
  await prisma.webhookEndpoint.deleteMany({ where: { createdById: { in: ids } } });
  await prisma.customCredential.deleteMany({ where: { createdById: { in: ids } } });
  await prisma.adminAuditLog.deleteMany({ where: { adminId: { in: ids } } });
  await prisma.adminUser.deleteMany({ where: { id: { in: ids } } });
  setSessionTokenSourceForTesting(null); setInvalidationRecorderForTesting(null);
  await prisma.$disconnect();
});
test("encryption is randomized, authenticated and bound to its slot", () => {
  const a = encryptSecret(secret, "slot-a"), b = encryptSecret(secret, "slot-a");
  assert.notEqual(a.ciphertext, b.ciphertext);
  assert.equal(decryptSecret(a, "slot-a"), secret);
  assert.throws(() => decryptSecret(a, "slot-b"));
  assert.throws(() => decryptSecret({ ...a, authTag: randomBytes(16).toString("base64") }, "slot-a"));
});
test("settings save, history and invalidation; encrypted values never leak into public, export or audit", async () => {
  assert.equal((await actions.saveSettingsAction("general", { values: { storeName: "QA Store" } })).ok, true);
  assert.equal((await settings.getSettingsFresh("general")).storeName, "QA Store");
  const result = await actions.saveSettingsAction("payments.razorpay", { values: { testKeyId: "rzp_test_settingsQA" }, secrets: { testKeySecret: secret } });
  assert.equal(result.ok, true, JSON.stringify(result));
  const row = await prisma.systemSetting.findUniqueOrThrow({ where: { namespace_key: { namespace: "payments.razorpay", key: "testKeySecret" } } });
  assert.equal(row.value, null); assert.equal(row.encrypted, true); assert.notEqual(row.ciphertext, secret);
  assert.equal(await settings.getSecret("payments.razorpay", "testKeySecret"), secret);
  assert.equal((await settings.getSecretStatuses("payments.razorpay")).testKeySecret.configured, true);
  const serialized = JSON.stringify([await settings.getPublicSettings(), await settings.exportSettings(), await settings.getSettingsHistory(), await prisma.adminAuditLog.findMany({ where: { adminId: { in: ids } } })]);
  assert.ok(!serialized.includes(secret)); assert.ok(!JSON.stringify(await settings.exportSettings()).includes("rzp_test_settingsQA"));
  assert.ok(invalidations.length > 0);
});
test("live credentials never borrow a stored test secret", async () => {
  assert.equal((await razorpayCredentials("test"))?.keySecret, secret);
  const previous = process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_ID;
  assert.equal(await razorpayCredentials("live"), null); process.env.RAZORPAY_KEY_ID = previous ?? "";
  const result = await actions.saveSettingsAction("payments.razorpay", { values: { mode: "live" }, confirmed: true });
  assert.equal(result.ok, false);
});
test("roles, stale step-up and deactivated users cannot change credentials", async () => {
  token = tokens.MANAGER;
  assert.equal((await actions.saveSettingsAction("general", { values: { storeName: "Manager Store" } })).ok, true);
  assert.equal((await actions.saveSettingsAction("payments.razorpay", { secrets: { testKeySecret: "forbidden" } })).ok, false);
  assert.equal((await actions.saveSettingsAction("ar", { secrets: { providerApiKey: "forbidden" } })).ok, false);
  token = tokens.STAFF; assert.equal((await actions.saveSettingsAction("general", { values: { storeName: "Forbidden" } })).ok, false);
  token = await issueSessionToken(ids[0], { stepUpAt: new Date(0) });
  const stale = await actions.saveSettingsAction("payments.razorpay", { secrets: { testKeySecret: "forbidden" } });
  assert.equal(!stale.ok && stale.code, "REAUTH_REQUIRED");
  assert.equal((await actions.confirmPasswordAction("wrong")).ok, false);
  assert.equal((await actions.confirmPasswordAction("settings-test-password")).ok, true);
  await prisma.adminUser.update({ where: { id: ids[0] }, data: { active: false } });
  assert.equal((await actions.saveSettingsAction("general", { values: { storeName: "Forbidden" } })).ok, false);
  await prisma.adminUser.update({ where: { id: ids[0] }, data: { active: true } }); token = tokens.ADMIN;
});
test("invalid imports do not partially apply and dry runs make no writes", async () => {
  const original = (await settings.getSettingsFresh("general")).storeName;
  const actor = { id: ids[0], name: "ADMIN", email: "test@test.local", role: "ADMIN" as const };
  const file = { format: "clothin-settings", version: 1, settings: { general: { storeName: "Imported" }, localization: { defaultCurrency: "USD", supportedCurrencies: ["INR"] } } };
  const result = await settings.importSettings(actor, file);
  assert.equal(result.applied, false); assert.equal((await settings.getSettingsFresh("general")).storeName, original);
  file.settings.localization.supportedCurrencies = ["USD"];
  assert.equal((await settings.importSettings(actor, file, { dryRun: true })).applied, false);
  assert.equal((await settings.getSettingsFresh("general")).storeName, original);
  assert.equal((await settings.importSettings(actor, file)).applied, true);
});
test("API keys are hashed, scoped and invalidated by rotation or revocation", async () => {
  const result = await integrations.apiKeyAction("create", { name: tag, permissions: ["READ_PRODUCTS"] });
  assert.ok(result.ok && "secret" in result.data); if (!result.ok || !("secret" in result.data)) return;
  const plain = result.data.secret!;
  const row = await prisma.apiKey.findFirstOrThrow({ where: { name: tag } });
  assert.ok(!JSON.stringify(row).includes(plain)); assert.equal(await verifyStoreApiKey(plain, "READ_PRODUCTS"), true);
  assert.equal(await verifyStoreApiKey(plain, "WRITE_PRODUCTS"), false);
  const rotated = await integrations.apiKeyAction("rotate", { id: row.id });
  assert.ok(rotated.ok && "secret" in rotated.data); assert.equal(await verifyStoreApiKey(plain, "READ_PRODUCTS"), false);
  const latest = await prisma.apiKey.findFirstOrThrow({ where: { name: tag, revokedAt: null } });
  assert.equal((await integrations.apiKeyAction("revoke", { id: latest.id })).ok, true);
  if (rotated.ok && "secret" in rotated.data) assert.equal(await verifyStoreApiKey(rotated.data.secret!, "READ_PRODUCTS"), false);
});
test("webhook secrets encrypt, rotate, sign real local delivery and log only metadata", async () => {
  let received = "", signature = "";
  const server = createServer(async (request, response) => { for await (const chunk of request) received += chunk; signature = String(request.headers["x-clothin-signature"]); response.writeHead(204).end(); });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address !== "string");
    const created = await integrations.webhookAction("create", { name: tag, url: `http://127.0.0.1:${address.port}`, events: ["ORDER_CREATED"], enabled: true });
    assert.ok(created.ok, JSON.stringify(created));
    let row = await prisma.webhookEndpoint.findFirstOrThrow({ where: { name: tag } });
    const old = openWebhookSecret(row);
    assert.ok(!JSON.stringify(row).includes(old));
    assert.equal((await integrations.webhookAction("rotate", { id: row.id })).ok, true);
    row = await prisma.webhookEndpoint.findUniqueOrThrow({ where: { id: row.id } });
    assert.notEqual(openWebhookSecret(row), old);
    assert.equal((await integrations.webhookAction("test", { id: row.id })).ok, true);
    const [timestamp, digest] = signature.split(",");
    assert.equal(digest, `v1=${signPayload(openWebhookSecret(row), Number(timestamp.slice(2)), received)}`);
    const log = await prisma.webhookDelivery.findFirstOrThrow({ where: { endpointId: row.id } });
    assert.equal(log.status, "SUCCEEDED"); assert.ok(!JSON.stringify(log).includes(old));
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  await assert.rejects(assertSafeOutboundUrl("https://169.254.169.254/latest/meta-data"));
  await assert.rejects(assertSafeOutboundUrl("https://10.0.0.1"));
});
test("store preview tokens cannot survive password rotation", () => {
  const token = previewToken("hash-one"); assert.equal(validPreviewToken(token, "hash-one"), true);
  assert.equal(validPreviewToken(token, "hash-two"), false); assert.equal(validPreviewToken(`${token}x`, "hash-one"), false);
});
test("tax uses basis points and checkout enforces phone, country and terms", () => {
  const tax = computeTax({ enabled: true, pricesIncludeTax: false, label: "Tax", defaultRate: 1800, rules: [] }, { amount: 10000, country: "IN", region: "Delhi" });
  assert.ok(JSON.stringify(tax).includes("1800"));
  const schema = buildCheckoutSchema({ phoneRequired: true, requireTerms: true, allowedCountries: ["IN"] });
  const result = schema.safeParse({ contact: { email: "test@example.com", phone: "" }, shippingAddress: { firstName: "A", lastName: "B", address1: "123 Test", address2: "", city: "Delhi", region: "Delhi", postalCode: "110001", country: "CA", phone: "" }, deliveryMethodId: "standard" });
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.error.issues.some((issue) => issue.path[0] === "acceptTerms"));
});

test("connection probes use saved credentials and suppress provider error bodies", async () => {
  const { testIntegration } = await import("@/lib/settings/integrations");
  const emailKey = `re_${randomBytes(16).toString("hex")}`;
  assert.equal((await actions.saveSettingsAction("email.resend", { secrets: { apiKey: emailKey } })).ok, true);
  assert.equal((await actions.saveSettingsAction("email", { values: { provider: "resend", fromEmail: "sender@example.test" }, confirmed: true })).ok, true);
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input); requests.push(url);
    if (url === "https://api.resend.com/emails") { assert.equal(new Headers(init?.headers).get("authorization"), `Bearer ${emailKey}`); return Response.json({ id: "mock-email" }); }
    if (url.startsWith("https://api.razorpay.com/")) return Response.json({ items: [] });
    throw new Error("Unexpected external request");
  }) as typeof fetch;
  try {
    assert.equal((await testIntegration("email", "recipient@example.test")).ok, true);
    assert.equal((await testIntegration("payments.razorpay")).ok, true);
    globalThis.fetch = (async () => Response.json({ message: emailKey }, { status: 401 })) as typeof fetch;
    const failure = await testIntegration("email", "recipient@example.test");
    assert.equal(failure.ok, false); assert.ok(!JSON.stringify(failure).includes(emailKey));
    assert.equal(requests.length, 2);
  } finally { globalThis.fetch = originalFetch; }
  const { mkdtemp, rm } = await import("node:fs/promises");
  const directory = await mkdtemp("/tmp/clothin-settings-storage-");
  const oldDir = process.env.STORAGE_LOCAL_DIR; process.env.STORAGE_LOCAL_DIR = directory;
  try { assert.equal((await testIntegration("storage.local")).ok, true); }
  finally { process.env.STORAGE_LOCAL_DIR = oldDir ?? ""; await rm(directory, { recursive: true, force: true }); }
});

test("native newsletter subscriptions persist once and provider failures are not reported as success", async () => {
  const { subscribeNewsletter } = await import("@/lib/services/newsletterService");
  const email = `${tag}@example.test`;
  try {
    await subscribeNewsletter(email); await subscribeNewsletter(email);
    assert.equal(await prisma.newsletterSubscriber.count({ where: { email } }), 1);
    assert.equal((await actions.saveSettingsAction("marketing", { values: { provider: "brevo" }, confirmed: true })).ok, true);
    await assert.rejects(subscribeNewsletter(`external-${email}`));
    assert.equal(await prisma.newsletterSubscriber.count({ where: { email: `external-${email}` } }), 0);
  } finally { await prisma.newsletterSubscriber.deleteMany({ where: { email } }); }
});

test("shipping respects zones, disabled methods and the exact free-shipping threshold", async () => {
  const { methodsFor } = await import("@/lib/domain/shipping");
  const policy = { zones: [{ id: "india", name: "India", enabled: true, countries: ["IN"], regions: [], methods: [{ code: "EXPRESS", enabled: true, rate: 45000 }] }], methods: [{ code: "EXPRESS", name: "Express", description: "", price: 50000, currency: "INR", minDays: 1, maxDays: 3 }], freeShipping: { enabled: true, threshold: 399900, methods: ["EXPRESS"] }, country: "IN", currency: "INR" };
  assert.equal(methodsFor({ ...policy, subtotal: 399899 })[0].rate, 45000);
  assert.equal(methodsFor({ ...policy, subtotal: 399900 })[0].rate, 0);
  assert.deepEqual(methodsFor({ ...policy, country: "CA", subtotal: 500000 }), []);
  policy.zones[0].methods[0].enabled = false;
  assert.deepEqual(methodsFor({ ...policy, subtotal: 500000 }), []);
});
