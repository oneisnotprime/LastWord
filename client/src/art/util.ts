/** Drawing helpers shared by the style prototypes: noise, smooth fields, contours, wobbly lines. */

export type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];

/** Deterministic hash of integer coordinates to [0, 1). */
export function hash(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Small seeded generator for placing things. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise in [0, 1). */
export function vnoise(x: number, y: number, s = 0): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

export const fbm = (x: number, y: number, s = 0) =>
  vnoise(x, y, s) * 0.5 + vnoise(x * 2.03, y * 2.03, s + 1) * 0.3 + vnoise(x * 4.1, y * 4.1, s + 2) * 0.2;

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A scalar field sampled on a grid in scene pixels, blurred so its contours are smooth. */
export interface Field { w: number; h: number; step: number; ox: number; oy: number; data: Float32Array }

/**
 * Samples `fn(tx, ty)` (tile coordinates, may lie outside the crop) `sub` times per tile and
 * blurs it `blur` times with a 3x3 box, so iso-lines come out rounded.
 */
export function makeField(cols: number, rows: number, tileSize: number, sub: number, blur: number, fn: (tx: number, ty: number) => number): Field {
  const margin = 3;
  const step = tileSize / sub;
  const w = (cols + margin * 2) * sub + 1, h = (rows + margin * 2) * sub + 1;
  let data = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const tx = Math.floor(i / sub) - margin, ty = Math.floor(j / sub) - margin;
    data[j * w + i] = fn(tx, ty);
  }
  for (let b = 0; b < blur; b++) {
    const out = new Float32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let s = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
        s += data[jj * w + ii]!; n++;
      }
      out[j * w + i] = s / n;
    }
    data = out;
  }
  // Sample i sits at the centre of sub-cell i, so offset by half a step.
  return { w, h, step, ox: -margin * tileSize + step / 2, oy: -margin * tileSize + step / 2, data };
}

/** Bilinear sample of a field at scene pixel (x, y). */
export function sample(f: Field, x: number, y: number): number {
  const gx = clamp((x - f.ox) / f.step, 0, f.w - 1.001), gy = clamp((y - f.oy) / f.step, 0, f.h - 1.001);
  const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
  const d = f.data, w = f.w;
  const a = d[j * w + i]!, b = d[j * w + i + 1]!, c = d[(j + 1) * w + i]!, e = d[(j + 1) * w + i + 1]!;
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
}

/** Marching squares: line segments where the field crosses `level`, in scene pixels. */
export function contour(f: Field, level: number): [Pt, Pt][] {
  const out: [Pt, Pt][] = [];
  const { w, h, data, step, ox, oy } = f;
  const at = (i: number, j: number) => data[j * w + i]! - level;
  const edge = (i0: number, j0: number, i1: number, j1: number): Pt => {
    const a = at(i0, j0), b = at(i1, j1), t = a / (a - b);
    return [ox + (i0 + (i1 - i0) * t) * step, oy + (j0 + (j1 - j0) * t) * step];
  };
  for (let j = 0; j < h - 1; j++) for (let i = 0; i < w - 1; i++) {
    const c = (at(i, j) > 0 ? 8 : 0) | (at(i + 1, j) > 0 ? 4 : 0) | (at(i + 1, j + 1) > 0 ? 2 : 0) | (at(i, j + 1) > 0 ? 1 : 0);
    if (c === 0 || c === 15) continue;
    const T = () => edge(i, j, i + 1, j), R = () => edge(i + 1, j, i + 1, j + 1), B = () => edge(i, j + 1, i + 1, j + 1), L = () => edge(i, j, i, j + 1);
    switch (c) {
      case 1: case 14: out.push([L(), B()]); break;
      case 2: case 13: out.push([B(), R()]); break;
      case 3: case 12: out.push([L(), R()]); break;
      case 4: case 11: out.push([T(), R()]); break;
      case 5: out.push([L(), T()], [B(), R()]); break;
      case 6: case 9: out.push([T(), B()]); break;
      case 7: case 8: out.push([L(), T()]); break;
      case 10: out.push([T(), R()], [L(), B()]); break;
    }
  }
  return out;
}

/** Strokes contour segments, nudging each vertex by a hash of its position so lines wobble but stay joined. */
export function strokeSegments(ctx: Ctx, segs: [Pt, Pt][], wobble = 0, seed = 0) {
  const j = (p: Pt): Pt => wobble ? [p[0] + (vnoise(p[0] / 9, p[1] / 9, seed) - 0.5) * wobble, p[1] + (vnoise(p[0] / 9 + 50, p[1] / 9, seed) - 0.5) * wobble] : p;
  ctx.beginPath();
  for (const [a, b] of segs) {
    const p = j(a), q = j(b);
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
  }
  ctx.stroke();
}

/**
 * Paints a field's region above `level` into a fresh canvas at `res` pixels per scene pixel,
 * with antialiased edges. `rough` adds fine noise to the edge (torn paper, ragged coast).
 */
export function maskCanvas(f: Field, width: number, height: number, res: number, level: number, color: [number, number, number], opts: { rough?: number; roughScale?: number; seed?: number; soft?: number; alpha?: number } = {}): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.round(width * res); c.height = Math.round(height * res);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(c.width, c.height);
  const rough = opts.rough ?? 0, rs = opts.roughScale ?? 3, seed = opts.seed ?? 0, soft = (opts.soft ?? 0.012) / res, A = (opts.alpha ?? 1) * 255;
  const d = img.data;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const sx = (x + 0.5) / res, sy = (y + 0.5) / res;
    let v = sample(f, sx, sy) - level;
    if (v < -0.25) continue;
    if (rough) v += (vnoise(sx / rs, sy / rs, seed) - 0.5) * rough + (vnoise(sx / (rs * 4), sy / (rs * 4), seed + 9) - 0.5) * rough;
    const a = clamp(v / soft + 0.5);
    if (a <= 0) continue;
    const k = (y * c.width + x) * 4;
    d[k] = color[0]; d[k + 1] = color[1]; d[k + 2] = color[2]; d[k + 3] = a * A;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** A canvas of per-pixel grain, tinted, for paper and parchment. */
export function grainCanvas(w: number, h: number, seed: number, fn: (x: number, y: number, n: number) => [number, number, number, number]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const r = rng(seed);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [R, G, B, A] = fn(x, y, r());
    const k = (y * w + x) * 4;
    img.data[k] = R; img.data[k + 1] = G; img.data[k + 2] = B; img.data[k + 3] = A;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Chaikin smoothing for a closed polygon. */
export function smooth(pts: Pt[], passes = 2, closed = true): Pt[] {
  let p = pts;
  for (let k = 0; k < passes; k++) {
    const out: Pt[] = [];
    const n = p.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = p[i]!, b = p[(i + 1) % n]!;
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) { out.unshift(p[0]!); out.push(p[n - 1]!); }
    p = out;
  }
  return p;
}

/** Traces a polygon path, optionally wobbled like a hand-drawn line. */
export function tracePoly(ctx: Ctx, pts: Pt[], closed = true, wobble = 0, seed = 0) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const x = p[0] + (wobble ? (hash(i, 1, seed) - 0.5) * wobble : 0), y = p[1] + (wobble ? (hash(i, 2, seed) - 0.5) * wobble : 0);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  if (closed) ctx.closePath();
}

/** Transforms a polygon: scale, flip horizontally, then move. */
export function place(pts: Pt[], x: number, y: number, s = 1, flip = false, rot = 0): Pt[] {
  const c = Math.cos(rot), sn = Math.sin(rot);
  return pts.map(([px, py]) => {
    const fx = (flip ? -px : px) * s, fy = py * s;
    return [x + fx * c - fy * sn, y + fx * sn + fy * c];
  });
}

/** A circle as a polygon. */
export function circle(cx: number, cy: number, r: number, n = 16): Pt[] {
  return Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r] as Pt);
}

/** Text with a stroke behind it. */
export function label(ctx: Ctx, text: string, x: number, y: number, font: string, fill: string, stroke?: string, width = 3) {
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (stroke) { ctx.lineJoin = "round"; ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.strokeText(text, x, y); }
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

/** A canvas the size of the scene at `res`, with its context already scaled to scene pixels. */
export function layer(w: number, h: number, res: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = Math.round(w * res); c.height = Math.round(h * res);
  const ctx = c.getContext("2d")!;
  ctx.scale(res, res);
  return [c, ctx];
}
