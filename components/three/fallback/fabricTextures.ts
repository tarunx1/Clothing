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
 * Procedural jersey-knit normal map: fine vertical stitch columns with a
 * little irregularity, so light breaks up like cotton instead of plastic.
 * The pattern tiles seamlessly.
 */
export function createKnitNormalMap(size: number): DataTexture {
  const columns = size / 4;
  const rows = size / 4;
  const height = new Float32Array(size * size);

  // Tileable value noise on a coarse lattice.
  const lattice = 32;
  const rand = new Float32Array(lattice * lattice);
  let seed = 1337;
  for (let i = 0; i < rand.length; i++) {
    seed = (seed * 16807) % 2147483647;
    rand[i] = seed / 2147483647;
  }
  const noise = (u: number, v: number) => {
    const x = u * lattice;
    const y = v * lattice;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const at = (i: number, j: number) =>
      rand[((j % lattice) + lattice) % lattice * lattice + (((i % lattice) + lattice) % lattice)];
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return top + (bottom - top) * sy;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const col = u * columns;
      const row = v * rows + (Math.floor(col) % 2) * 0.5;
      // Each stitch is a small "V": a rounded bump inside every cell.
      const cx = col - Math.floor(col) - 0.5;
      const cy = row - Math.floor(row) - 0.5;
      const stitch = Math.max(0, 1 - (cx * cx * 3.2 + (cy + Math.abs(cx) * 0.6) ** 2 * 1.4) * 2.2);
      const grain = noise(u * 4, v * 4) * 0.35 + noise(u * 16, v * 16) * 0.2;
      height[y * size + x] = stitch * 0.7 + grain;
    }
  }

  const data = new Uint8Array(size * size * 4);
  const strength = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const h = (i: number, j: number) => height[((j + size) % size) * size + ((i + size) % size)];
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const o = (y * size + x) * 4;
      data[o] = ((-dx / len) * 0.5 + 0.5) * 255;
      data[o + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      data[o + 2] = ((1 / len) * 0.5 + 0.5) * 255;
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
