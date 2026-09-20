/* eslint-disable @typescript-eslint/no-require-imports */
// Catalog, variant and price-formatting behaviour behind the product page,
// shop and bag. Uses the installed TypeScript compiler; no test dependencies.
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
const lib = require('../lib/products.ts');
const { formatMoney } = require('../lib/money.ts');
const { filterProducts, emptyFilters } = require('../lib/shop.ts');
const { products } = require('../data/products.ts');

// A two-colour product, independent of the seed data.
const v = (color, hex, size, stock, extra = {}) => ({ id: `t-${color}-${size}`, sku: `T-${size}`, size, color, colorHex: hex, price: 3000, stock, enabled: true, ...extra });
const multi = {
  id: 't', slug: 't', name: 'Test Tee', description: 'x', price: 3000, currency: 'INR', collectionId: 'col-greek', releaseOrder: 1,
  images: [
    { id: 'b1', src: '/b.webp', alt: 'black', order: 2, color: 'Black' },
    { id: 's1', src: '/s.webp', alt: 'shared', order: 1 },
    { id: 'w1', src: '/w.webp', alt: 'bone', order: 3, color: 'Bone' },
  ],
  variants: [
    v('Black', '#111', 'L', 0), v('Black', '#111', 'S', 4), v('Black', '#111', 'M', 2),
    v('Bone', '#eee', 'M', 0), v('Bone', '#eee', 'XL', 7),
    v('Black', '#111', 'XL', 9, { enabled: false }),
  ],
};

test('slug lookup returns the product or null (never a fallback product)', async () => {
  assert.equal((await lib.getProductBySlug('pit-lane-tee')).id, 'pit-lane-tee');
  assert.equal(await lib.getProductBySlug('does-not-exist'), null);
});

test('every seed product has a unique slug, ordered images and enabled variants', () => {
  assert.equal(new Set(products.map((p) => p.slug)).size, products.length);
  for (const p of products) {
    assert.ok(p.images.length > 0, `${p.slug} has imagery`);
    assert.ok(lib.enabledVariants(p).length > 0, `${p.slug} has variants`);
    assert.ok(lib.getProductCollection(p), `${p.slug} belongs to a collection`);
  }
});

test('related products: curated first, never the product itself, bounded', async () => {
  for (const p of products) {
    const related = await lib.getRelatedProducts(p, 3);
    assert.ok(related.length <= 3);
    assert.ok(related.every((r) => r.id !== p.id));
  }
  const sculpture = products.find((p) => p.id === 'sculpture-tee');
  assert.deepEqual((await lib.getRelatedProducts(sculpture)).map((p) => p.id).slice(0, 2), ['voltage-tee', 'serpent-tee']);
});

test('sizes sort canonically and disabled variants are ignored', () => {
  assert.deepEqual(lib.productSizeList(multi), ['S', 'M', 'L', 'XL']);
  const black = lib.sizeOptions(multi, 'Black');
  assert.deepEqual(black.map((o) => [o.size, o.variant ? o.variant.stock : null]), [['S', 4], ['M', 2], ['L', 0], ['XL', null]]);
});

test('colours carry availability; the default colour has stock', () => {
  assert.deepEqual(lib.productColors(multi).map((c) => [c.name, c.available]), [['Black', true], ['Bone', true]]);
  assert.equal(lib.defaultColor(multi), 'Black');
  const soldOutBlack = { ...multi, variants: multi.variants.map((x) => (x.color === 'Black' ? { ...x, stock: 0 } : x)) };
  assert.equal(lib.defaultColor(soldOutBlack), 'Bone');
});

test('sold-out variants cannot be purchased; stock status never invents urgency', () => {
  const l = lib.findVariant(multi, 'Black', 'L');
  assert.equal(lib.isVariantAvailable(l), false);
  assert.equal(lib.stockStatus(l), 'sold-out');
  assert.equal(lib.stockStatus(lib.findVariant(multi, 'Black', 'M')), 'low-stock');
  assert.equal(lib.stockStatus(lib.findVariant(multi, 'Black', 'S')), 'in-stock');
  assert.equal(lib.findVariant(multi, 'Black', 'XL'), null, 'disabled variants are not offered');
  assert.equal(lib.findVariant(multi, 'Black', null), null);
});

test('colour-specific imagery wins, shared images follow, other colours are excluded', () => {
  assert.deepEqual(lib.productImages(multi, 'Black').map((i) => i.id), ['b1', 's1']);
  assert.deepEqual(lib.productImages(multi, 'Bone').map((i) => i.id), ['w1', 's1']);
  assert.deepEqual(lib.productImages(multi).map((i) => i.id), ['s1', 'b1', 'w1']);
});

test('a product with no stock anywhere is unavailable and drops out of in-stock filtering', () => {
  const serpent = products.find((p) => p.id === 'serpent-tee');
  assert.equal(lib.isProductAvailable(serpent), false);
  const filters = { ...emptyFilters(10000), inStock: true };
  assert.ok(!filterProducts(products, filters, 'featured').some((p) => p.id === 'serpent-tee'));
  const greek = { ...emptyFilters(10000), collections: ['greek'] };
  assert.deepEqual(filterProducts(products, greek, 'featured').map((p) => p.id), ['sculpture-tee']);
});

test('attributes derive from data, not hard-coded copy', () => {
  const pit = products.find((p) => p.id === 'pit-lane-tee');
  assert.deepEqual(lib.productAttributes(pit), ['260 GSM', '100% cotton', 'Boxy fit', 'Distressed high-density print']);
});

test('prices format per currency with Intl, whole units unless fractional', () => {
  assert.equal(formatMoney(2800, 'INR'), '₹2,800');
  assert.equal(formatMoney(125000, 'INR'), '₹1,25,000');
  assert.equal(formatMoney(49, 'CAD'), '$49');
  assert.equal(formatMoney(49.5, 'USD'), '$49.50');
});
