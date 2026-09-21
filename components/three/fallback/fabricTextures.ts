import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
} from "three";

/**
 * Procedural single-jersey cotton knit normal map:
 * Models interlocking V-stitch loops (wales and courses) with authentic
 * yarn fiber twist, combed cotton slub grain, and stitch tension relief.
 */
export function createKnitNormalMap(size: number = 512): DataTexture {
  const columns = size / 4;
  const rows = size / 4.4; // Courses are slightly squatter than wales
  const height = new Float32Array(size * size);

  // Value noise generator for organic yarn slub and fiber micro-variation
  const lattice = 64;
  const rand = new Float32Array(lattice * lattice);
  let seed = 42891;
  for (let i = 0; i < rand.length; i++) {
    seed = (seed * 16807) % 2147483647;
    rand[i] = seed / 2147483647;
  }
  const noise = (u: number, v: number) => {
    const x = ((u % 1 + 1) % 1) * lattice;
    const y = ((v % 1 + 1) % 1) * lattice;
    const x0 = Math.floor(x) % lattice;
    const y0 = Math.floor(y) % lattice;
    const x1 = (x0 + 1) % lattice;
    const y1 = (y0 + 1) % lattice;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = rand[y0 * lattice + x0] + (rand[y0 * lattice + x1] - rand[y0 * lattice + x0]) * sx;
    const bottom = rand[y1 * lattice + x0] + (rand[y1 * lattice + x1] - rand[y1 * lattice + x0]) * sx;
    return top + (bottom - top) * sy;
  };

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;

      // Knit coordinate space
      const col = u * columns;
      const colIdx = Math.floor(col);
      // Alternate row stagger: odd wales are shifted down by 0.5 course
      const row = v * rows + (colIdx % 2) * 0.5;
      const rowIdx = Math.floor(row);

      // Local stitch normalized coordinates [-0.5, 0.5]
      const cx = col - colIdx - 0.5;
      const cy = row - rowIdx - 0.5;

      // Authentic single-jersey "V" loop geometry:
      // Two curved legs that meet at the bottom base, bowing outwards slightly
      const legDist = Math.abs(cx) - 0.22;
      const legShape = Math.exp(-(legDist * legDist) * 32) * Math.max(0, 1 - cy * 0.4);
      // The crown at the top connecting the loop
      const crown = Math.exp(-((cx * cx * 8) + (cy - 0.35) * (cy - 0.35) * 28)) * 0.75;
      // Under-tuck groove between rows
      const tuckGroove = Math.sin((cy + 0.5) * Math.PI) * 0.35;

      // Yarn twist: micro-grooves angled at ~18 degrees along each yarn strand
      const twistAngle = cx > 0 ? 0.32 : -0.32;
      const twistPhase = (cx * Math.cos(twistAngle) + cy * Math.sin(twistAngle)) * 48;
      const fiberFuzz = Math.sin(twistPhase) * 0.08;

      // Organic cotton slub: yarn unevenness and natural combed fibers
      const slub = noise(u * 8, v * 2) * 0.22 + noise(u * 32, v * 16) * 0.12;
      const microGrain = (noise(u * 96, v * 96) - 0.5) * 0.09;

      const stitch = Math.max(0, legShape + crown + tuckGroove);
      height[y * size + x] = stitch * 0.68 + fiberFuzz + slub + microGrain;
    }
  }

  // Generate normal map using Sobel filter
  const data = new Uint8Array(size * size * 4);
  const strength = 3.6;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const h = (i: number, j: number) =>
        height[(((j % size) + size) % size) * size + (((i % size) + size) % size)];

      // 3x3 Sobel kernel for smooth, high-fidelity normal derivatives
      const tl = h(x - 1, y - 1);
      const t = h(x, y - 1);
      const tr = h(x + 1, y - 1);
      const l = h(x - 1, y);
      const r = h(x + 1, y);
      const bl = h(x - 1, y + 1);
      const b = h(x, y + 1);
      const br = h(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * (strength / 8);
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * (strength / 8);

      const len = Math.hypot(dx, dy, 1);
      const o = (y * size + x) * 4;

      data[o] = ((-dx / len) * 0.5 + 0.5) * 255;
      data[o + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      data[o + 2] = (1 / len * 0.5 + 0.5) * 255;
      data[o + 3] = 255;
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = NoColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Procedural cotton roughness map:
 * Burnished stitch crowns have lower roughness (~0.80) to catch grazing light,
 * while inter-stitch crevices trap light with maximum roughness (~0.98).
 */
export function createCottonRoughnessMap(size: number = 256): DataTexture {
  const columns = size / 4;
  const rows = size / 4.4;
  const data = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const col = u * columns;
      const colIdx = Math.floor(col);
      const row = v * rows + (colIdx % 2) * 0.5;
      const rowIdx = Math.floor(row);

      const cx = col - colIdx - 0.5;
      const cy = row - rowIdx - 0.5;

      const stitch = Math.exp(-(cx * cx * 18 + cy * cy * 8));
      const roughnessVal = Math.round((0.98 - stitch * 0.16) * 255);

      const o = (y * size + x) * 4;
      data[o] = roughnessVal;
      data[o + 1] = roughnessVal;
      data[o + 2] = roughnessVal;
      data[o + 3] = 255;
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = NoColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function displayFontFamily(): string {
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-inter-tight").trim();
  return family ? `${family}, "Helvetica Neue", Helvetica, Arial, sans-serif` : `"Helvetica Neue", Helvetica, Arial, sans-serif`;
}

export interface PrintTexture {
  texture: CanvasTexture;
  /** Redraws once web fonts are available. */
  ready: Promise<void>;
}

function createPrintTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, family: string) => void,
): PrintTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;

  const render = () => {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    draw(ctx, displayFontFamily());
    texture.needsUpdate = true;
  };
  render();
  const family = displayFontFamily();
  const ready = document.fonts
    .load(`800 64px ${family}`)
    .then(() => render())
    .catch(() => undefined);
  return { texture, ready };
}

/** Oversized back graphic. Colours and copy come from shirtConfig. */
export function createBackPrint(
  color: string,
  copy: { title: string; lines: readonly string[]; footnote: string },
): PrintTexture {
  const W = 1024;
  const H = 620;
  return createPrintTexture(W, H, (ctx, family) => {
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";

    ctx.font = `700 34px ${family}`;
    ctx.letterSpacing = "2px";
    ctx.fillText(copy.title, 40, 70);
    ctx.textAlign = "right";
    ctx.fillText("(001)", W - 40, 70);
    ctx.textAlign = "left";

    ctx.fillRect(40, 100, W - 80, 3);

    ctx.letterSpacing = "-9px";
    let size = 190;
    ctx.font = `850 ${size}px ${family}`;
    const widest = Math.max(...copy.lines.map((l) => ctx.measureText(l).width));
    size = Math.floor((size * (W - 70)) / widest);
    ctx.font = `850 ${size}px ${family}`;
    ctx.letterSpacing = `${-size * 0.055}px`;
    copy.lines.forEach((line, i) => {
      ctx.fillText(line, 30, 130 + size * 0.86 * (i + 1));
    });

    const footY = 130 + size * 0.86 * copy.lines.length + 90;
    ctx.fillRect(40, footY - 50, W - 80, 3);
    ctx.font = `600 30px ${family}`;
    ctx.letterSpacing = "3px";
    ctx.fillText(copy.footnote, 40, footY);
  });
}

/** Small chest wordmark. */
export function createChestPrint(color: string, title: string): PrintTexture {
  return createPrintTexture(512, 160, (ctx, family) => {
    ctx.fillStyle = color;
    ctx.font = `850 104px ${family}`;
    ctx.letterSpacing = "-5px";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(title, 256, 84);
  });
}
