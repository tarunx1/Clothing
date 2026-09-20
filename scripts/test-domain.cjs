/* eslint-disable @typescript-eslint/no-require-imports */
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
const order = require('../lib/domain/order.ts');

test('order totals use integer-safe amounts supplied by the domain', () => {
  assert.deepEqual(order.calculateOrderTotals(5600, 450, 'INR', 0, 100), {
    subtotal: 5600, shipping: 450, tax: 0, discount: 100, total: 5950, currency: 'INR',
  });
});

test('order item snapshot freezes price and calculates line total', () => {
  assert.deepEqual(order.snapshotOrderItem({ productName: 'Sculpture Tee', sku: 'SCU-WASH-M', sizeName: 'M', colorName: 'Washed black', unitPrice: 2800, quantity: 2 }), {
    productName: 'Sculpture Tee', sku: 'SCU-WASH-M', sizeName: 'M', colorName: 'Washed black', unitPrice: 2800, quantity: 2, lineTotal: 5600,
  });
});

test('requested quantity rejects non-whole and unavailable amounts', () => {
  assert.equal(order.validateRequestedQuantity(2, 3), 2);
  assert.throws(() => order.validateRequestedQuantity(0, 3), (error) => error.code === 'INVALID_QUANTITY');
  assert.throws(() => order.validateRequestedQuantity(4, 3), (error) => error.code === 'OUT_OF_STOCK' && error.details.available === 3);
});
