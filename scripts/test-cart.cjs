/* eslint-disable @typescript-eslint/no-require-imports */
// Pure cart logic behind hooks/useBag.ts, the bag drawer and /cart.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, parent, ...args);
};
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
};
const cart = require('../lib/cart.ts');
const { products } = require('../data/products.ts');
const { shopConfig } = require('../config/shop.ts');

const variantOf = (productId, size) => products.find((p) => p.id === productId).variants.find((v) => v.size === size);
const scuM = variantOf('sculpture-tee', 'M'); // stock 18 → capped at maxQuantity
const scuL = variantOf('sculpture-tee', 'L'); // stock 2
const scuXL = variantOf('sculpture-tee', 'XL'); // stock 0
const pitS = variantOf('pit-lane-tee', 'S');

test('same product + variant merges into one row; a different variant is a new row', () => {
  let lines = cart.withItemAdded([], 'sculpture-tee', scuM.id, 1);
  lines = cart.withItemAdded(lines, 'sculpture-tee', scuM.id, 2);
  assert.deepEqual(lines, [{ productId: 'sculpture-tee', variantId: scuM.id, quantity: 3 }]);
  lines = cart.withItemAdded(lines, 'sculpture-tee', scuL.id, 1);
  assert.equal(lines.length, 2);
});

test('adding never exceeds stock, and sold-out variants cannot be added', () => {
  let lines = cart.withItemAdded([], 'sculpture-tee', scuL.id, 1);
  lines = cart.withItemAdded(lines, 'sculpture-tee', scuL.id, 5);
  assert.equal(lines[0].quantity, 2, 'clamped to the two in stock');
  assert.equal(cart.withItemAdded(lines, 'sculpture-tee', scuL.id, 1), null, 'nothing more to add');
  assert.equal(cart.withItemAdded([], 'sculpture-tee', scuXL.id, 1), null);
  assert.equal(cart.withItemAdded([], 'sculpture-tee', 'no-such-variant', 1), null);
  assert.equal(cart.withItemAdded([], 'sculpture-tee', scuM.id, 0), null);
});

test('quantity updates clamp to 1…min(stock, per-line cap)', () => {
  const lines = [{ productId: 'sculpture-tee', variantId: scuM.id, quantity: 2 }, { productId: 'sculpture-tee', variantId: scuL.id, quantity: 1 }];
  assert.equal(cart.withQuantity(lines, scuM.id, 0)[0].quantity, 1, 'never below 1');
  assert.equal(cart.withQuantity(lines, scuM.id, 99)[0].quantity, shopConfig.maxQuantity);
  assert.equal(cart.withQuantity(lines, scuL.id, 5)[1].quantity, 2, 'never above stock');
  assert.equal(cart.itemLimitIn(lines, scuL.id), 2);
});

test('remove, count (total units) and subtotal (variant price × quantity)', () => {
  const lines = [{ productId: 'sculpture-tee', variantId: scuM.id, quantity: 2 }, { productId: 'pit-lane-tee', variantId: pitS.id, quantity: 1 }];
  assert.equal(cart.cartCount(lines), 3);
  const views = cart.resolveCart(lines);
  assert.equal(cart.cartSubtotal(views), scuM.price * 2 + pitS.price);
  assert.equal(views[0].lineTotal, scuM.price * 2);
  assert.equal(cart.cartCurrency(views), 'INR');
  const after = cart.withItemRemoved(lines, scuM.id);
  assert.deepEqual(after.map((l) => l.variantId), [pitS.id]);
  assert.equal(cart.cartCount([]), 0);
});

test('persisted data is validated: junk recovers to an empty bag', () => {
  for (const raw of [null, '', 'not json', '{"a":1}', '42', '[null, 1, "x"]']) assert.deepEqual(cart.parseStoredCart(raw), []);
  const raw = JSON.stringify([
    { productId: 'nope', variantId: 'x', quantity: 1 },
    { productId: 'sculpture-tee', variantId: scuXL.id, quantity: 1 },
    { productId: 'sculpture-tee', variantId: scuM.id, quantity: 1.5 },
    { productId: 'sculpture-tee', variantId: scuM.id, quantity: -2 },
    { productId: 'sculpture-tee', variantId: scuL.id, quantity: 9 },
  ]);
  assert.deepEqual(cart.parseStoredCart(raw), [{ productId: 'sculpture-tee', variantId: scuL.id, quantity: 2 }]);
});

test('duplicate stored rows merge and legacy size-based lines migrate', () => {
  const raw = JSON.stringify([
    { productId: 'sculpture-tee', variantId: scuM.id, quantity: 2 },
    { productId: 'sculpture-tee', variantId: scuM.id, quantity: 3 },
    { productId: 'pit-lane-tee', size: 'S', quantity: 1 },
  ]);
  assert.deepEqual(cart.parseStoredCart(raw), [
    { productId: 'sculpture-tee', variantId: scuM.id, quantity: 5 },
    { productId: 'pit-lane-tee', variantId: pitS.id, quantity: 1 },
  ]);
});

test('resolved lines carry no stored product copies and point at the product page', () => {
  const [view] = cart.resolveCart([{ productId: 'pit-lane-tee', variantId: pitS.id, quantity: 1 }]);
  assert.equal(view.href, '/product/pit-lane-tee');
  assert.equal(view.variant.size, 'S');
  assert.ok(view.image && view.image.src.endsWith('.webp'));
  assert.deepEqual(cart.resolveCart([{ productId: 'gone', variantId: 'x', quantity: 1 }]), []);
});

test('pre-checkout validation reports unavailable and over-stock lines', () => {
  const lines = [
    { productId: 'sculpture-tee', variantId: scuXL.id, quantity: 1 },
    { productId: 'sculpture-tee', variantId: scuL.id, quantity: 4 },
    { productId: 'sculpture-tee', variantId: scuM.id, quantity: 1 },
  ];
  assert.deepEqual(cart.validateCart(lines), [
    { itemId: scuXL.id, kind: 'unavailable', available: 0 },
    { itemId: scuL.id, kind: 'reduced', available: 2 },
  ]);
});
