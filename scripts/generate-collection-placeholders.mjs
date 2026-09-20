/**
 * Generates TEMPORARY monochrome collection frames so the Collection Explorer
 * can be designed and tested before real photography exists.
 *
 *   node scripts/generate-collection-placeholders.mjs          # only missing files
 *   node scripts/generate-collection-placeholders.mjs --force  # overwrite
 *
 * Output: public/images/collections/<slug>/<nn>.webp (1000 × 1500, 2:3).
 * Replace these files with real imagery at any time; nothing else changes.
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const W = 1000;
const H = 1500;
const OUT = path.resolve("public/images/collections");
const force = process.argv.includes("--force");

const INK = "#0b0b0b";
const BONE = "#e8e6e1";
const ASH = "#1d1d1d";
const STONE = "#b9b6af";

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const grain = (opacity = 0.12) => `
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4"/>
  <feColorMatrix type="saturate" values="0"/></filter>
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="${opacity}"/>`;

const code = (label, fg) => `
  <text x="48" y="${H - 52}" font-family="Helvetica Neue, Helvetica, Arial" font-size="22" letter-spacing="3" fill="${fg}" opacity="0.55">${label}</text>
  <text x="${W - 48}" y="${H - 52}" text-anchor="end" font-family="Helvetica Neue, Helvetica, Arial" font-size="22" letter-spacing="3" fill="${fg}" opacity="0.55">TEMP FRAME</text>`;

const frame = (bg, fg, body, label) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${bg}"/>${body(fg, bg)}${grain()}${code(label, fg)}</svg>`;

// ---------------------------------------------------------------- Greek
const greek = [
  (fg) => {
    let s = `<rect x="140" y="170" width="720" height="70" fill="${fg}"/><rect x="180" y="250" width="640" height="34" fill="${fg}"/>`;
    for (let i = 0; i < 9; i++) {
      const x = 200 + i * 67;
      s += `<rect x="${x}" y="300" width="44" height="1060" rx="22" fill="${fg}" opacity="${0.55 + (i % 3) * 0.15}"/>`;
    }
    return s + `<rect x="160" y="1360" width="680" height="40" fill="${fg}"/>`;
  },
  (fg) => {
    let s = "";
    const u = 70;
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        const x = 150 + col * 150;
        const y = 170 + row * 170;
        s += `<path d="M${x} ${y + u * 1.6} V${y} H${x + u * 1.6} V${y + u * 1.2} H${x + u * 0.6} V${y + u * 0.6} H${x + u} " fill="none" stroke="${fg}" stroke-width="22" stroke-linecap="square"/>`;
      }
    }
    return s;
  },
  (fg) => {
    let s = "";
    for (let r = 420; r > 60; r -= 38) s += `<circle cx="500" cy="700" r="${r}" fill="none" stroke="${fg}" stroke-width="3" opacity="0.5"/>`;
    return s + `<text x="500" y="930" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="640" fill="${fg}">Ω</text>`;
  },
  (fg) => {
    let s = "";
    for (let i = 0; i < 3; i++) {
      const x = 150 + i * 240;
      s += `<path d="M${x} 1350 V620 A120 120 0 0 1 ${x + 240} 620 V1350" fill="none" stroke="${fg}" stroke-width="34"/>`;
    }
    return s + `<rect x="120" y="300" width="760" height="18" fill="${fg}"/><rect x="120" y="350" width="760" height="6" fill="${fg}"/>`;
  },
];

// ---------------------------------------------------------------- Anime
const anime = [
  (fg) => {
    const r = rng(11);
    let s = "";
    for (let i = 0; i < 140; i++) {
      const a = (i / 140) * Math.PI * 2 + r() * 0.02;
      const w = 0.004 + r() * 0.012;
      const inner = 230 + r() * 160;
      const p = (ang, rad) => `${500 + Math.cos(ang) * rad} ${760 + Math.sin(ang) * rad * 1.35}`;
      s += `<path d="M${p(a - w, 1400)} L${p(a, inner)} L${p(a + w, 1400)} Z" fill="${fg}"/>`;
    }
    return s;
  },
  (fg) => {
    let s = "";
    for (let y = 0; y < 30; y++) {
      for (let x = 0; x < 20; x++) {
        const t = (x / 20 + y / 30) / 2;
        s += `<circle cx="${25 + x * 50}" cy="${25 + y * 50}" r="${Math.max(0, 23 * Math.pow(t, 1.4))}" fill="${fg}"/>`;
      }
    }
    return s;
  },
  (fg) => {
    const r = rng(29);
    let s = "";
    for (let i = 0; i < 46; i++) {
      const y = 80 + r() * 1340;
      const x = r() * 400;
      s += `<rect x="${x}" y="${y}" width="${300 + r() * 700}" height="${2 + r() * 9}" fill="${fg}" opacity="${0.4 + r() * 0.6}"/>`;
    }
    return s + `<path d="M120 1180 L880 380 L905 410 L150 1215 Z" fill="${fg}"/>`;
  },
  (fg) => {
    let pts = "";
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const rad = i % 2 ? 200 : 470;
      pts += `${500 + Math.cos(a) * rad},${720 + Math.sin(a) * rad} `;
    }
    return `<polygon points="${pts}" fill="${fg}"/><circle cx="500" cy="720" r="120" fill="none" stroke="${fg}" stroke-width="10"/>`;
  },
];

// ---------------------------------------------------------------- Superhero
const superhero = [
  (fg, bg) => `<polygon points="0,0 ${W},0 ${W},520 0,1100" fill="${fg}"/>
    <polygon points="560,260 300,820 480,820 380,1260 720,640 530,640 660,260" fill="${bg}"/>`,
  (fg) => `<path d="M500 230 L840 360 C840 820 700 1080 500 1250 C300 1080 160 820 160 360 Z" fill="none" stroke="${fg}" stroke-width="30"/>
    <path d="M500 350 L730 440 C730 790 630 990 500 1110 C370 990 270 790 270 440 Z" fill="${fg}"/>`,
  (fg, bg) => {
    const r = rng(7);
    let pts = "";
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rad = i % 2 ? 250 + r() * 60 : 420 + r() * 120;
      pts += `${500 + Math.cos(a) * rad},${740 + Math.sin(a) * rad} `;
    }
    let dots = "";
    for (let y = 0; y < 30; y++) for (let x = 0; x < 20; x++) dots += `<circle cx="${25 + x * 50}" cy="${25 + y * 50}" r="7" fill="${fg}" opacity="0.35"/>`;
    return `${dots}<polygon points="${pts}" fill="${fg}"/><polygon points="${pts}" fill="${bg}" transform="translate(500 740) scale(0.55) translate(-500 -740)"/>`;
  },
  (fg) => {
    const r = rng(3);
    let s = `<polygon points="500,0 180,${H} 820,${H}" fill="${fg}" opacity="0.18"/>`;
    let x = 0;
    while (x < W) {
      const w = 50 + r() * 110;
      const h = 250 + r() * 520;
      s += `<rect x="${x}" y="${H - h}" width="${w - 6}" height="${h}" fill="${fg}"/>`;
      x += w;
    }
    return s;
  },
];

// ---------------------------------------------------------------- Motorsport
const motorsport = [
  (fg) => {
    let s = "";
    for (let y = 0; y < 12; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 0) s += `<rect x="${x * 125}" y="${y * 125}" width="125" height="125" fill="${fg}"/>`;
    return `<g transform="translate(500 750) rotate(-12) skewX(-18) scale(1.5) translate(-500 -750)">${s}</g>`;
  },
  (fg, bg) => `<rect x="330" y="0" width="120" height="${H}" fill="${fg}"/><rect x="560" y="0" width="120" height="${H}" fill="${fg}"/>
    <circle cx="500" cy="720" r="230" fill="${bg}" stroke="${fg}" stroke-width="16"/>
    <text x="500" y="820" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial" font-weight="800" font-size="280" letter-spacing="-12" fill="${fg}">27</text>`,
  (fg) => {
    let s = `<path d="M170 980 A360 360 0 1 1 830 980" fill="none" stroke="${fg}" stroke-width="10"/>`;
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI * (0.78 + (i / 40) * 1.44);
      const r1 = i % 5 ? 320 : 290;
      s += `<line x1="${500 + Math.cos(a) * r1}" y1="${840 + Math.sin(a) * r1}" x2="${500 + Math.cos(a) * 350}" y2="${840 + Math.sin(a) * 350}" stroke="${fg}" stroke-width="${i % 5 ? 4 : 12}"/>`;
    }
    const n = Math.PI * 1.9;
    return s + `<line x1="500" y1="840" x2="${500 + Math.cos(n) * 300}" y2="${840 + Math.sin(n) * 300}" stroke="${fg}" stroke-width="16" stroke-linecap="round"/><circle cx="500" cy="840" r="36" fill="${fg}"/>`;
  },
  (fg, bg) => `<path d="M-100 ${H + 100} C 150 900 700 1000 1100 200" fill="none" stroke="${fg}" stroke-width="260"/>
    <path d="M-100 ${H + 100} C 150 900 700 1000 1100 200" fill="none" stroke="${bg}" stroke-width="18" stroke-dasharray="60 60"/>`,
];

// ---------------------------------------------------------------- Dark art
const darkArt = [
  (fg) => {
    let s = "";
    for (let r = 80; r < 470; r += 55) s += `<circle cx="500" cy="720" r="${r}" fill="none" stroke="${fg}" stroke-width="${r % 110 ? 2 : 7}"/>`;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      s += `<line x1="500" y1="720" x2="${500 + Math.cos(a) * 520}" y2="${720 + Math.sin(a) * 520}" stroke="${fg}" stroke-width="2"/>`;
    }
    return s + `<circle cx="500" cy="720" r="26" fill="${fg}"/>`;
  },
  (fg) => `<path d="M520 120 C 120 260 900 520 480 700 C 80 880 900 1060 460 1380" fill="none" stroke="${fg}" stroke-width="70" stroke-linecap="round"/>
    <circle cx="520" cy="120" r="46" fill="${fg}"/>`,
  (fg) => {
    const r = rng(21);
    let s = `<filter id="ink"><feGaussianBlur stdDeviation="14"/><feComponentTransfer><feFuncA type="discrete" tableValues="0 1"/></feComponentTransfer></filter><g filter="url(#ink)">`;
    for (let i = 0; i < 38; i++) s += `<circle cx="${250 + r() * 500}" cy="${300 + r() * 900}" r="${20 + r() * 110}" fill="${fg}"/>`;
    return s + "</g>";
  },
  (fg) => {
    const r = rng(9);
    let s = "";
    for (let i = 0; i < 9; i++) {
      let x = 500;
      let y = 760;
      let d = `M${x} ${y}`;
      const a0 = (i / 9) * Math.PI * 2;
      for (let k = 0; k < 14; k++) {
        const a = a0 + (r() - 0.5) * 0.9;
        x += Math.cos(a) * (30 + r() * 40);
        y += Math.sin(a) * (30 + r() * 40);
        d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      s += `<path d="${d}" fill="none" stroke="${fg}" stroke-width="${3 + r() * 6}"/>`;
    }
    return s;
  },
];

const COLLECTIONS = [
  { slug: "greek", code: "GRK", motifs: greek },
  { slug: "anime", code: "ANM", motifs: anime },
  { slug: "superhero", code: "SPR", motifs: superhero },
  { slug: "motorsport", code: "MTR", motifs: motorsport },
  { slug: "dark-art", code: "DRK", motifs: darkArt },
];

const PALETTES = [
  [INK, BONE],
  [BONE, INK],
  [ASH, STONE],
  [STONE, INK],
];

let written = 0;
for (const [ci, collection] of COLLECTIONS.entries()) {
  const dir = path.join(OUT, collection.slug);
  mkdirSync(dir, { recursive: true });
  for (const [i, motif] of collection.motifs.entries()) {
    const file = path.join(dir, `${String(i + 1).padStart(2, "0")}.webp`);
    if (existsSync(file) && !force) continue;
    const [bg, fg] = PALETTES[(i + ci) % PALETTES.length];
    const svg = frame(bg, fg, motif, `${collection.code} ${String(i + 1).padStart(2, "0")}`);
    await sharp(Buffer.from(svg)).webp({ quality: 78 }).toFile(file);
    written++;
  }
}
console.log(`Collection placeholders: ${written} file(s) written to ${path.relative(process.cwd(), OUT)}`);
