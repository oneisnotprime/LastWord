/**
 * 5. PIXEL CLASSIC. The conservative baseline: a 16-colour palette, one art pixel to two
 * screen pixels, Bayer-dithered transitions between terrains, procedural pixel sprites with
 * a dark outline and top-lit shading.
 *
 * Scaling: one sprite per archetype (humanoid, quadruped, flyer, swarm, box, wall), rasterised
 * here from a silhouette so they all share one outline and shading rule; per-word variety is
 * a palette swap plus the label. Adjectives are overlays and palette tricks: BURNING adds
 * animated pixel flames, GIANT is the same sprite at a whole-number 2x scale, so pixels stay
 * square. A generated 32x32 icon per noun (PLAN.md) would slot into the same pipeline later.
 */
import { areas, COLS, H, inset, ROWS, S, things, tile, Tile, W, type Thing } from "./scene.js";
import * as shape from "./shapes.js";
import type { Style } from "./style.js";
import { clamp, hash, place, type Ctx, type Pt } from "../art/util.js";

/** Sweetie 16 plus three browns and a pink. */
const P = {
  black: "#1a1c2c", plum: "#5d275d", red: "#b13e53", orange: "#ef7d57", yellow: "#ffcd75", lime: "#a7f070", green: "#38b764", teal: "#257179",
  navy: "#29366f", blue: "#3b5dc9", sky: "#41a6f6", cyan: "#73eff7", white: "#f4f4f4", silver: "#94b0c2", slate: "#566c86", ink: "#333c57",
  brown: "#8b5a3c", tan: "#c28a5a", dark: "#5a3a2a", pink: "#f78fb3", skin: "#f2c39b",
};
const PX = 2; // scene pixels per art pixel
const LW = W / PX, LH = H / PX, T = S / PX; // low-res size, art pixels per tile
const FONT = "'Silkscreen', ui-monospace, monospace";
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)]!;

/** Batches 1x1 rects by colour, so a sprite is a handful of fills. */
class Pixels {
  private by = new Map<string, Path2D>();
  set(x: number, y: number, c: string, size = 1) {
    let p = this.by.get(c);
    if (!p) this.by.set(c, (p = new Path2D()));
    p.rect(Math.floor(x), Math.floor(y), size, size);
  }
  flush(ctx: Ctx) {
    for (const [c, p] of this.by) { ctx.fillStyle = c; ctx.fill(p); }
    this.by.clear();
  }
}

/** Point-in-polygon at pixel centres: the silhouette's pixels. */
function rasterize(pts: Pt[]): Set<number> {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs)), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  const out = new Set<number>();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const cx = x + 0.5, cy = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!;
      if (yi > cy !== yj > cy && cx < ((xj - xi) * (cy - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) out.add((y + 2048) * 4096 + x + 2048);
  }
  return out;
}

interface Ramp { light: string; base: string; dark: string; outline?: string }

/** A silhouette as a pixel sprite: dark outline, lit from above. `block` > 1 is a whole-number upscale. */
function sprite(px: Pixels, scenePts: Pt[], ramp: Ramp, block = 1, ox = 0, oy = 0) {
  const pts = scenePts.map(([x, y]) => [(x - ox) / PX / block, (y - oy) / PX / block] as Pt);
  const m = rasterize(pts);
  const has = (x: number, y: number) => m.has((y + 2048) * 4096 + x + 2048);
  for (const k of m) {
    const x = (k % 4096) - 2048, y = Math.floor(k / 4096) - 2048;
    let c = ramp.base;
    if (!has(x - 1, y) || !has(x + 1, y) || !has(x, y - 1) || !has(x, y + 1)) c = ramp.outline ?? P.black;
    else if (!has(x, y - 2) || !has(x - 2, y)) c = ramp.light;
    else if (!has(x, y + 2) || !has(x + 2, y + 1)) c = ramp.dark;
    px.set(ox / PX + x * block, oy / PX + y * block, c, block);
  }
}

/** Terrain colour for one art pixel: the tile's texture, dithered toward its neighbours near edges. */
function terrainKind(lx: number, ly: number): Tile {
  const own = tile(Math.floor(lx / T), Math.floor(ly / T));
  const hard = (k: Tile) => k === Tile.Road || k === Tile.City || k === Tile.Wall || k === Tile.Pit;
  if (hard(own)) return own;
  const fx = (lx + 0.5) / T - 0.5, fy = (ly + 0.5) / T - 0.5;
  const i0 = Math.floor(fx), j0 = Math.floor(fy);
  const sx = clamp((fx - i0 - 0.5) * 2.2 + 0.5), sy = clamp((fy - j0 - 0.5) * 2.2 + 0.5);
  const corners: [Tile, number][] = [[tile(i0, j0), (1 - sx) * (1 - sy)], [tile(i0 + 1, j0), sx * (1 - sy)], [tile(i0, j0 + 1), (1 - sx) * sy], [tile(i0 + 1, j0 + 1), sx * sy]];
  const b = bayer(lx, ly);
  let acc = 0;
  for (const [k, w] of corners) {
    acc += w;
    if (b < acc) return hard(k) ? own : k;
  }
  return own;
}

let terrain: HTMLCanvasElement | null = null;
const waterPx: [number, number, boolean][] = [];

function buildTerrain(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = LW; c.height = LH;
  const ctx = c.getContext("2d")!;
  const kinds = new Uint8Array(LW * LH);
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) kinds[y * LW + x] = terrainKind(x, y);
  const kind = (x: number, y: number) => (x < 0 || y < 0 || x >= LW || y >= LH ? kinds[clamp(y, 0, LH - 1) * LW + clamp(x, 0, LW - 1)]! : kinds[y * LW + x]!) as Tile;
  const isWater = (k: Tile) => k === Tile.Water || k === Tile.DeepWater;
  const px = new Pixels();
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
    const k = kind(x, y), h = hash(x, y, 1), tx = x % T, ty = y % T;
    let col: string;
    switch (k) {
      case Tile.DeepWater: col = h < 0.04 ? P.blue : P.navy; break;
      case Tile.Water: {
        const shore = [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0], [0, 2], [0, -2]].some(([dx, dy]) => !isWater(kind(x + dx!, y + dy!)));
        col = shore ? (h < 0.5 ? P.cyan : P.white) : h < 0.05 ? P.sky : P.blue;
        if (!shore) waterPx.push([x, y, false]);
        break;
      }
      case Tile.Sand: col = h < 0.025 ? P.orange : h < 0.035 ? P.white : P.yellow; break;
      case Tile.Grass: {
        const tuft = hash(Math.floor(x / 4), Math.floor(y / 4), 2) < 0.18 && (x % 4 === 1) && (y % 4 === 2);
        col = tuft ? P.lime : h < 0.015 ? P.lime : h < 0.025 ? P.teal : P.green;
        break;
      }
      case Tile.Forest: col = h < 0.03 ? P.green : P.teal; break;
      case Tile.Hill: col = h < 0.03 ? P.lime : P.green; break;
      case Tile.Mountain: col = h < 0.1 ? P.silver : P.slate; break;
      case Tile.Road: col = (tx + ty * 3) % 7 === 0 || h < 0.06 ? P.brown : P.tan; break;
      case Tile.City: {
        const brick = ty % 4 === 0 || (tx + (Math.floor(ty / 4) % 2) * 4) % 8 === 0;
        col = brick ? P.slate : h < 0.1 ? P.white : P.silver;
        break;
      }
      default: col = P.black;
    }
    px.set(x, y, col);
  }
  px.flush(ctx);

  // Features as small procedural sprites, back to front.
  const feats: { y: number; draw: () => void }[] = [];
  for (let ty = -1; ty <= ROWS; ty++) for (let tx = -1; tx <= COLS; tx++) {
    const k = tile(tx, ty), r = (i: number) => hash(tx, ty, 300 + i), X = tx * T, Y = ty * T;
    if (k === Tile.Forest) {
      for (let i = 0; i < 2; i++) {
        const cx = X + 3 + Math.floor(r(i) * 10), cy = Y + 4 + Math.floor(r(i + 3) * 10);
        feats.push({ y: cy, draw: () => tree(px, cx, cy, r(i + 6) < 0.3) });
      }
    } else if (k === Tile.Hill && r(0) < 0.6) {
      const cx = X + 8, cy = Y + 11;
      feats.push({ y: cy, draw: () => {
        for (let dx = -6; dx <= 6; dx++) {
          const top = Math.round(Math.sqrt(36 - dx * dx) * 0.6);
          for (let dy = 0; dy <= top; dy++) px.set(cx + dx, cy - dy, dy === top ? P.black : dx < -1 ? P.lime : dx > 2 ? P.teal : P.green);
        }
      } });
    } else if (k === Tile.Mountain && r(0) < 0.85) {
      const cx = X + 8, cy = Y + 14, h = 11 + Math.floor(r(1) * 4);
      feats.push({ y: cy, draw: () => {
        for (let dy = 0; dy <= h; dy++) {
          const half = Math.round(((h - dy) / h) * 8);
          for (let dx = -half; dx <= half; dx++) {
            const edge = Math.abs(dx) === half;
            px.set(cx + dx, cy - dy, edge ? P.black : dy > h - 4 ? P.white : dx < 0 ? P.silver : P.slate);
          }
        }
      } });
    } else if (k === Tile.City && !(((tx % 3) + 3) % 3 === 0 && ((ty % 3) + 3) % 3 === 0) && r(0) > 0.25) {
      const cx = X + 8, cy = Y + 14;
      feats.push({ y: cy, draw: () => house(px, cx, cy, [P.red, P.blue, P.plum, P.orange][Math.floor(r(1) * 4)]!) });
    }
  }
  feats.sort((a, b) => a.y - b.y).forEach((f) => f.draw());
  px.flush(ctx);
  return c;
}

function tree(px: Pixels, cx: number, cy: number, pine: boolean) {
  px.set(cx, cy, P.dark); px.set(cx, cy - 1, P.brown); px.set(cx + 1, cy, P.black);
  if (pine) {
    for (let dy = 0; dy < 9; dy++) {
      const half = Math.floor(dy / 2) + 1;
      for (let dx = -half; dx <= half; dx++) px.set(cx + dx, cy - 10 + dy, Math.abs(dx) === half ? P.black : dx < 0 ? P.green : P.teal);
    }
    px.set(cx, cy - 11, P.black);
    return;
  }
  const R = 4.6, oy = cy - 6;
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
    const d = Math.hypot(dx, dy);
    if (d > R) continue;
    const edge = d > R - 1;
    const lit = dx + dy < -3, shade = dx + dy > 3;
    px.set(cx + dx, oy + dy, edge ? P.black : lit ? P.lime : shade ? P.teal : P.green);
  }
}

function house(px: Pixels, cx: number, cy: number, roof: string) {
  for (let dy = 0; dy < 6; dy++) for (let dx = -5; dx <= 5; dx++) px.set(cx + dx, cy - dy, Math.abs(dx) === 5 || dy === 0 ? P.black : P.white);
  px.set(cx, cy - 1, P.dark); px.set(cx, cy - 2, P.dark); px.set(cx - 3, cy - 3, P.sky); px.set(cx + 3, cy - 3, P.sky);
  for (let dy = 0; dy < 5; dy++) for (let dx = -6 + dy; dx <= 6 - dy; dx++) px.set(cx + dx, cy - 6 - dy, Math.abs(dx) === 6 - dy || dy === 4 ? P.black : dx < 0 ? roof : P.plum);
}

const HEART = [".x.x.", "xxxxx", "xxxxx", ".xxx.", "..x.."];

function flame(px: Pixels, x: number, y: number, h: number, t: number, seed: number) {
  for (let dy = 0; dy < h; dy++) {
    const f = dy / h;
    const half = Math.max(0, Math.round((1 - f) * 2.2 + Math.sin(t * 14 + seed + dy) * 0.6));
    const wob = Math.round(Math.sin(t * 9 + seed + dy * 0.7) * f * 1.5);
    for (let dx = -half; dx <= half; dx++) {
      const core = Math.abs(dx) < half - 0.5;
      px.set(x + dx + wob, y - dy, f > 0.8 ? P.yellow : core ? (f < 0.45 ? P.yellow : P.orange) : f < 0.3 ? P.red : P.orange);
    }
  }
}

function sword(px: Pixels, hx: number, hy: number, dir: number, len = 9, burning = false, t = 0, b = 1) {
  const put = (x: number, y: number, c: string) => px.set(hx + (x - hx) * b, hy + (y - hy) * b, c, b);
  for (let i = 0; i < len; i++) {
    const x = hx + Math.round(i * 0.55) * dir, y = hy - i;
    put(x, y, i < 2 ? P.brown : i === 2 ? P.yellow : P.white);
    if (i >= 3) put(x + dir, y, P.silver);
    if (i === 2) { put(x - 1, y, P.yellow); put(x + 1, y, P.yellow); }
  }
  if (burning) for (let i = 0; i < 5; i++) flame(px, hx + Math.round((4 + i * 3) * 0.55 * b) * dir + (i % 2 ? 3 : -2), hy - (4 + i * 3) * b, 7 + (i % 2) * 3, t, i * 3);
}

function thing(px: Pixels, th: Thing, t: number, block = 1) {
  const { x, y, scale: s, facing } = th;
  const flip = facing < 0;
  const lx = Math.round(x / PX), ly = Math.round(y / PX);
  const shadow = (w: number, dy = 0) => { for (let dx = -w; dx <= w; dx++) for (let k = 0; k < 2; k++) if ((dx + k) % 2 === 0) px.set(lx + dx, ly + dy + k, "rgba(26,28,44,0.45)"); };
  const bob = Math.round(Math.sin(t * 4 + x) * 0.6);
  switch (th.kind) {
    case "wolf": {
      // A giant is rasterised at normal size and each pixel drawn as a block, so it is chunkier.
      const k = s * block, ay = y + bob;
      shadow(Math.round(10 * k));
      for (const leg of shape.wolf.farLegs) sprite(px, place(leg, x, ay, k, flip), { light: P.ink, base: P.ink, dark: P.ink }, block, x, ay);
      sprite(px, place(shape.wolf.body, x, ay, k, flip), { light: P.silver, base: P.slate, dark: P.ink }, block, x, ay);
      const [ex, ey] = place([shape.wolf.eye], x, ay, k, flip)[0]!;
      px.set(ex / PX, ey / PX, P.yellow, block);
      break;
    }
    case "dragon": {
      const hover = Math.round(Math.sin(t * 2) * 2) * PX, f = Math.sin(t * 3.5);
      shadow(Math.round(20 * s), Math.round(44 * s / PX));
      sprite(px, place(shape.dragonWing(f * 0.8), x - 8 * s, y + hover - 2 * s, s * 0.85, flip), { light: P.red, base: P.plum, dark: P.plum });
      sprite(px, place(shape.dragonBody, x, y + hover, s, flip), { light: P.orange, base: P.red, dark: P.plum });
      sprite(px, place(shape.dragonWing(f), x, y + hover, s, flip), { light: P.yellow, base: P.orange, dark: P.red });
      const [ex, ey] = place([shape.dragonEye], x, y + hover, s, flip)[0]!;
      px.set(ex / PX, ey / PX, P.yellow); px.set(ex / PX + 1, ey / PX, P.black);
      break;
    }
    case "player": {
      shadow(Math.round(5 * s));
      const team = th.who === 0 ? { light: P.sky, base: P.blue, dark: P.navy } : { light: P.pink, base: P.red, dark: P.plum };
      sprite(px, place(shape.human.body, x, y, s, flip), team);
      sprite(px, place(shape.human.head, x, y, s, flip), { light: P.skin, base: P.skin, dark: P.orange });
      const [hx, hy] = place([[0, -38]], x, y, s, flip)[0]!;
      for (let dx = -3; dx <= 3; dx++) px.set(hx / PX + dx, hy / PX, th.who === 0 ? P.brown : P.plum);
      const [ex, ey] = place([[3, -34]], x, y, s, flip)[0]!;
      px.set(ex / PX, ey / PX, P.black);
      if (th.held) {
        const [hx2, hy2] = place([shape.human.hand], x, y, s, flip)[0]!;
        sword(px, Math.round(hx2 / PX), Math.round(hy2 / PX), facing);
      }
      break;
    }
    case "sword":
      sword(px, lx, ly, 1, 12, !!th.burning, t, 2);
      break;
    case "chest": {
      shadow(8);
      const w = 8, h = 10;
      for (let dy = 0; dy < h; dy++) for (let dx = -w; dx <= w; dx++) {
        const edge = Math.abs(dx) === w || dy === 0 || dy === h - 1 || dy === 5;
        const band = Math.abs(dx) === 5;
        const lock = Math.abs(dx) <= 1 && (dy === 5 || dy === 4 || dy === 6);
        const lid = dy > 5;
        px.set(lx + dx, ly - 1 - dy, lock ? P.yellow : edge ? P.black : band ? P.dark : lid ? (dy === h - 2 ? P.tan : P.brown) : dy < 2 ? P.dark : P.brown);
      }
      for (let dx = -w + 1; dx < w; dx++) px.set(lx + dx, ly - 1 - h, P.black);
      break;
    }
    case "wall": {
      const len = ((th.size ?? 3) * S) / PX, h = 12;
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < len; dx++) {
        const row = Math.floor(dy / 4), mortar = dy % 4 === 0 || (dx + row * 4) % 8 === 0;
        const edge = dx === 0 || dx === len - 1 || dy === h - 1;
        px.set(lx - len / 2 + dx, ly - dy, edge ? P.black : mortar ? P.ink : dy % 4 === 3 ? P.silver : P.slate);
      }
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < len; dx++) px.set(lx - len / 2 + dx, ly - h - dy, dy === 2 || dx === 0 || dx === len - 1 ? P.black : P.silver);
      break;
    }
    case "swarm": {
      for (const [ax, ay] of shape.swarm(240, (th.size ?? 1.5) * S, t)) {
        const a = Math.round((x + ax) / PX), b = Math.round((y + ay) / PX);
        px.set(a, b, P.black);
        if (hash(a, b, 1) < 0.3) px.set(a + 1, b, P.dark);
      }
      break;
    }
  }
}

function pixelLabel(ctx: Ctx, text: string, x: number, y: number, color = P.white, size = 8) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const w = Math.ceil(ctx.measureText(text).width / 2) * 2 + 8;
  const bx = Math.round(x - w / 2), by = Math.round(y - 7);
  ctx.fillStyle = P.black; ctx.fillRect(bx - 2, by - 2, w + 4, 18);
  ctx.fillStyle = color === P.white ? P.ink : P.black; ctx.fillRect(bx, by, w, 14);
  ctx.fillStyle = color;
  ctx.fillText(text, Math.round(x), Math.round(y) + 0.5);
}

let lo: HTMLCanvasElement | null = null;

function lowres(): [HTMLCanvasElement, Ctx] {
  lo ??= Object.assign(document.createElement("canvas"), { width: LW, height: LH });
  const g = lo.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  return [lo, g];
}

export const pixelStyle: Style = {
  id: "pixel",
  name: "Pixel Classic",
  tagline: "The safe baseline: a 16-colour palette, chunky pixels, Bayer-dithered terrain edges, foam on the shore, procedural pixel sprites with outlines and top light.",
  adjectives: "BURNING adds animated pixel flames along the blade. GIANT is the same wolf sprite at a whole-number 2x scale, so the pixels stay square and it looks hulking.",
  scaling: "One sprite per archetype (humanoid, quadruped, flyer, swarm, box, wall), all made by one outline-and-shading rule, with a palette swap per word family. Adjectives are overlays (flames, sparkles) or palette tricks (golden, ghostly). The planned generated 32x32 icon per noun drops into the same pipeline when it exists; until then a word shows its archetype and its label.",
  fonts: [`20px 'Silkscreen'`, `700 20px 'Silkscreen'`],
  night: "rgba(20,16,52,0.66)",
  world(ctx, t) {
    terrain ??= buildTerrain();
    const [c, g] = lowres();
    g.drawImage(terrain, 0, 0);
    const px = new Pixels();
    // Water sparkle: palette-cycled glints.
    for (let i = 0; i < waterPx.length; i += 1) {
      const [x, y] = waterPx[i]!;
      const ph = (t * 1.2 + hash(Math.floor(x / 6), y, 4)) % 1;
      if (y % 5 === 0 && ph < 0.12 && (x + Math.floor(t * 6)) % 6 < 3) px.set(x, y, ph < 0.06 ? P.cyan : P.sky);
    }
    const fire = areas[0]!, love = areas[1]!;
    const fx = fire.x / PX, fy = fire.y / PX, fr = fire.r / PX;
    for (let y = Math.floor(fy - fr); y <= fy + fr; y++) for (let x = Math.floor(fx - fr); x <= fx + fr; x++) {
      const d = Math.hypot(x - fx, y - fy);
      if (d > fr) continue;
      if (d > fr - 1) px.set(x, y, (x + y + Math.floor(t * 8)) % 4 < 2 ? P.red : P.orange);
      else if (bayer(x, y) < 0.45 * (1 - d / fr) + 0.1) px.set(x, y, bayer(x + 1, y) < 0.3 ? P.plum : P.red);
    }
    const flames = Array.from({ length: 16 }, (_, i) => ({ a: hash(i, 1, 7) * Math.PI * 2, d: Math.sqrt(hash(i, 2, 7)) * fr * 0.75, i }))
      .map((f) => ({ ...f, x: Math.round(fx + Math.cos(f.a) * f.d), y: Math.round(fy + Math.sin(f.a) * f.d * 0.8 + 6) })).sort((a, b) => a.y - b.y);
    for (const f of flames) flame(px, f.x, f.y, 10 + Math.floor(hash(f.i, 3, 7) * 7) + Math.round(Math.sin(t * 10 + f.i)), t, f.i);
    const lx = love.x / PX, ly = love.y / PX, lr = love.r / PX;
    for (let y = Math.floor(ly - lr); y <= ly + lr; y++) for (let x = Math.floor(lx - lr); x <= lx + lr; x++) {
      const d = Math.hypot(x - lx, y - ly);
      if (d > lr) continue;
      if (d > lr - 1) px.set(x, y, P.pink);
      else if (d > lr - 3 && bayer(x, y) < 0.5) px.set(x, y, P.pink);
      else if (bayer(x, y) < 0.08) px.set(x, y, P.pink);
    }
    for (let i = 0; i < 6; i++) {
      const life = (t * 0.35 + i / 6) % 1, a = (i / 6) * Math.PI * 2;
      const hx = Math.round(lx + Math.cos(a) * lr * 0.7), hy = Math.round(ly + Math.sin(a) * lr * 0.6 - life * 10);
      HEART.forEach((row, dy) => row.split("").forEach((ch, dx) => ch === "x" && life < 0.85 && px.set(hx + dx - 2, hy + dy - 2, dy === 0 || dx === 0 ? P.white : P.pink)));
    }
    px.flush(g);
    for (const th of [...things].sort((a, b) => a.y - b.y)) { thing(px, th, t); px.flush(g); }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, 0, 0, W, H);
  },
  labels(ctx) {
    for (const th of things) {
      const dy = th.kind === "dragon" ? 64 : th.kind === "swarm" ? 46 : 14;
      const color = th.kind === "player" ? (th.who === 0 ? P.cyan : P.pink) : th.kind === "dragon" ? P.yellow : P.white;
      pixelLabel(ctx, th.kind === "player" && th.held ? `${th.label}+SWORD` : th.label, th.x, th.y + dy, color);
    }
    pixelLabel(ctx, "FIRE", areas[0]!.x, areas[0]!.y + areas[0]!.r + 12, P.orange);
    pixelLabel(ctx, "LOVE", areas[1]!.x, areas[1]!.y - areas[1]!.r - 12, P.pink);
  },
  inset(ctx, t) {
    const w = inset.w / PX, h = inset.h / PX;
    const c = Object.assign(document.createElement("canvas"), { width: w, height: h });
    const g = c.getContext("2d")!;
    const px = new Pixels();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px.set(x, y, hash(x, y, 2) < 0.02 ? P.lime : P.green);
    px.flush(g);
    thing(px, { ...inset.sword, x: 56, y: 124 }, t);
    thing(px, { ...inset.wolf, scale: 1.1 }, t, 2);
    px.flush(g);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(c, 0, 0, inset.w, inset.h);
    pixelLabel(ctx, "BURNING SWORD", 66, 152, P.orange);
    pixelLabel(ctx, "GIANT WOLF", 196, 152, P.white);
  },
};
