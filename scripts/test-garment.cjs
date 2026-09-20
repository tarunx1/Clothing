/* eslint-disable @typescript-eslint/no-require-imports */
// Minimal Node test harness for the pure TS solver; uses the installed TypeScript
// compiler and adds no test/runtime dependencies to the browser bundle.
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
const { Matrix4, Vector3 } = require('three');
const { GARMENT_QUALITY, garmentPhysics } = require('../config/garmentPhysics.ts');
const { buildShirtGeometry, buildShirtPhysicsTopology } = require('../components/three/fallback/shirtGeometry.ts');
const { ClothSimulation } = require('../components/three/tshirt/physics/ClothSimulation.ts');
const { ClothBending } = require('../components/three/tshirt/physics/ClothBending.ts');
const { ClothMeshBinding } = require('../components/three/tshirt/physics/ClothMeshBinding.ts');
const { topologyGeometry } = require('../components/three/tshirt/physics/ClothProxy.ts');

const garment = buildShirtGeometry('high');
garment.body.scale(1 / garment.bounds.size, 1 / garment.bounds.size, 1 / garment.bounds.size);
const topology = buildShirtPhysicsTopology(GARMENT_QUALITY.low.proxyCell);
const identity = new Matrix4();

function maxDifference(a, b) {
  let max = 0;
  for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i]));
  return max;
}
function peakStretch(sim) {
  let max = 0;
  const { pairs, rest, compliance } = sim.constraints, p = sim.positions;
  for (let k = 0; k < rest.length; k++) {
    if (compliance[k] > 1e-6) continue;
    const a = pairs[k * 2] * 3, b = pairs[k * 2 + 1] * 3;
    max = Math.max(max, Math.hypot(p[a] - p[b], p[a + 1] - p[b + 1], p[a + 2] - p[b + 2]) / (rest[k] * sim.anchors.scale));
  }
  return max;
}

test('30, 60 and 120 Hz displays produce the same fixed-step resting cloth', () => {
  const results = [];
  for (const fps of [30, 60, 120]) {
    const sim = new ClothSimulation(topology, 'low');
    sim.reset(identity);
    for (let i = 0; i < fps * 2; i++) sim.advance(1 / fps, identity);
    results.push(sim.positions);
  }
  assert.ok(maxDifference(results[0], results[1]) < 1e-6);
  assert.ok(maxDifference(results[1], results[2]) < 1e-6);
});

test('large tab-restoration deltas are bounded to three physics ticks', () => {
  const sim = new ClothSimulation(topology, 'low');
  sim.reset(identity);
  const before = sim.time;
  sim.advance(120, identity);
  assert.ok(Math.abs(sim.time - before - 0.05) < 1e-6);
  assert.equal(sim.resets, 0);
});

test('signed bending restores a perturbed fold without flipping its side', () => {
  const p = new Float32Array([0, 1, 0, 0, -1, 0.1, -1, 0, 0, 1, 0, 0]);
  const bending = new ClothBending({ positions: p, triangles: new Uint32Array([2, 3, 0, 3, 2, 1]) });
  const angle = () => {
    const a = new Vector3().fromArray(p, 0), b = new Vector3().fromArray(p, 3), c = new Vector3().fromArray(p, 6), d = new Vector3().fromArray(p, 9);
    const edge = d.clone().sub(c).normalize();
    const n0 = c.clone().sub(a).cross(d.clone().sub(a)).normalize();
    const n1 = d.clone().sub(b).cross(c.clone().sub(b)).normalize();
    return Math.atan2(n0.clone().cross(n1).dot(edge), n0.dot(n1));
  };
  const rest = angle(); p[5] = 0.65;
  for (let i = 0; i < 30; i++) { bending.lambda.fill(0); bending.solve(p, new Float32Array([1, 1, 1, 1]), 1 / 60, 1e-6, 1); }
  assert.ok(Math.abs(angle() - rest) < 1e-4);
});

test('shoulders lead the torso and hem, and residual motion dissipates', () => {
  const sim = new ClothSimulation(topology, 'low');
  sim.reset(identity);
  const target = new Matrix4().makeRotationY(0.3).setPosition(0.12, 0, 0);
  for (let i = 0; i < 6; i++) sim.advance(1 / 60, target, 2);
  const reference = new Vector3(), actual = new Vector3();
  let shoulder = 0, hem = 0, count = 0;
  for (const i of sim.anchors.indices) shoulder += reference.fromArray(topology.positions, i * 3).applyMatrix4(sim.anchors.matrix).distanceTo(actual.fromArray(sim.positions, i * 3));
  shoulder /= sim.anchors.indices.length;
  for (let i = 0; i < topology.positions.length; i += 3) if (topology.positions[i + 1] < -0.3) {
    hem += reference.fromArray(topology.positions, i).applyMatrix4(sim.anchors.matrix).distanceTo(actual.fromArray(sim.positions, i)); count++;
  }
  assert.ok(hem / count > shoulder * 2, 'hem must lag the suspension, not move rigidly');
  const movingSpeed = Math.max(...sim.velocities.map(Math.abs));
  for (let i = 0; i < 300; i++) sim.advance(1 / 60, target);
  assert.ok(Math.max(...sim.velocities.map(Math.abs)) < movingSpeed * 0.02, 'motion must settle');
});

for (const quality of ['high', 'medium', 'low']) test(`${quality}: rapid reversals remain finite and cotton resists stretching`, () => {
  const proxy = buildShirtPhysicsTopology(GARMENT_QUALITY[quality].proxyCell);
  // Fine enough for sleeve and hem folds, bounded for the main thread.
  assert.ok(proxy.positions.length / 3 < 1000, `proxy particles ${proxy.positions.length / 3}`);
  const sim = new ClothSimulation(proxy, quality);
  sim.reset(identity);
  const target = new Matrix4();
  let max = 0;
  for (let i = 0; i < 180; i++) {
    target.makeRotationY(Math.floor(i / 30) % 2 ? Math.PI : 0);
    sim.advance(1 / 60, target, i % 60 < 30 ? 1000 : -1000);
    max = Math.max(max, peakStretch(sim));
  }
  assert.equal(sim.resets, 0);
  assert.ok(sim.positions.every(Number.isFinite));
  assert.ok(max < 1.12, `peak transient strain ${max}`);
});

test('surface transfer preserves render detail under a rigid reference rotation', () => {
  const render = garment.body.clone();
  const original = render.getAttribute('position').array.slice();
  const binding = new ClothMeshBinding(render, topology);
  const proxy = topologyGeometry(topology), matrix = new Matrix4().makeRotationY(0.9).setPosition(1, 2, 0);
  proxy.applyMatrix4(matrix); proxy.computeVertexNormals();
  binding.update(proxy.getAttribute('position').array, proxy.getAttribute('normal').array, 1);
  const expected = new Float32Array(original.length), point = new Vector3();
  for (let i = 0; i < original.length; i += 3) point.fromArray(original, i).applyMatrix4(matrix).toArray(expected, i);
  assert.ok(maxDifference(expected, render.getAttribute('position').array) < 0.0001, 'collar, surface and print offsets must rotate with fabric');
  render.dispose(); proxy.dispose();
});

function nearestFront(sim, x, y) {
  let best = -1, distance = Infinity;
  const r = sim.topology.positions;
  for (let i = 0; i < r.length / 3; i++) {
    if (r[i * 3 + 2] <= 0.004) continue;
    const d = Math.hypot(r[i * 3] - x, r[i * 3 + 1] - y);
    if (d < distance) { best = i; distance = d; }
  }
  return best;
}

test('mouse hand dents the fabric under the cursor and the cloth recovers when it leaves', () => {
  const sim = new ClothSimulation(topology, 'low');
  sim.reset(identity);
  const chest = nearestFront(sim, 0.02, -0.05);
  const rest = sim.positions[chest * 3 + 2];
  const origin = new Vector3(topology.positions[chest * 3], topology.positions[chest * 3 + 1], 4);
  for (let i = 0; i < 40; i++) { sim.pointer.setRay(origin, new Vector3(0, 0, -1)); sim.advance(1 / 60, identity); }
  const dent = rest - sim.positions[chest * 3 + 2];
  assert.ok(dent > 0.0001, `cursor should press a visible dent, got ${dent}`);
  assert.ok(dent < 0.025, 'a stationary cursor must not keep digging into the shirt');
  sim.pointer.clearRay();
  for (let i = 0; i < 240; i++) sim.advance(1 / 60, identity);
  assert.ok(Math.abs(rest - sim.positions[chest * 3 + 2]) < dent * 0.35, 'fabric springs back once the cursor leaves');
});

test('moving the cursor gently disturbs fabric in the stroke direction', () => {
  const sim = new ClothSimulation(topology, 'low');
  sim.reset(identity);
  const probe = nearestFront(sim, 0.0, -0.2);
  const startX = sim.positions[probe * 3];
  for (let i = 0; i <= 20; i++) {
    sim.pointer.setRay(new Vector3(-0.12 + i * 0.012, topology.positions[probe * 3 + 1], 4), new Vector3(0, 0, -1));
    sim.advance(1 / 60, identity);
  }
  assert.ok(sim.positions[probe * 3] - startX > 0.0001, `fabric should follow the stroke, moved ${sim.positions[probe * 3] - startX}`);
  assert.equal(sim.resets, 0);
});

test('cursor directly moves the near panel without grabbing the back panel', () => {
  const sim = new ClothSimulation(topology, 'low');
  const hand = sim.pointer;
  hand.center.set(0, 0, 0);
  hand.direction.set(0, 0, -1);
  hand.velocity.set(1, 0, 0);
  hand.strength = 1;
  const depth = garmentPhysics.pointerRadius - garmentPhysics.pointerPress;
  const panels = new Float32Array([0, 0, -depth, 0, 0, -depth - 0.04]);
  const before = panels.slice();
  hand.solve(panels, new Float32Array([1, 1]), 1 / 60, 1, garmentPhysics);
  assert.ok(panels[0] > 0, 'near fabric follows the stroke');
  assert.deepEqual(panels.slice(3), before.slice(3), 'back fabric responds through cloth constraints, not direct cursor force');
});

test('unworn shirt has a narrow air gap instead of a torso-shaped volume', () => {
  const p = garment.body.getAttribute('position');
  let front = -Infinity, back = Infinity;
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < 0.15 && p.getY(i) < 0.15) {
    front = Math.max(front, p.getZ(i)); back = Math.min(back, p.getZ(i));
  }
  assert.ok(front - back < 0.065, `inflated torso depth ${front - back}`);
});

for (const quality of ['high', 'medium', 'low']) test(`${quality}: stationary cloth settles without high-frequency buzzing`, () => {
  const rest = buildShirtPhysicsTopology(GARMENT_QUALITY[quality].proxyCell);
  const sim = new ClothSimulation(rest, quality); sim.reset(identity);
  for (let i = 0; i < 360; i++) sim.advance(1 / 60, identity);
  let peak = 0;
  for (let i = 0; i < 120; i++) {
    const previous = sim.positions.slice(); sim.advance(1 / 60, identity);
    peak = Math.max(peak, maxDifference(previous, sim.positions));
  }
  assert.ok(peak < 0.0003, `idle frame displacement ${peak}`);
});

test('cotton buckles: compression is far softer than stretch', () => {
  const sim = new ClothSimulation(topology, 'low');
  const { compliance, compression } = sim.constraints;
  let checked = 0;
  for (let k = 0; k < compliance.length; k++) if (compliance[k] <= 2.01e-8) { assert.ok(compression[k] > compliance[k] * 50); checked++; }
  assert.ok(checked > 0);
});

test('120 Hz rendering moves smoothly between the 60 Hz physics ticks', () => {
  const sim = new ClothSimulation(topology, 'low'); sim.reset(identity);
  const target = new Matrix4().makeRotationY(0.1).setPosition(0.04, 0, 0);
  sim.advance(1 / 60, target);
  const first = sim.interpolate().slice(), physics = sim.positions.slice();
  sim.advance(1 / 120, target);
  assert.equal(maxDifference(physics, sim.positions), 0, 'no extra physics tick should run');
  assert.ok(maxDifference(first, sim.interpolate()) > 0.00001, 'display must advance between ticks instead of juddering');
});

for (const quality of ['high', 'medium', 'low']) test(`${quality}: rapid return from the exit keeps torso aligned with shoulders`, () => {
  const mesh = buildShirtPhysicsTopology(GARMENT_QUALITY[quality].proxyCell);
  const sim = new ClothSimulation(mesh, quality);
  const exit = new Matrix4().makeRotationY(Math.PI).scale(new Vector3(0.65, 0.65, 0.65)).setPosition(0, 0, -2);
  sim.reset(exit);
  const local = new Vector3(), rest = new Vector3(), inverse = new Matrix4();
  let peak = 0;
  for (let frame = 0; frame < 150; frame++) {
    sim.advance(1 / 60, identity, -3);
    inverse.copy(sim.anchors.matrix).invert();
    for (let i = 0; i < mesh.positions.length; i += 3) {
      rest.fromArray(mesh.positions, i);
      if (rest.y > -0.1 || Math.abs(rest.x) > 0.2) continue;
      local.fromArray(sim.positions, i).applyMatrix4(inverse);
      peak = Math.max(peak, Math.hypot(local.x - rest.x, local.z - rest.z));
    }
  }
  assert.ok(peak < 0.1, `torso must follow the turn without winding around the shoulders: ${peak}`);
  assert.equal(sim.resets, 0);
});
