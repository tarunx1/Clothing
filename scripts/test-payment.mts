/**
 * Payment integration tests: real Postgres + real Razorpay adapter, with every
 * provider network call served by an in-memory mock of the Razorpay REST API.
 * Run: npm run test:payment   (requires the database from README/payment-testing.md)
 */
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";

process.env.RAZORPAY_KEY_ID = "rzp_test_mockkey";
process.env.RAZORPAY_KEY_SECRET = "mock_key_secret_for_tests";
process.env.RAZORPAY_WEBHOOK_SECRET = "mock_webhook_secret_for_tests";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

const { prisma } = await import("@/lib/db/prisma");
const payments = await import("@/lib/services/paymentService");
const orders = await import("@/lib/services/orderService");
const { getCart } = await import("@/lib/services/cartService");
const { createRazorpayProvider } = await import("@/lib/payments/razorpay/server");
const credentials = { mode: "test" as const, keyId: process.env.RAZORPAY_KEY_ID!, keySecret: KEY_SECRET, webhookSecret: WEBHOOK_SECRET };
const razorpayProvider = createRazorpayProvider(credentials);
const { setPaymentCredentialsForTesting } = await import("@/lib/payments/provider");
setPaymentCredentialsForTesting({ test: credentials });
const { isValidCheckoutSignature, isValidWebhookSignature } = await import("@/lib/payments/razorpay/verify");
const { enforceRateLimit, resetRateLimitsForTesting } = await import("@/lib/http/rateLimit");
const { assertSameOriginJson } = await import("@/lib/http/requestGuard");

// ---------- Mock Razorpay REST API ----------
type RemotePayment = { id: string; order_id: string; amount: number; currency: string; status: string; error_code: string | null; error_description: string | null };
const remote = { orders: new Map<string, { amount: number; currency: string }>(), payments: new Map<string, RemotePayment>(), createdOrders: 0, captures: 0 };
const realFetch = globalThis.fetch;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  assert.equal(url.host, "api.razorpay.com", "only provider calls are mocked");
  const path = url.pathname.replace(/^\/v1/, "");
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(String(init.body)) : {};
  if (method === "POST" && path === "/orders") {
    remote.createdOrders += 1;
    const id = `order_mock${remote.createdOrders}${randomUUID().slice(0, 6)}`;
    remote.orders.set(id, { amount: body.amount, currency: body.currency });
    return json({ id, entity: "order", amount: body.amount, currency: body.currency, status: "created" });
  }
  let match = path.match(/^\/payments\/([^/]+)\/capture$/);
  if (match && method === "POST") {
    const payment = remote.payments.get(match[1]);
    if (!payment || payment.status !== "authorized") return json({ error: { code: "BAD_REQUEST_ERROR" } }, 400);
    remote.captures += 1;
    payment.status = "captured";
    return json(payment);
  }
  match = path.match(/^\/payments\/([^/]+)$/);
  if (match) return remote.payments.has(match[1]) ? json(remote.payments.get(match[1])) : json({ error: {} }, 404);
  match = path.match(/^\/orders\/([^/]+)\/payments$/);
  if (match) return json({ items: [...remote.payments.values()].filter((payment) => payment.order_id === match![1]) });
  return json({ error: {} }, 404);
}) as typeof fetch;

/** Simulates the customer paying in the provider window; returns the browser callback payload. */
function customerPays(orderId: string, overrides: Partial<RemotePayment> = {}) {
  const order = remote.orders.get(orderId)!;
  const id = `pay_mock${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const payment: RemotePayment = { id, order_id: orderId, amount: order.amount, currency: order.currency, status: "captured", error_code: null, error_description: null, ...overrides };
  remote.payments.set(id, payment);
  const signature = createHmac("sha256", KEY_SECRET).update(`${orderId}|${id}`).digest("hex");
  return { payment, callback: { razorpay_order_id: orderId, razorpay_payment_id: id, razorpay_signature: signature } };
}

function signedWebhook(event: string, payment: RemotePayment, eventId = `evt_${randomUUID()}`) {
  const raw = JSON.stringify({ entity: "event", event, payload: { payment: { entity: payment } } });
  const headers = new Headers({ "x-razorpay-signature": createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex"), "x-razorpay-event-id": eventId });
  return { raw, headers, eventId };
}

// ---------- Fixtures ----------
const tag = randomUUID().slice(0, 8);
const UNIT_PRICE = BigInt(249900);
const STOCK = 5;
let productId = "";
let variantId = "";
let sku = "";
const sessions: string[] = [];

const checkoutValues = (overrides: Record<string, unknown> = {}) => ({
  contact: { email: "buyer@example.com", phone: "" },
  shippingAddress: { firstName: "Asha", lastName: "Rao", address1: "12 Linking Road", address2: "", city: "Mumbai", region: "Maharashtra", postalCode: "400050", country: "IN", phone: "+91 98200 00000" },
  deliveryMethodId: "standard",
  ...overrides,
});

async function cartWith(quantity: number) {
  const sessionId = `test-pay-${randomUUID()}`;
  sessions.push(sessionId);
  await prisma.cart.create({ data: { sessionId, status: "ACTIVE", items: quantity ? { create: { variantId, quantity } } : undefined } });
  return sessionId;
}

const inventory = () => prisma.inventory.findUniqueOrThrow({ where: { variantId } });
const orderFor = (providerOrderId: string) => prisma.payment.findUniqueOrThrow({ where: { providerOrderId }, include: { order: { include: { checkoutDraft: { include: { cart: true } } } } } });
const emailLogs: string[] = [];
const realInfo = console.info;

before(async () => {
  const [collection, color, size] = await Promise.all([prisma.collection.findFirstOrThrow(), prisma.color.findFirstOrThrow(), prisma.size.findFirstOrThrow()]);
  sku = `TEST-PAY-${tag}`.toUpperCase();
  const product = await prisma.product.create({
    data: {
      name: `Payment Test Tee ${tag}`, slug: `payment-test-${tag}`, description: "Test fixture", basePrice: UNIT_PRICE, currency: "INR", collectionId: collection.id, enabled: true,
      variants: { create: { colorId: color.id, sizeId: size.id, sku, enabled: true, inventory: { create: { quantity: STOCK, reservedQuantity: 0 } } } },
    },
    include: { variants: true },
  });
  productId = product.id;
  variantId = product.variants[0].id;
  console.info = (...args: unknown[]) => { if (String(args[0]).startsWith("[email]")) emailLogs.push(String(args[0])); else realInfo(...args); };
});

beforeEach(async () => {
  await prisma.inventory.update({ where: { variantId }, data: { quantity: STOCK, reservedQuantity: 0 } });
  await prisma.productVariant.update({ where: { id: variantId }, data: { enabled: true } });
  resetRateLimitsForTesting();
  emailLogs.length = 0;
});

afterEach(() => { remote.payments.clear(); });

after(async () => {
  console.info = realInfo;
  globalThis.fetch = realFetch;
  const carts = await prisma.cart.findMany({ where: { OR: [{ sessionId: { in: sessions } }, { items: { some: { variantId } } }] }, select: { id: true } });
  const cartIds = carts.map((cart) => cart.id);
  await prisma.order.deleteMany({ where: { checkoutDraft: { cartId: { in: cartIds } } } });
  await prisma.checkoutDraft.deleteMany({ where: { cartId: { in: cartIds } } });
  await prisma.cart.deleteMany({ where: { id: { in: cartIds } } });
  await prisma.webhookEvent.deleteMany({ where: { eventId: { startsWith: "evt_" } } });
  await prisma.product.delete({ where: { id: productId } });
  await prisma.$disconnect();
});

// ---------- Tests ----------
describe("payment session", () => {
  test("1. prices come from the database; browser-sent amounts are ignored", async () => {
    const sessionId = await cartWith(2);
    const session = await payments.createCheckoutPaymentSession(sessionId, { ...checkoutValues(), total: 1, amount: 1, price: 1 });
    assert.equal(session.init.amount, Number(UNIT_PRICE * BigInt(2)));
    assert.equal(remote.orders.get(session.init.reference)?.amount, 499800);
  });

  test("2. amount calculation: subtotal + server shipping in minor units", async () => {
    const sessionId = await cartWith(2);
    const session = await payments.createCheckoutPaymentSession(sessionId, checkoutValues({ deliveryMethodId: "express" }));
    const express = await prisma.deliveryMethod.findUniqueOrThrow({ where: { code: "EXPRESS" } });
    assert.equal(BigInt(session.init.amount), UNIT_PRICE * BigInt(2) + express.price);
    assert.deepEqual(session.quote, { subtotal: 4998, shipping: Number(express.price) / 100, tax: 0, total: 4998 + Number(express.price) / 100, currency: "INR" });
  });

  test("3. session creation reserves stock, stores a payment, exposes no secrets, and is reused on retry", async () => {
    const sessionId = await cartWith(2);
    const before = remote.createdOrders;
    const first = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    const second = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    assert.equal(second.init.reference, first.init.reference, "same provider order reused");
    assert.equal(remote.createdOrders - before, 1, "one provider order for repeated clicks");
    assert.equal((await inventory()).reservedQuantity, 2, "reservation not doubled");
    const record = await orderFor(first.init.reference);
    assert.equal(record.status, "CREATED");
    assert.equal(record.order.status, "AWAITING_PAYMENT");
    assert.equal(record.order.publicToken.length, 32);
    const serialized = JSON.stringify(first);
    assert.ok(!serialized.includes(KEY_SECRET) && !serialized.includes(WEBHOOK_SECRET));
    assert.ok(!serialized.includes(record.order.id) && !serialized.includes(record.orderId));
    assert.equal(await prisma.order.count({ where: { checkoutDraft: { cart: { sessionId } } } }), 1);
  });

  test("4. invalid cart: missing session and empty bag are rejected", async () => {
    await assert.rejects(payments.createCheckoutPaymentSession(`missing-${randomUUID()}`, checkoutValues()), { code: "SESSION_EXPIRED" });
    const empty = await cartWith(0);
    await assert.rejects(payments.createCheckoutPaymentSession(empty, checkoutValues()), { code: "CART_NOT_FOUND" });
    await assert.rejects(payments.createCheckoutPaymentSession(empty, { ...checkoutValues(), contact: { email: "nope", phone: "" } }), { name: "ZodError" });
  });

  test("5. out-of-stock and disabled variants are rejected without reserving", async () => {
    const sessionId = await cartWith(STOCK + 1);
    await assert.rejects(payments.createCheckoutPaymentSession(sessionId, checkoutValues()), { code: "OUT_OF_STOCK" });
    const other = await cartWith(1);
    await prisma.productVariant.update({ where: { id: variantId }, data: { enabled: false } });
    await assert.rejects(payments.createCheckoutPaymentSession(other, checkoutValues()), { code: "VARIANT_NOT_FOUND" });
    assert.equal((await inventory()).reservedQuantity, 0);
  });
});

describe("verification", () => {
  test("6. valid signature + captured provider payment marks the order PAID", async () => {
    const sessionId = await cartWith(1);
    const session = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    const { callback } = customerPays(session.init.reference);
    assert.ok(isValidCheckoutSignature(callback.razorpay_order_id, callback.razorpay_payment_id, callback.razorpay_signature, KEY_SECRET));
    const outcome = await payments.verifyClientPayment(callback);
    assert.equal(outcome.status, "confirmed");
    const record = await orderFor(session.init.reference);
    assert.equal(record.status, "SUCCEEDED");
    assert.equal(record.order.status, "PAID");
    assert.ok(record.order.paidAt);
  });

  test("7. invalid signature is rejected and nothing changes", async () => {
    const sessionId = await cartWith(1);
    const session = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    const { callback } = customerPays(session.init.reference);
    const forged = { ...callback, razorpay_signature: "0".repeat(64) };
    await assert.rejects(payments.verifyClientPayment(forged), { code: "PAYMENT_VERIFICATION_FAILED" });
    await assert.rejects(payments.verifyClientPayment({ razorpay_order_id: session.init.reference }), { code: "PAYMENT_VERIFICATION_FAILED" });
    assert.throws(() => razorpayProvider.parseWebhook('{"event":"payment.captured"}', new Headers({ "x-razorpay-signature": "bad" })), { name: "PaymentVerificationError" });
    assert.equal(isValidWebhookSignature("{}", "abc", WEBHOOK_SECRET), false);
    const record = await orderFor(session.init.reference);
    assert.equal(record.order.status, "AWAITING_PAYMENT");
    assert.equal((await inventory()).quantity, STOCK);
  });

  test("8. webhook redelivery of the same event is processed once", async () => {
    const sessionId = await cartWith(2);
    const session = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    const { payment } = customerPays(session.init.reference);
    const hook = signedWebhook("payment.captured", payment);
    assert.deepEqual(await payments.handlePaymentWebhook(hook.raw, hook.headers), { duplicate: false });
    assert.deepEqual(await payments.handlePaymentWebhook(hook.raw, hook.headers), { duplicate: true });
    const stock = await inventory();
    assert.deepEqual([stock.quantity, stock.reservedQuantity], [STOCK - 2, 0]);
    assert.equal(emailLogs.length, 1, "confirmation attempted once");
  });

  test("9. repeated browser callbacks are idempotent", async () => {
    const sessionId = await cartWith(2);
    const session = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    const { callback } = customerPays(session.init.reference);
    const results = await Promise.all([payments.verifyClientPayment(callback), payments.verifyClientPayment(callback)]);
    assert.ok(results.every((result) => result.status === "confirmed"));
    assert.equal((await payments.verifyClientPayment(callback)).status, "confirmed");
    assert.equal((await inventory()).quantity, STOCK - 2);
    assert.equal(await prisma.payment.count({ where: { order: { checkoutDraft: { cart: { items: { some: { variantId } } } } }, status: "SUCCEEDED", providerOrderId: session.init.reference } }), 1);
  });

  test("10. amount mismatch never marks PAID", async () => {
    const sessionId = await cartWith(1);
    const session = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    const { callback, payment } = customerPays(session.init.reference, { amount: 100 });
    await assert.rejects(payments.verifyClientPayment(callback), { code: "PAYMENT_VERIFICATION_FAILED" });
    const hook = signedWebhook("payment.captured", payment);
    await payments.handlePaymentWebhook(hook.raw, hook.headers);
    assert.equal((await orderFor(session.init.reference)).order.status, "AWAITING_PAYMENT");
    assert.equal((await inventory()).quantity, STOCK);
  });

  test("11. currency mismatch never marks PAID", async () => {
    const sessionId = await cartWith(1);
    const session = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    const { callback } = customerPays(session.init.reference, { currency: "USD" });
    await assert.rejects(payments.verifyClientPayment(callback), { code: "PAYMENT_VERIFICATION_FAILED" });
    assert.equal((await orderFor(session.init.reference)).order.status, "AWAITING_PAYMENT");
  });

  test("12. duplicate success events (captured + order.paid + callback) finalize once", async () => {
    const sessionId = await cartWith(3);
    const session = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    const { callback, payment } = customerPays(session.init.reference);
    const captured = signedWebhook("payment.captured", payment);
    const paid = signedWebhook("order.paid", payment);
    await Promise.all([
      payments.handlePaymentWebhook(captured.raw, captured.headers),
      payments.handlePaymentWebhook(paid.raw, paid.headers),
      payments.verifyClientPayment(callback),
    ]);
    const stock = await inventory();
    assert.deepEqual([stock.quantity, stock.reservedQuantity], [STOCK - 3, 0]);
    assert.equal(emailLogs.length, 1);
  });

  test("authorized payments are captured server-side for the stored amount", async () => {
    const sessionId = await cartWith(1);
    const session = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    const { callback } = customerPays(session.init.reference, { status: "authorized" });
    const captures = remote.captures;
    assert.equal((await payments.verifyClientPayment(callback)).status, "confirmed");
    assert.equal(remote.captures - captures, 1);
  });
});

describe("order state", () => {
  test("13. a PAID order never gets another payment session", async () => {
    const sessionId = await cartWith(1);
    const session = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    const record = await orderFor(session.init.reference);
    await prisma.order.update({ where: { id: record.orderId }, data: { status: "PAID" } });
    const created = remote.createdOrders;
    await assert.rejects(payments.createCheckoutPaymentSession(sessionId, checkoutValues()), (error: { code: string; details: { confirmationPath: string } }) => {
      assert.equal(error.code, "ORDER_ALREADY_PAID");
      assert.equal(error.details.confirmationPath, `/order/confirmation/${record.order.publicToken}`);
      return true;
    });
    assert.equal(remote.createdOrders, created);
  });

  test("14 + 15. inventory is committed and the cart converted exactly once", async () => {
    const sessionId = await cartWith(2);
    const session = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    const { callback, payment } = customerPays(session.init.reference);
    await payments.verifyClientPayment(callback);
    const hook = signedWebhook("payment.captured", payment);
    await payments.handlePaymentWebhook(hook.raw, hook.headers);
    await payments.finalizeSuccessfulPayment({ providerOrderId: payment.order_id, providerPaymentId: payment.id, amount: BigInt(payment.amount), currency: payment.currency, state: "succeeded" });
    const stock = await inventory();
    assert.deepEqual([stock.quantity, stock.reservedQuantity], [STOCK - 2, 0]);
    const record = await orderFor(session.init.reference);
    assert.equal(record.order.reservationStatus, "COMMITTED");
    assert.equal(record.order.checkoutDraft.status, "CONVERTED");
    assert.equal(record.order.checkoutDraft.cart.status, "CHECKED_OUT");
    assert.equal(record.order.checkoutDraft.cart.sessionId, null);
  });

  test("16 + 17. failed and cancelled payments keep the bag and stock intact; retry reuses the order", async () => {
    const sessionId = await cartWith(2);
    const session = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    const { payment } = customerPays(session.init.reference, { status: "failed", error_code: "BAD_REQUEST_ERROR", error_description: "Card declined" });
    const hook = signedWebhook("payment.failed", payment);
    await payments.handlePaymentWebhook(hook.raw, hook.headers);
    assert.equal((await orderFor(session.init.reference)).status, "FAILED");
    assert.deepEqual(await payments.cancelCheckoutPayment(sessionId, session.init.reference), { status: "cancelled" });
    const record = await orderFor(session.init.reference);
    assert.equal(record.order.status, "PAYMENT_FAILED");
    assert.equal(record.failureMessage, "Card declined");
    const stock = await inventory();
    assert.deepEqual([stock.quantity, stock.reservedQuantity], [STOCK, 0]);
    const cart = await getCart(sessionId);
    assert.equal(cart.count, 2, "bag intact after failure");
    await assert.rejects(payments.cancelCheckoutPayment(`other-${randomUUID()}`, session.init.reference), { code: "FORBIDDEN" });

    const retry = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    assert.notEqual(retry.init.reference, session.init.reference, "fresh provider order after cancellation");
    const retried = await orderFor(retry.init.reference);
    assert.equal(retried.orderId, record.orderId, "same order, no duplicate");
    assert.equal(retried.order.status, "AWAITING_PAYMENT");
    assert.equal((await inventory()).reservedQuantity, 2);
  });

  test("18. verified success empties the shopper's bag", async () => {
    const sessionId = await cartWith(1);
    const session = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    assert.equal((await getCart(sessionId)).count, 1, "bag kept while awaiting payment");
    const { callback } = customerPays(session.init.reference);
    await payments.verifyClientPayment(callback);
    assert.equal((await getCart(sessionId)).count, 0);
  });

  test("19. confirmation uses order snapshots after catalog edits", async () => {
    const sessionId = await cartWith(2);
    const session = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    const { callback } = customerPays(session.init.reference);
    const outcome = await payments.verifyClientPayment(callback);
    assert.equal(outcome.status, "confirmed");
    const originalName = `Payment Test Tee ${tag}`;
    await prisma.product.update({ where: { id: productId }, data: { name: "Renamed", basePrice: BigInt(100) } });
    const token = outcome.status === "confirmed" ? outcome.confirmationPath.split("/").pop()! : "";
    const confirmation = await orders.getOrderConfirmation(token);
    assert.equal(confirmation?.status, "confirmed");
    assert.equal(confirmation?.items[0].productName, originalName);
    assert.equal(confirmation?.items[0].unitPrice, 2499);
    assert.equal(confirmation?.total, 4998);
    assert.equal(confirmation?.shipTo?.city, "Mumbai");
    assert.equal(await orders.getOrderConfirmation("CLT-000001"), null, "order numbers do not unlock orders");
    await prisma.product.update({ where: { id: productId }, data: { name: originalName, basePrice: UNIT_PRICE } });
  });

  test("abandoned reservations expire and release stock; a late payment still settles once", async () => {
    const sessionId = await cartWith(2);
    const session = await payments.createCheckoutPaymentSession(sessionId, checkoutValues());
    const expired = await orders.expireAbandonedOrders(new Date(Date.now() + 31 * 60_000));
    assert.ok(expired >= 1);
    const record = await orderFor(session.init.reference);
    assert.deepEqual([record.order.status, record.order.reservationStatus, record.status], ["EXPIRED", "RELEASED", "CANCELLED"]);
    assert.equal((await inventory()).reservedQuantity, 0);
    const { payment } = customerPays(session.init.reference);
    const hook = signedWebhook("payment.captured", payment);
    await payments.handlePaymentWebhook(hook.raw, hook.headers);
    const stock = await inventory();
    assert.deepEqual([stock.quantity, stock.reservedQuantity], [STOCK - 2, 0]);
    assert.equal((await orderFor(session.init.reference)).order.status, "PAID");
  });
});

describe("request protection", () => {
  test("session creation is rate limited", () => {
    for (let i = 0; i < 3; i += 1) enforceRateLimit("k", 3, 60_000);
    assert.throws(() => enforceRateLimit("k", 3, 60_000), { code: "RATE_LIMITED" });
  });

  test("cross-site and non-JSON mutations are refused", () => {
    const make = (headers: Record<string, string>) => new Request("http://localhost:3000/api/checkout/payment/session", { method: "POST", headers });
    assert.doesNotThrow(() => assertSameOriginJson(make({ origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json", "sec-fetch-site": "same-origin" })));
    assert.throws(() => assertSameOriginJson(make({ origin: "https://evil.example", host: "localhost:3000", "content-type": "application/json" })), { code: "FORBIDDEN" });
    assert.throws(() => assertSameOriginJson(make({ host: "localhost:3000", "content-type": "application/json" })), { code: "FORBIDDEN" });
    assert.throws(() => assertSameOriginJson(make({ origin: "http://localhost:3000", host: "localhost:3000", "content-type": "text/plain" })), { code: "FORBIDDEN" });
    assert.throws(() => assertSameOriginJson(make({ origin: "http://localhost:3000", host: "localhost:3000", "content-type": "application/json", "sec-fetch-site": "cross-site" })), { code: "FORBIDDEN" });
  });
});
