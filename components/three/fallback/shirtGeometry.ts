import Delaunator from "delaunator";
import { BufferGeometry, Float32BufferAttribute, Shape, TubeGeometry, CatmullRomCurve3, Vector2, Vector3 } from "three";

/**
 * TEMPORARY PROCEDURAL T-SHIRT
 * ---------------------------------------------------------------------------
 * Builds a worn, "ghost mannequin" tee from a flat silhouette: the outline is
 * densely triangulated, then front and back panels are wrapped around a rounded
 * torso and two tube sleeves. Hem and cuffs stay open; side seams, shoulders
 * and underarms close. Cloth simulation adds the live drape on top.
 * Everything here is disposable once /public/models/tshirt.glb exists.
 *
 * Local units: the shirt is ~1.0 tall (hem y = -0.5) and ~1.25 wide.
 */

type Point = readonly [number, number];

interface Corner {
  x: number;
  y: number;
  r: number;
}

// Counter-clockwise, starting at the left hem. Radii soften each corner.
const HALF: Corner[] = [
  { x: 0.35, y: -0.5, r: 0.02 },       // hem, side
  { x: 0.33, y: 0.12, r: 0.05 },       // underarm
  { x: 0.44, y: -0.06, r: 0.025 },     // cuff, lower (natural downward drape)
  { x: 0.52, y: 0.05, r: 0.025 },      // cuff, upper (relaxed drop-shoulder angle)
  { x: 0.39, y: 0.37, r: 0.06 },       // shoulder drop
  { x: 0.28, y: 0.44, r: 0.05 },       // shoulder high
  { x: 0.13, y: 0.475, r: 0.02 },      // neck side
];

const CORNERS: Corner[] = [
  { x: -0.35, y: -0.5, r: 0.02 },
  ...HALF,
  { x: 0, y: 0.43, r: 0.11 }, // back neckline
  ...HALF.slice()
    .reverse()
    .map((c) => ({ ...c, x: -c.x })),
].filter((c, i, all) => i === 0 || !(c.x === all[0].x && c.y === all[0].y));

function buildOutlineShape(): Shape {
  const n = CORNERS.length;
  const pts = CORNERS.map((c) => new Vector2(c.x, c.y));
  // Clamp radii so neighbouring rounds never overlap on short edges.
  const radii = CORNERS.map((c) => c.r);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const len = pts[i].distanceTo(pts[j]);
    const sum = radii[i] + radii[j];
    if (sum > len * 0.95) {
      const k = (len * 0.95) / sum;
      radii[i] *= k;
      radii[j] *= k;
    }
  }
  const shape = new Shape();
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const inDir = new Vector2().subVectors(prev, cur).normalize();
    const outDir = new Vector2().subVectors(next, cur).normalize();
    const a = cur.clone().addScaledVector(inDir, radii[i]);
    const b = cur.clone().addScaledVector(outDir, radii[i]);
    if (i === 0) shape.moveTo(a.x, a.y);
    else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(cur.x, cur.y, b.x, b.y);
  }
  shape.closePath();
  return shape;
}

function pointInPolygon(x: number, y: number, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToPolyline(x: number, y: number, poly: Point[]): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const px = ax + t * dx - x;
    const py = ay + t * dy - y;
    const d = px * px + py * py;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

function distanceToSegment(x: number, y: number, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y);
}

const smoothstep = (e0: number, e1: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Front neckline: an ellipse dipping below the back neckline.
const NECK = { cx: 0, cy: 0.478, rx: 0.132, ry: 0.13 };
const neckRadius = (x: number, y: number) =>
  Math.hypot((x - NECK.cx) / NECK.rx, (y - NECK.cy) / NECK.ry);

interface Fold {
  a: Point;
  b: Point;
  width: number;
  depth: number;
}

// Drape: valleys (negative) and ridges (positive). Slightly asymmetric on purpose.
const FOLDS: Fold[] = [
  // Underarm tension draping across chest
  { a: [0.32, 0.12], b: [0.12, -0.15], width: 0.08, depth: -0.014 },
  { a: [-0.32, 0.12], b: [-0.12, -0.15], width: 0.08, depth: -0.014 },
  // Vertical gravity drape from chest to lower body
  { a: [0.18, 0.02], b: [0.14, -0.42], width: 0.06, depth: 0.012 },
  { a: [-0.18, 0.02], b: [-0.14, -0.42], width: 0.06, depth: 0.012 },
  // Soft center valley
  { a: [0, 0.15], b: [0, -0.45], width: 0.09, depth: -0.008 },
  // Sleeve drape creases
  { a: [0.38, 0.32], b: [0.48, 0.02], width: 0.05, depth: -0.01 },
  { a: [-0.38, 0.32], b: [-0.48, 0.02], width: 0.05, depth: -0.01 },
  // Hem ripple
  { a: [-0.3, -0.38], b: [0.3, -0.38], width: 0.04, depth: -0.006 },
];

/** Rich 3D sculpted torso volume. */
const TORSO = { depth: 0.058, hemDepth: 0.036, backScale: 0.92, round: 0.4 };
// Sleeve axis from armhole to cuff center, hanging down naturally.
const SLEEVE = { from: [0.35, 0.24] as Point, to: [0.48, -0.005] as Point, rootRadius: 0.055, cuffRadius: 0.042, flatten: 0.82 };

/** The cuff/hem borders are openings: those outline segments never close the tube. */
function openingWeight(x: number, y: number): number {
  const hem = 1 - smoothstep(-0.4985, -0.494, y);
  const cuff = distanceToSegment(Math.abs(x), y, [0.44, -0.06], [0.52, 0.05]);
  return Math.max(hem, (1 - smoothstep(0.002, 0.008, cuff)) * smoothstep(0.40, 0.45, Math.abs(x)));
}

export interface ShirtSurface {
  outline: Point[];
  /** Signed surface z at (x, y). side = 1 front, -1 back. */
  surfaceZ(x: number, y: number, side: 1 | -1): number;
}

function foldAt(x: number, y: number): number {
  let f = 0;
  for (const fold of FOLDS) {
    const d = distanceToSegment(x, y, fold.a, fold.b) / fold.width;
    f += fold.depth * Math.exp(-d * d);
  }
  // Ribbed hem band and sleeve cuffs sit slightly proud of the body.
  f += 0.004 * smoothstep(-0.455, -0.47, y) * smoothstep(-0.52, -0.49, y);
  const cuff = Math.min(
    distanceToSegment(x, y, [0.44, -0.06], [0.52, 0.05]),
    distanceToSegment(x, y, [-0.44, -0.06], [-0.52, 0.05]),
  );
  f += 0.0035 * (1 - smoothstep(0.02, 0.05, cuff));
  return f;
}

/** 0 inside the torso, 1 along the sleeve; `t` runs armhole (0) → cuff (1). */
function sleeveFrame(x: number, y: number) {
  const ax = Math.abs(x);
  const [fx, fy] = SLEEVE.from;
  const dx = SLEEVE.to[0] - fx, dy = SLEEVE.to[1] - fy;
  const length = Math.hypot(dx, dy);
  const t = ((ax - fx) * dx + (y - fy) * dy) / (length * length);
  const weight = smoothstep(-0.12, 0.22, t) * smoothstep(0.24, 0.33, ax) * smoothstep(-0.02, 0.1, y);
  const radius = SLEEVE.rootRadius + (SLEEVE.cuffRadius - SLEEVE.rootRadius) * Math.max(0, Math.min(1, t));
  return { weight, radius };
}

function createSurface(outline: Point[]): ShirtSurface {
  // Only closed borders (side seams, shoulders, underarms, neck) pull the panels together.
  const closed: Point[][] = [];
  let run: Point[] = [];
  for (let i = 0; i <= outline.length; i++) {
    const point = outline[i % outline.length];
    if (openingWeight(point[0], point[1]) > 0.01) {
      if (run.length > 1) closed.push(run);
      run = [];
    } else run.push(point);
  }
  if (run.length > 1) closed.push(run);
  const closedDistance = (x: number, y: number) => {
    let best = Infinity;
    for (const segment of closed) {
      for (let i = 1; i < segment.length; i++) best = Math.min(best, distanceToSegment(x, y, segment[i - 1], segment[i]));
    }
    return best;
  };

  return {
    outline,
    surfaceZ(x, y, side) {
      const sleeve = sleeveFrame(x, y);
      const torsoDepth = TORSO.hemDepth + (TORSO.depth - TORSO.hemDepth) * smoothstep(-0.5, 0.15, y);
      const depth = torsoDepth + (sleeve.radius * SLEEVE.flatten - torsoDepth) * sleeve.weight;
      const round = TORSO.round + (sleeve.radius - TORSO.round) * sleeve.weight;
      // Circular cross-section: steep at the seams, full depth in the middle.
      const e = Math.min(closedDistance(x, y) / round, 1);
      const dome = depth * Math.sqrt(1 - (1 - e) * (1 - e));
      // Drape folds push along the surface normal, a little softer on the back.
      const fold = foldAt(side === 1 ? x : -x, y) * (side === 1 ? 1 : 0.7);
      let z = side * (dome * (side === 1 ? 1 : TORSO.backScale) + fold);
      if (side === 1) {
        // Inside the front neckline we see the inner back panel.
        // A wider transition lets the front panel roll over the collar instead of stepping.
        const back = -(dome * TORSO.backScale) + 0.006;
        z = back + (z - back) * smoothstep(0.86, 1.1, neckRadius(x, y));
      }
      return z;
    },
  };
}

export interface ShirtGeometrySet {
  body: BufferGeometry;
  collar: BufferGeometry;
  rims: BufferGeometry;
  surface: ShirtSurface;
  bounds: { minY: number; maxY: number; size: number };
}

export function buildShirtGeometry(quality: "high" | "low", proxySpacing?: number): ShirtGeometrySet {
  const shape = buildOutlineShape();
  const outlineCount = proxySpacing ? Math.ceil(4.2 / proxySpacing) : quality === "high" ? 300 : 180;
  const spacing = proxySpacing ?? (quality === "high" ? 0.017 : 0.028);

  const outline: Point[] = shape
    .getSpacedPoints(outlineCount)
    .slice(0, outlineCount)
    .map((p) => [p.x, p.y] as Point);
  const surface = createSurface(outline);

  // 1. Point cloud: outline first (shared by front and back), then interior grid.
  const coords: number[] = [];
  for (const [x, y] of outline) coords.push(x, y);
  let seed = 7;
  const jitter = () => {
    seed = (seed * 16807) % 2147483647;
    return ((seed / 2147483647) - 0.5) * spacing * 0.2;
  };
  for (let y = -0.5 + spacing * 0.5; y < 0.5; y += spacing) {
    for (let x = -0.62; x < 0.62; x += spacing) {
      const px = x + jitter();
      const py = y + jitter();
      if (!pointInPolygon(px, py, outline)) continue;
      if (distanceToPolyline(px, py, outline) < spacing * 0.6) continue;
      coords.push(px, py);
    }
  }
  const pointCount = coords.length / 2;
  const interiorCount = pointCount - outlineCount;

  // 2. Triangulate and keep triangles that lie inside the silhouette.
  const { triangles } = new Delaunator(coords);
  const kept: number[] = [];
  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i];
    const b = triangles[i + 1];
    const c = triangles[i + 2];
    const cx = (coords[a * 2] + coords[b * 2] + coords[c * 2]) / 3;
    const cy = (coords[a * 2 + 1] + coords[b * 2 + 1] + coords[c * 2 + 1]) / 3;
    if (!pointInPolygon(cx, cy, outline)) continue;
    // Orient counter-clockwise so front faces point towards +z.
    const area =
      (coords[b * 2] - coords[a * 2]) * (coords[c * 2 + 1] - coords[a * 2 + 1]) -
      (coords[c * 2] - coords[a * 2]) * (coords[b * 2 + 1] - coords[a * 2 + 1]);
    if (Math.abs(area) < 1e-9) continue;
    if (area > 0) kept.push(a, b, c);
    else kept.push(a, c, b);
  }

  // 3. Build front + back surfaces that share the outline vertices (watertight seam).
  const openBack = new Map<number, number>();
  let vertexCount = outlineCount + interiorCount * 2;
  for (let i = 0; i < outlineCount; i++) {
    if (openingWeight(coords[i * 2], coords[i * 2 + 1]) > 0.01) openBack.set(i, vertexCount++);
  }
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  const frontIndex = (i: number) => i;
  const backIndex = (i: number) => (i < outlineCount ? (openBack.get(i) ?? i) : i + interiorCount);

  const writeVertex = (target: number, x: number, y: number, side: 1 | -1) => {
    const z = surface.surfaceZ(x, y, side);
    positions.set([x, y, z], target * 3);
    uvs.set([(x + 0.65) / 1.3, (y + 0.55) / 1.1], target * 2);

    // Baked ambient occlusion: darker in fold valleys, armpits and inside the neck.
    let ao = 1 + Math.min(foldAt(x, y), 0.008) * 12;
    const armpit = Math.min(Math.hypot(x - 0.33, y - 0.12), Math.hypot(x + 0.33, y - 0.12));
    ao *= 0.72 + 0.28 * smoothstep(0.0, 0.12, armpit);
    if (side === 1) ao *= 0.45 + 0.55 * smoothstep(0.9, 1.15, neckRadius(x, y));
    colors.set([ao, ao, ao], target * 3);
  };

  for (let i = 0; i < pointCount; i++) {
    const x = coords[i * 2];
    const y = coords[i * 2 + 1];
    writeVertex(frontIndex(i), x, y, 1);
    if (i >= outlineCount || openBack.has(i)) writeVertex(backIndex(i), x, y, -1);
  }

  const index: number[] = [];
  for (let i = 0; i < kept.length; i += 3) {
    const [a, b, c] = [kept[i], kept[i + 1], kept[i + 2]];
    index.push(frontIndex(a), frontIndex(b), frontIndex(c));
    index.push(backIndex(a), backIndex(c), backIndex(b));
  }

  const body = new BufferGeometry();
  body.setAttribute("position", new Float32BufferAttribute(positions, 3));
  body.setAttribute("color", new Float32BufferAttribute(colors, 3));
  body.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  body.setIndex(index);
  body.computeVertexNormals();
  body.computeBoundingBox();
  body.computeBoundingSphere();

  // 4. Ribbed collar following the front neckline.
  const collarPoints: Vector3[] = [];
  const steps = 48;
  const startAngle = Math.PI + 0.12;
  const endAngle = Math.PI * 2 - 0.12;
  for (let s = 0; s <= steps; s++) {
    const ang = startAngle + ((endAngle - startAngle) * s) / steps;
    const x = NECK.cx + Math.cos(ang) * NECK.rx * 1.02;
    const y = NECK.cy + Math.sin(ang) * NECK.ry * 1.02;
    // Height of the front panel just outside the opening, so the rib sits on top.
    const hx = NECK.cx + Math.cos(ang) * NECK.rx * 1.14;
    const hy = NECK.cy + Math.sin(ang) * NECK.ry * 1.14;
    collarPoints.push(new Vector3(x, y, surface.surfaceZ(hx, hy, 1) - 0.006));
  }
  const collar = new TubeGeometry(
    new CatmullRomCurve3(collarPoints),
    quality === "high" ? 96 : 48,
    0.014,
    quality === "high" ? 10 : 6,
    false,
  );

  const box = body.boundingBox!;
  // A folded 2.5 mm lip gives the open sleeve and hem borders actual thickness.
  // It shares the garment's deformation binding, including both inside faces.
  const rimPositions: number[] = [], rimIndex: number[] = [];
  for (let i = 0; i < outlineCount; i++) {
    const j = (i + 1) % outlineCount;
    if (!openBack.has(i) || !openBack.has(j)) continue;
    for (const side of [1, -1] as const) {
      const start = rimPositions.length / 3;
      for (const vertex of [i, j]) {
        const x = coords[vertex * 2], y = coords[vertex * 2 + 1];
        const z = surface.surfaceZ(x, y, side);
        rimPositions.push(x, y, z, x, y + 0.003, z - side * 0.0025);
      }
      rimIndex.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
    }
  }
  const rims = new BufferGeometry();
  rims.setAttribute("position", new Float32BufferAttribute(rimPositions, 3));
  rims.setIndex(rimIndex); rims.computeVertexNormals();
  return {
    body,
    collar,
    rims,
    surface,
    bounds: {
      minY: box.min.y,
      maxY: box.max.y,
      size: Math.max(box.max.x - box.min.x, box.max.y - box.min.y),
    },
  };
}

/** A subdivided plane that hugs one side of the shirt, for printed graphics. */
export function buildPrintGeometry(
  surface: ShirtSurface,
  options: { width: number; height: number; centerX: number; centerY: number; side: 1 | -1 },
): BufferGeometry {
  const { width, height, centerX, centerY, side } = options;
  const segX = 28;
  const segY = Math.max(8, Math.round((segX * height) / width));
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (let j = 0; j <= segY; j++) {
    for (let i = 0; i <= segX; i++) {
      const u = i / segX;
      const v = j / segY;
      // Back prints are mirrored so they read correctly once the shirt turns.
      const x = centerX + (u - 0.5) * width * side;
      const y = centerY + (v - 0.5) * height;
      positions.push(x, y, surface.surfaceZ(x, y, side) + side * 0.0035);
      uvs.push(u, v);
    }
  }
  for (let j = 0; j < segY; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * (segX + 1) + i;
      const b = a + 1;
      const c = a + segX + 1;
      const d = c + 1;
      index.push(a, b, d, a, d, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** A sewn coarse surface, generated directly instead of collapsing the thin
 * front/back panels into voxel clusters around cuffs and seams. */
export function buildShirtPhysicsTopology(spacing: number) {
  const proxy = buildShirtGeometry("low", spacing);
  proxy.body.scale(1 / proxy.bounds.size, 1 / proxy.bounds.size, 1 / proxy.bounds.size);
  const positions = new Float32Array(proxy.body.getAttribute("position").array);
  const triangles = new Uint32Array(proxy.body.index!.array);
  proxy.body.dispose(); proxy.collar.dispose(); proxy.rims.dispose();
  return { positions, triangles };
}
