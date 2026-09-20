/**
 * Admin dashboard server behaviour against the real database. Auth, actions,
 * services, audit and cache invalidation run for real; only the session cookie
 * (no HTTP request here) and Next's cache calls are substituted via test seams.
 * Run: npm run test:admin
 */
import assert from "node:assert/strict";
import { Prisma, type SystemSetting } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";

const uploadDir = await mkdtemp(path.join(os.tmpdir(), "clothin-admin-test-"));
process.env.STORAGE_LOCAL_DIR = uploadDir;

const { prisma } = await import("@/lib/db/prisma");
const { hashPassword, verifyPassword } = await import("@/lib/admin/password");
const { issueSessionToken, setSessionTokenSourceForTesting, findSessionByToken } = await import("@/lib/admin/session");
const { setInvalidationRecorderForTesting } = await import("@/lib/admin/revalidate");
const productActions = await import("@/lib/admin/actions/products");
const collectionActions = await import("@/lib/admin/actions/collections");
const inventoryActions = await import("@/lib/admin/actions/inventory");
const orderActions = await import("@/lib/admin/actions/orders");
const contentActions = await import("@/lib/admin/actions/content");
const { saveSettingsAction } = await import("@/lib/admin/actions/settings");
const { getSettingsFresh } = await import("@/lib/settings/settingsService");
const { readContent } = await import("@/lib/content/siteContent");
const { storeUpload, UploadError } = await import("@/lib/storage");
const { resolveLocalKey } = await import("@/lib/storage/local");
const { signS3Request } = await import("@/lib/storage/s3");
const { deleteIfUnreferenced } = await import("@/lib/admin/services/shared");
const { canTransitionOrder } = await import("@/lib/domain/orderStatus");

const tag = randomUUID().slice(0, 6);
const invalidations: { paths?: string[]; tags?: string[] }[] = [];
setInvalidationRecorderForTesting((target) => { invalidations.push(target); });

let adminToken = "";
let staffToken = "";
let currentToken: string | undefined;
setSessionTokenSourceForTesting(async () => currentToken);
const as = (who: "admin" | "staff" | "anonymous") => { currentToken = who === "admin" ? adminToken : who === "staff" ? staffToken : undefined; };

let savedInventory: SystemSetting | null = null;
let savedContent: { key: string; value: unknown }[] = [];
let savedFlags: { id: string; featured: boolean; enabled: boolean }[] = [];
const ids = { admin: "", staff: "", collection: "", color: "", sizes: [] as string[], products: [] as string[], orders: [] as string[], originalOrder: [] as string[] };
const productValues = (overrides: Record<string, unknown> = {}) => ({
  name: `Test Tee ${tag}`, slug: `test-tee-${tag}`, subtitle: "", description: "A test product.", details: "", collectionId: ids.collection,
  basePrice: "1999.50", currency: "INR", material: "Cotton", gsm: "240", fit: "Oversized", fitAdvice: "", fitNotes: "Boxy\nDropped shoulder", print: "", care: "Cold wash", model3dUrl: "", featured: false, enabled: true,
  ...overrides,
});
/** Counts only this run's audit rows, so existing history never skews results. */
const auditCount = (action: string, entityId?: string) => prisma.adminAuditLog.count({ where: { action, adminId: { in: [ids.admin, ids.staff] }, ...(entityId ? { entityId } : {}) } });

before(async () => {
  savedInventory = await prisma.systemSetting.findUnique({ where: { namespace_key: { namespace: "inventory", key: "lowStockThreshold" } } });
  savedContent = await prisma.siteContent.findMany({ where: { key: { in: ["hero", "settings"] } }, select: { key: true, value: true } });
  const [admin, staff] = await Promise.all([
    prisma.adminUser.create({ data: { email: `admin-${tag}@test.local`, name: "Test Admin", role: "ADMIN", passwordHash: await hashPassword("correct horse battery") } }),
    prisma.adminUser.create({ data: { email: `staff-${tag}@test.local`, name: "Test Staff", role: "STAFF", passwordHash: await hashPassword("staff password 123") } }),
  ]);
  ids.admin = admin.id;
  ids.staff = staff.id;
  adminToken = await issueSessionToken(admin.id);
  staffToken = await issueSessionToken(staff.id);
  const collections = await prisma.collection.findMany({ orderBy: { order: "asc" } });
  savedFlags = collections.map(({ id, featured, enabled }) => ({ id, featured, enabled }));
  ids.originalOrder = collections.map((collection) => collection.id);
  ids.collection = collections[0].id;
  ids.color = (await prisma.color.findFirstOrThrow()).id;
  ids.sizes = (await prisma.size.findMany({ orderBy: { order: "asc" }, take: 2 })).map((size) => size.id);
});

beforeEach(() => { invalidations.length = 0; as("admin"); });

after(async () => {
  setSessionTokenSourceForTesting(null);
  setInvalidationRecorderForTesting(null);
  await prisma.order.deleteMany({ where: { id: { in: ids.orders } } });
  await prisma.checkoutDraft.deleteMany({ where: { cart: { sessionId: { startsWith: `admin-test-${tag}` } } } });
  await prisma.cart.deleteMany({ where: { sessionId: { startsWith: `admin-test-${tag}` } } });
  await prisma.product.deleteMany({ where: { slug: { contains: tag } } });
  await prisma.collection.deleteMany({ where: { slug: { contains: tag } } });
  await prisma.color.deleteMany({ where: { slug: { contains: tag } } });
  for (const [index, id] of ids.originalOrder.entries()) await prisma.collection.update({ where: { id }, data: { order: index + 1 } });
  for (const flags of savedFlags) await prisma.collection.update({ where: { id: flags.id }, data: { featured: flags.featured, enabled: flags.enabled } });
  // Restore whatever content existed before the run (tests must not change real copy).
  await prisma.siteContent.deleteMany({ where: { key: { in: ["hero", "settings"] } } });
  for (const row of savedContent) await prisma.siteContent.create({ data: { key: row.key, value: row.value as object } });
  await prisma.systemSetting.deleteMany({ where: { namespace: "inventory", key: "lowStockThreshold", updatedById: { in: [ids.admin, ids.staff] } } });
  if (savedInventory) await prisma.systemSetting.upsert({ where: { namespace_key: { namespace: "inventory", key: "lowStockThreshold" } }, update: { ...savedInventory, value: savedInventory.value ?? Prisma.DbNull }, create: { ...savedInventory, value: savedInventory.value ?? Prisma.DbNull } });
  await prisma.settingChange.deleteMany({ where: { adminId: { in: [ids.admin, ids.staff] } } });
  await prisma.adminAuditLog.deleteMany({ where: { adminId: { in: [ids.admin, ids.staff] } } });
  await prisma.adminUser.deleteMany({ where: { id: { in: [ids.admin, ids.staff] } } });
  await rm(uploadDir, { recursive: true, force: true });
  await prisma.$disconnect();
});

describe("authentication and authorization", () => {
  test("passwords are scrypt-hashed and verified", async () => {
    const hash = await hashPassword("a long enough secret");
    assert.match(hash, /^scrypt\$32768\$8\$1\$/);
    assert.ok(!hash.includes("a long enough secret"));
    assert.equal(await verifyPassword("a long enough secret", hash), true);
    assert.equal(await verifyPassword("wrong", hash), false);
  });

  test("sign-in throttling counts failed attempts only", async () => {
    const { isRateLimited, recordAttempt, clearRateLimit } = await import("@/lib/http/rateLimit");
    const key = `admin-login:${tag}@test.local`;
    for (let i = 0; i < 4; i += 1) recordAttempt(key, 60_000);
    assert.equal(isRateLimited(key, 5), false, "four failures still allowed");
    recordAttempt(key, 60_000);
    assert.equal(isRateLimited(key, 5), true, "fifth failure locks the email");
    clearRateLimit(key);
    assert.equal(isRateLimited(key, 5), false, "a successful sign-in clears the counter");
  });

  test("unauthenticated admin mutations are rejected", async () => {
    as("anonymous");
    const result = await productActions.createProductAction(productValues({ slug: `anon-${tag}` }));
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, "UNAUTHENTICATED");
    assert.equal(await prisma.product.count({ where: { slug: `anon-${tag}` } }), 0);
    const bogus = await findSessionByToken("not-a-real-token");
    assert.equal(bogus, null);
  });

  test("expired sessions and deactivated admins are rejected", async () => {
    const expiredToken = await issueSessionToken(ids.staff);
    await prisma.adminSession.updateMany({ where: { adminId: ids.staff, expiresAt: { gt: new Date(Date.now() + 11 * 3600_000) } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal(await findSessionByToken(expiredToken), null);
    staffToken = await issueSessionToken(ids.staff);
    await prisma.adminUser.update({ where: { id: ids.staff }, data: { active: false } });
    assert.equal(await findSessionByToken(staffToken), null);
    await prisma.adminUser.update({ where: { id: ids.staff }, data: { active: true } });
  });

  test("STAFF cannot mutate the catalog, content or settings, but can adjust stock", async () => {
    as("staff");
    const create = await productActions.createProductAction(productValues({ slug: `staff-${tag}` }));
    assert.equal(!create.ok && create.code, "FORBIDDEN");
    const content = await contentActions.updateContentAction("hero", { headline: ["X"], caption: "", turnHeadline: ["Y"], turnCaption: "", metaLeft: "", metaRight: "" });
    assert.equal(!content.ok && content.code, "FORBIDDEN");
    const settings = await saveSettingsAction("inventory", { values: { storeName: "Hacked", defaultCurrency: "INR", supportEmail: "", lowStockThreshold: 5 } });
    assert.equal(!settings.ok && settings.code, "FORBIDDEN");
    const reorder = await collectionActions.reorderCollectionsAction([...ids.originalOrder].reverse());
    assert.equal(!reorder.ok && reorder.code, "FORBIDDEN");
  });
});

describe("products", () => {
  test("creates a product, records an audit event and revalidates the storefront", async () => {
    const result = await productActions.createProductAction(productValues());
    assert.ok(result.ok, JSON.stringify(result));
    ids.products.push(result.data.id);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: result.data.id } });
    assert.equal(product.basePrice, BigInt(199950), "money stored in minor units without floats");
    assert.deepEqual(product.fitNotes, ["Boxy", "Dropped shoulder"]);
    assert.equal(await auditCount("PRODUCT_CREATED", result.data.id), 1);
    const paths = invalidations.flatMap((entry) => entry.paths ?? []);
    assert.ok(paths.includes("/shop") && paths.includes(`/product/test-tee-${tag}`) && paths.includes("/"));
    assert.ok(invalidations.some((entry) => entry.tags?.includes("catalog")));
  });

  test("slug uniqueness is enforced server-side with a readable message", async () => {
    const duplicate = await productActions.createProductAction(productValues({ name: "Another" }));
    assert.equal(duplicate.ok, false);
    assert.ok(!duplicate.ok && duplicate.fieldErrors?.slug?.includes("already used"));
    const invalid = await productActions.createProductAction(productValues({ slug: "Bad Slug!" }));
    assert.ok(!invalid.ok && invalid.fieldErrors?.slug);
    assert.equal((await productActions.checkProductSlugAction(`test-tee-${tag}`)).available, false);
  });

  test("updates a product and revalidates both old and new URLs", async () => {
    const id = ids.products[0];
    const result = await productActions.updateProductAction(id, productValues({ name: `Renamed ${tag}`, slug: `renamed-${tag}` }));
    assert.ok(result.ok, JSON.stringify(result));
    assert.ok(result.data.changed.includes("name") && result.data.changed.includes("slug"));
    const paths = invalidations.flatMap((entry) => entry.paths ?? []);
    assert.ok(paths.includes(`/product/renamed-${tag}`) && paths.includes(`/product/test-tee-${tag}`));
    assert.equal(await auditCount("PRODUCT_UPDATED", id), 1);
  });

  test("variant matrix creates variants with initial stock and rejects duplicate SKUs", async () => {
    const id = ids.products[0];
    const clash = await prisma.productVariant.findFirstOrThrow({ where: { product: { slug: { not: { contains: tag } } } } });
    const row = (sizeId: string, sku: string, extra: Record<string, unknown> = {}) => ({ colorId: ids.color, sizeId, active: true, sku, price: "", compareAtPrice: "", initialStock: "7", ...extra });
    const taken = await productActions.saveVariantsAction(id, { rows: [row(ids.sizes[0], clash.sku)] });
    assert.ok(!taken.ok && taken.fieldErrors?.["rows.0.sku"] === "SKU already exists.");
    const repeated = await productActions.saveVariantsAction(id, { rows: [row(ids.sizes[0], `T${tag}-A`.toUpperCase()), row(ids.sizes[1], `T${tag}-A`.toUpperCase())] });
    assert.ok(!repeated.ok && repeated.fieldErrors?.["rows.1.sku"]);
    const badCompare = await productActions.saveVariantsAction(id, { rows: [row(ids.sizes[0], `T${tag}-A`.toUpperCase(), { compareAtPrice: "100" })] });
    assert.ok(!badCompare.ok && badCompare.fieldErrors?.["rows.0.compareAtPrice"]);
    const ok = await productActions.saveVariantsAction(id, { rows: [row(ids.sizes[0], `T${tag}-A`.toUpperCase()), row(ids.sizes[1], `T${tag}-B`.toUpperCase(), { price: "2100" })] });
    assert.ok(ok.ok, JSON.stringify(ok));
    assert.deepEqual(ok.data, { created: 2, updated: 0, disabled: 0 });
    const variants = await prisma.productVariant.findMany({ where: { productId: id }, include: { inventory: true, adjustments: true }, orderBy: { sku: "asc" } });
    assert.deepEqual(variants.map((variant) => variant.inventory?.quantity), [7, 7]);
    assert.equal(variants[1].price, BigInt(210000));
    assert.ok(variants.every((variant) => variant.adjustments.length === 1 && variant.adjustments[0].note === "Initial stock"));
    const disable = await productActions.saveVariantsAction(id, { rows: [row(ids.sizes[0], `T${tag}-A`.toUpperCase(), { active: false }), row(ids.sizes[1], `T${tag}-B`.toUpperCase())] });
    assert.ok(disable.ok && disable.data.disabled === 1);
    assert.equal((await prisma.productVariant.count({ where: { productId: id, enabled: false } })), 1, "unticking disables, never deletes");
  });

  test("products that appear in orders can only be disabled", async () => {
    const order = await makeOrder("PAID");
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { productId: ids.products[0] } });
    await prisma.orderItem.create({ data: { orderId: order.id, productId: ids.products[0], variantId: variant.id, productName: "Snapshot", sku: variant.sku, sizeName: "S", colorName: "Black", unitPrice: BigInt(100), quantity: 1, lineTotal: BigInt(100) } });
    const result = await productActions.deleteProductAction(ids.products[0]);
    assert.ok(!result.ok && /Disable it instead/.test(result.error));
    assert.equal(await prisma.product.count({ where: { id: ids.products[0] } }), 1);
  });
});

describe("collections", () => {
  test("reordering persists and drives the homepage; stale lists are refused", async () => {
    const reversed = [...ids.originalOrder].reverse();
    const result = await collectionActions.reorderCollectionsAction(reversed);
    assert.ok(result.ok, JSON.stringify(result));
    const ordered = await prisma.collection.findMany({ orderBy: { order: "asc" }, select: { id: true } });
    assert.deepEqual(ordered.map((collection) => collection.id), reversed);
    assert.ok(invalidations.some((entry) => entry.paths?.includes("/") && entry.tags?.includes("collections")));
    assert.equal(await auditCount("COLLECTIONS_REORDERED"), 1);
    const stale = await collectionActions.reorderCollectionsAction(reversed.slice(1));
    assert.ok(!stale.ok && stale.code === "CONFLICT");
  });

  test("homepage featuring is capped at five", async () => {
    const created = await collectionActions.createCollectionAction({ name: `Extra ${tag}`, slug: `extra-${tag}`, shortDescription: "Short", description: "Long", enabled: true, featured: false });
    assert.ok(created.ok, JSON.stringify(created));
    // Fill the homepage to capacity (restored after the run), then try a sixth.
    const others = await prisma.collection.findMany({ where: { id: { not: created.data.id } }, orderBy: { order: "asc" }, take: 5 });
    await prisma.collection.updateMany({ where: { id: { in: others.map((collection) => collection.id) } }, data: { featured: true } });
    assert.equal(await prisma.collection.count({ where: { featured: true } }), 5);
    const sixth = await collectionActions.setCollectionFlagsAction(created.data.id, { featured: true });
    assert.ok(!sixth.ok && /Only 5 collections/.test(sixth.error));
    const deleted = await collectionActions.deleteCollectionAction(created.data.id);
    assert.ok(deleted.ok);
    const withProducts = await collectionActions.deleteCollectionAction(ids.collection);
    assert.ok(!withProducts.ok && /still has/.test(withProducts.error));
  });
});

describe("inventory", () => {
  test("adjustments apply deltas and record who, why and before/after", async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { productId: ids.products[0], enabled: true }, include: { inventory: true } });
    const before = variant.inventory!.quantity;
    const result = await inventoryActions.adjustInventoryAction({ variantId: variant.id, delta: 10, reason: "RESTOCK", note: "Supplier delivery" });
    assert.ok(result.ok, JSON.stringify(result));
    assert.equal(result.data.quantity, before + 10);
    const adjustment = await prisma.inventoryAdjustment.findFirstOrThrow({ where: { variantId: variant.id, note: "Supplier delivery" } });
    assert.deepEqual([adjustment.quantityBefore, adjustment.quantityAfter, adjustment.adminId], [before, before + 10, ids.admin]);
    assert.equal(await auditCount("INVENTORY_ADJUSTED", variant.id), 1);
    as("staff");
    const staff = await inventoryActions.adjustInventoryAction({ variantId: variant.id, delta: -1, reason: "DAMAGED", note: "" });
    assert.ok(staff.ok, "staff can adjust stock");
  });

  test("stock can never go below zero or below active reservations", async () => {
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { productId: ids.products[0], enabled: true }, include: { inventory: true } });
    const quantity = variant.inventory!.quantity;
    await prisma.inventory.update({ where: { variantId: variant.id }, data: { reservedQuantity: 3 } });
    const belowReserved = await inventoryActions.adjustInventoryAction({ variantId: variant.id, delta: -(quantity - 2), reason: "CORRECTION", note: "" });
    assert.ok(!belowReserved.ok && /reserved by checkouts/.test(belowReserved.error));
    const zero = await inventoryActions.adjustInventoryAction({ variantId: variant.id, delta: 0, reason: "CORRECTION", note: "" });
    assert.ok(!zero.ok && zero.fieldErrors?.delta);
    const exact = await inventoryActions.adjustInventoryAction({ variantId: variant.id, delta: -(quantity - 3), reason: "CORRECTION", note: "" });
    assert.ok(exact.ok && exact.data.available === 0, "can reduce exactly to the reserved floor");
    await prisma.inventory.update({ where: { variantId: variant.id }, data: { reservedQuantity: 0 } });
    const negative = await inventoryActions.adjustInventoryAction({ variantId: variant.id, delta: -4, reason: "CORRECTION", note: "" });
    assert.ok(!negative.ok && /below 0/.test(negative.error));
    const row = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
    assert.equal(row.quantity, 3);
  });
});

async function makeOrder(status: "PAID" | "AWAITING_PAYMENT") {
  const cart = await prisma.cart.create({ data: { sessionId: `admin-test-${tag}-${randomUUID()}` } });
  const delivery = await prisma.deliveryMethod.findFirstOrThrow();
  const draft = await prisma.checkoutDraft.create({ data: { cartId: cart.id, email: "buyer@test.local", deliveryMethodId: delivery.id, status: "CONVERTED", subtotal: BigInt(100), shippingAmount: BigInt(0), total: BigInt(100), currency: "INR" } });
  const order = await prisma.order.create({ data: { checkoutDraftId: draft.id, orderNumber: `CLT-T${randomUUID().slice(0, 8).toUpperCase()}`, publicToken: randomUUID().replaceAll("-", ""), email: "buyer@test.local", status, currency: "INR", subtotal: BigInt(100), shippingAmount: BigInt(0), total: BigInt(100), reservationStatus: status === "PAID" ? "COMMITTED" : "NONE" } });
  ids.orders.push(order.id);
  return order;
}

describe("orders", () => {
  test("the transition table allows only sensible moves", () => {
    assert.equal(canTransitionOrder("PAID", "PROCESSING"), true);
    assert.equal(canTransitionOrder("PROCESSING", "SHIPPED"), true);
    assert.equal(canTransitionOrder("SHIPPED", "DELIVERED"), true);
    assert.equal(canTransitionOrder("DELIVERED", "PROCESSING"), false);
    assert.equal(canTransitionOrder("AWAITING_PAYMENT", "PAID"), false, "only payment verification marks PAID");
    assert.equal(canTransitionOrder("SHIPPED", "CANCELLED"), false);
  });

  test("valid transitions apply, invalid and stale ones fail safely, shipment data is kept", async () => {
    const order = await makeOrder("PAID");
    const skip = await orderActions.transitionOrderAction({ orderId: order.id, from: "PAID", to: "SHIPPED", carrier: "", trackingNumber: "", trackingUrl: "", note: "" });
    assert.ok(!skip.ok && skip.code === "INVALID_STATE");
    const processing = await orderActions.transitionOrderAction({ orderId: order.id, from: "PAID", to: "PROCESSING", carrier: "", trackingNumber: "", trackingUrl: "", note: "Packing" });
    assert.ok(processing.ok, JSON.stringify(processing));
    const stale = await orderActions.transitionOrderAction({ orderId: order.id, from: "PAID", to: "PROCESSING", carrier: "", trackingNumber: "", trackingUrl: "", note: "" });
    assert.ok(!stale.ok && stale.code === "CONFLICT");
    const badUrl = await orderActions.transitionOrderAction({ orderId: order.id, from: "PROCESSING", to: "SHIPPED", carrier: "Delhivery", trackingNumber: "DL123", trackingUrl: "javascript:alert(1)", note: "" });
    assert.ok(!badUrl.ok && badUrl.fieldErrors?.trackingUrl);
    const shipped = await orderActions.transitionOrderAction({ orderId: order.id, from: "PROCESSING", to: "SHIPPED", carrier: "Delhivery", trackingNumber: "DL123", trackingUrl: "https://track.example/DL123", note: "" });
    assert.ok(shipped.ok);
    const shipment = await prisma.shipment.findUniqueOrThrow({ where: { orderId: order.id } });
    assert.equal(shipment.trackingNumber, "DL123");
    assert.ok(shipment.shippedAt);
    const back = await orderActions.transitionOrderAction({ orderId: order.id, from: "SHIPPED", to: "PROCESSING" as never, carrier: "", trackingNumber: "", trackingUrl: "", note: "" });
    assert.ok(!back.ok);
    const delivered = await orderActions.transitionOrderAction({ orderId: order.id, from: "SHIPPED", to: "DELIVERED", carrier: "", trackingNumber: "", trackingUrl: "", note: "" });
    assert.ok(delivered.ok);
    assert.equal(await auditCount("ORDER_STATUS_CHANGED", order.id), 3);
  });

  test("cancelling a paid order restocks once and says the refund is separate", async () => {
    const order = await makeOrder("PAID");
    const variant = await prisma.productVariant.findFirstOrThrow({ where: { productId: ids.products[0], enabled: true }, include: { inventory: true } });
    await prisma.orderItem.create({ data: { orderId: order.id, productId: ids.products[0], variantId: variant.id, productName: "Snapshot", sku: variant.sku, sizeName: "S", colorName: "Black", unitPrice: BigInt(100), quantity: 2, lineTotal: BigInt(200) } });
    const cancelled = await orderActions.transitionOrderAction({ orderId: order.id, from: "PAID", to: "CANCELLED", carrier: "", trackingNumber: "", trackingUrl: "", note: "Customer request" });
    assert.ok(cancelled.ok && cancelled.data.restocked === 2);
    const after = await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } });
    assert.equal(after.quantity, variant.inventory!.quantity + 2);
    const again = await orderActions.transitionOrderAction({ orderId: order.id, from: "CANCELLED", to: "CANCELLED", carrier: "", trackingNumber: "", trackingUrl: "", note: "" });
    assert.ok(!again.ok);
    assert.equal((await prisma.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).quantity, after.quantity, "no double restock");
    as("staff");
    const staffCan = await orderActions.transitionOrderAction({ orderId: (await makeOrder("PAID")).id, from: "PAID", to: "PROCESSING", carrier: "", trackingNumber: "", trackingUrl: "", note: "" });
    assert.ok(staffCan.ok, "staff can fulfil orders");
  });
});

describe("content", () => {
  test("homepage content updates are validated, stored, audited and revalidate the homepage", async () => {
    const tooLong = await contentActions.updateContentAction("hero", { headline: ["a", "b", "c", "d"], caption: "", turnHeadline: ["x"], turnCaption: "", metaLeft: "", metaRight: "" });
    assert.ok(!tooLong.ok && tooLong.fieldErrors?.headline);
    const unknown = await contentActions.updateContentAction("footerHack", {});
    assert.equal(unknown.ok, false);
    const saved = await contentActions.updateContentAction("hero", { headline: ["Made to", "Be seen."], caption: "Drop 02", turnHeadline: ["Look", "Back."], turnCaption: "", metaLeft: "SS27", metaRight: "Scroll" });
    assert.ok(saved.ok, JSON.stringify(saved));
    assert.deepEqual((await readContent("hero")).headline, ["Made to", "Be seen."]);
    assert.ok(invalidations.some((entry) => entry.paths?.includes("/") && entry.tags?.includes("content")));
    assert.equal(await auditCount("CONTENT_UPDATED", "hero"), 1);
    const threshold = (await getSettingsFresh("inventory")).lowStockThreshold === 4 ? 5 : 4;
    const settings = await saveSettingsAction("inventory", { values: { lowStockThreshold: threshold } });
    assert.ok(settings.ok);
    assert.equal((await getSettingsFresh("inventory")).lowStockThreshold, threshold);
    assert.ok(invalidations.some((entry) => entry.tags?.includes("settings")));
  });
});

describe("storage", () => {
  const png = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");

  test("uploads are type-sniffed, stored under random keys and cleaned up when unreferenced", async () => {
    await assert.rejects(storeUpload({ folder: "products", kind: "image", fileName: "evil.png", body: Buffer.from("<script>alert(1)</script>") }), UploadError);
    await assert.rejects(storeUpload({ folder: "products", kind: "model", fileName: "x.glb", body: png }), UploadError);
    const stored = await storeUpload({ folder: "products", kind: "image", fileName: "Front View.png", body: png });
    assert.match(stored.url, /^\/media\/products\/\d{4}\/\d{2}\/[0-9a-f]{16}-front-view\.png$/);
    const file = path.join(uploadDir, stored.key);
    assert.ok((await stat(file)).size > 0);
    await deleteIfUnreferenced(stored.url);
    await assert.rejects(stat(file));
    assert.equal(resolveLocalKey("../../etc/passwd"), null);
    assert.equal(resolveLocalKey("products/../../x.png"), null);
  });

  test("S3/R2 requests are signed with AWS SigV4 (AWS documented example)", () => {
    const signed = signS3Request(
      { endpoint: "https://examplebucket.s3.amazonaws.com", region: "us-east-1", accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" },
      "GET", "/test.txt", "", { range: "bytes=0-9" }, new Date("2013-05-24T00:00:00Z"),
    );
    assert.match(signed.headers.authorization, /Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/);
  });
});
