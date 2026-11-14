/**
 * The map in paper: every kind of ground is a cut sheet with a torn white edge and a soft drop
 * shadow, stacked in height order, with little cut-outs on top (trees, houses, peaks, reeds,
 * bubbles in lava). Drawn in square chunks; a chunk is drawn once and again only when a word
 * changes the land under it.
 *
 * Everything depends on world coordinates only, so neighbouring chunks meet without a seam.
 */
import { Tile, type WorldMap } from "@lastword/shared";
import { PAPER } from "./palette.js";
import { cutout, fillPoly, paperFlame, withShadow } from "./paper.js";
import { hash, smooth, vnoise, type Ctx, type Pt } from "./util.js";

/** Tiles along a chunk's side. */
export const CHUNK = 16;
/** Tiles drawn around a chunk so edges, shadows and cut-outs carry across. */
const MARGIN = 3;
/** Field samples per tile. */
const SUB = 4;

interface Sheet {
  test: (t: Tile) => boolean;
  colour: string;
  /** Height above the sheet below: shadow length. */
  depth: number;
  /** Blur passes: more rounds the corners off. */
  blur: number;
  /** Rim colour (the torn edge), or none for a sheet laid flat. */
  rim?: string;
  /** Where the edge sits in the blurred field; above 0.5 shrinks the sheet. */
  level?: number;
}

const water = (t: Tile) => t === Tile.Water || t === Tile.DeepWater;

/** Bottom to top. */
const SHEETS: Sheet[] = [
  { test: (t) => t !== Tile.DeepWater, colour: "#6d9eaa", depth: 2, blur: 4 },
  { test: (t) => !water(t), colour: "#e6d3a3", depth: 3, blur: 3 },
  { test: (t) => !water(t) && t !== Tile.Sand, colour: "#a3b86f", depth: 3, blur: 3 },
  { test: (t) => t === Tile.Swamp, colour: "#7f8a55", depth: 1, blur: 3 },
  // Tilled crop land: a dark soil sheet, furrowed by marks.
  { test: (t) => t === Tile.Field, colour: "#8a6a45", depth: 1, blur: 1 },
  { test: (t) => t === Tile.Forest, colour: "#7f9b5a", depth: 2, blur: 2 },
  { test: (t) => t === Tile.City, colour: "#ddd0b6", depth: 2, blur: 3 },
  { test: (t) => t === Tile.Road, colour: "#c9a77a", depth: 2, blur: 1 },
  { test: (t) => t === Tile.Snow, colour: "#f4f1ea", depth: 3, blur: 3, rim: "#ffffff" },
  { test: (t) => t === Tile.Hill || t === Tile.Mountain, colour: "#b9b077", depth: 4, blur: 3 },
  { test: (t) => t === Tile.Mountain, colour: "#a39b8c", depth: 5, blur: 2 },
  { test: (t) => t === Tile.Lava, colour: "#c9452f", depth: 1, blur: 3, rim: "#3d2a22" },
  { test: (t) => t === Tile.Lava, colour: "#ec7a3a", depth: 0, blur: 3, level: 0.68 },
  // A pit is a hole: a dark ring stepping down to a darker floor.
  { test: (t) => t === Tile.Pit, colour: "#6b5440", depth: 0, blur: 3, rim: "#8a7258" },
  { test: (t) => t === Tile.Pit, colour: "#3b2f26", depth: 0, blur: 3, level: 0.62 },
  { test: (t) => t === Tile.Pit, colour: "#241c16", depth: 0, blur: 3, level: 0.8 },
  { test: (t) => t === Tile.Wall, colour: "#b3a68f", depth: 7, blur: 1 },
];

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
/** A canvas that works in a worker too. */
const makeCanvas = (w: number, h: number): AnyCanvas => {
  if (typeof document === "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
};
const context = (c: AnyCanvas) => c.getContext("2d") as unknown as Ctx;

let scratch: AnyCanvas | null = null;

/** Torn-edge displacement in pixels at a world point (tiles). */
function tear(wx: number, wy: number, seed: number): [number, number] {
  const a = vnoise(wx * 3.1, wy * 3.1, seed) - 0.5 + (vnoise(wx * 11, wy * 11, seed + 7) - 0.5) * 0.6;
  const b = vnoise(wx * 3.1 + 40, wy * 3.1, seed + 1) - 0.5 + (vnoise(wx * 11 + 40, wy * 11, seed + 8) - 0.5) * 0.6;
  return [a, b];
}

export interface ChunkCanvas { canvas: AnyCanvas; ms: number }

/** Draws chunk (cx, cy) at `T` pixels per tile. */
export function renderChunk(map: WorldMap, cx: number, cy: number, T: number, into?: AnyCanvas): ChunkCanvas {
  const start = performance.now();
  const size = CHUNK * T;
  const canvas = into ?? makeCanvas(size, size);
  if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
  const ctx = context(canvas);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  if (!scratch || scratch.width !== size) scratch = makeCanvas(size, size);
  const tmp = context(scratch);

  const tx0 = cx * CHUNK - MARGIN, ty0 = cy * CHUNK - MARGIN, span = CHUNK + MARGIN * 2;
  const kinds = new Uint8Array(span * span);
  const present = new Set<Tile>();
  for (let j = 0; j < span; j++) for (let i = 0; i < span; i++) {
    const tx = tx0 + i, ty = ty0 + j;
    const t = tx < 0 || ty < 0 || tx >= map.size || ty >= map.size ? Tile.DeepWater : (map.tiles[ty * map.size + tx] as Tile);
    kinds[j * span + i] = t;
    present.add(t);
  }
  const at = (tx: number, ty: number): Tile => {
    const i = tx - tx0, j = ty - ty0;
    if (i >= 0 && j >= 0 && i < span && j < span) return kinds[j * span + i] as Tile;
    return tx < 0 || ty < 0 || tx >= map.size || ty >= map.size ? Tile.DeepWater : (map.tiles[ty * map.size + tx] as Tile);
  };

  // Deep water, with a faint weave.
  ctx.fillStyle = "#4d7b8c";
  ctx.fillRect(0, 0, size, size);

  const n = span * SUB;
  const step = T / SUB;
  // Pixel position of field sample i (sample centres).
  const px = (i: number) => (i + 0.5) * step - MARGIN * T;
  let field = new Float32Array(n * n), spare = new Float32Array(n * n);

  SHEETS.forEach((sheet, si) => {
    if (![...present].some(sheet.test)) return;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) field[j * n + i] = sheet.test(kinds[Math.floor(j / SUB) * span + Math.floor(i / SUB)] as Tile) ? 1 : 0;
    for (let b = 0; b < sheet.blur; b++) {
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        let s = 0, c = 0;
        for (let dj = -1; dj <= 1; dj++) {
          const jj = j + dj;
          if (jj < 0 || jj >= n) continue;
          for (let di = -1; di <= 1; di++) {
            const ii = i + di;
            if (ii < 0 || ii >= n) continue;
            s += field[jj * n + ii]!; c++;
          }
        }
        spare[j * n + i] = s / c;
      }
      [field, spare] = [spare, field];
    }
    const level = sheet.level ?? 0.5;
    const flat = sheet.depth === 0;
    tmp.setTransform(1, 0, 0, 1, 0, 0);
    tmp.clearRect(0, 0, size, size);
    if (!flat || sheet.rim) {
      tmp.fillStyle = tmp.strokeStyle = sheet.rim ?? PAPER;
      const rim = contourPath(field, n, level - 0.09, px, T, tx0 + MARGIN, ty0 + MARGIN, si * 13 + 5, T * 0.075, size);
      tmp.lineWidth = 1; tmp.fill(rim); tmp.stroke(rim);
    }
    tmp.fillStyle = tmp.strokeStyle = sheet.colour;
    const face = contourPath(field, n, level, px, T, tx0 + MARGIN, ty0 + MARGIN, si * 13 + 6, T * 0.035, size);
    tmp.lineWidth = 1; tmp.fill(face); tmp.stroke(face);
    if (sheet.depth > 0) withShadow(ctx, sheet.depth * (T / 32), () => ctx.drawImage(scratch as CanvasImageSource, 0, 0));
    else ctx.drawImage(scratch as CanvasImageSource, 0, 0);
  });

  // Cut-outs on top, drawn in scene units (32 a tile), back to front.
  ctx.save();
  ctx.scale(T / 32, T / 32);
  ctx.translate(-cx * CHUNK * 32, -cy * CHUNK * 32);
  decorate(ctx, at, tx0, ty0, span);
  ctx.restore();

  // Paper fibre over everything.
  ctx.fillStyle = fibrePattern(ctx);
  ctx.fillRect(0, 0, size, size);
  return { canvas, ms: performance.now() - start };
}

/**
 * The region of a field above `level` as one path, by marching squares: each cell adds the
 * polygon of its part above the level. Points where the edge crosses a cell side are nudged
 * by world-position noise, so the edge tears the same way in every chunk.
 */
function contourPath(f: Float32Array, n: number, level: number, px: (i: number) => number, T: number, wx0: number, wy0: number, seed: number, amp: number, size: number): Path2D {
  const path = new Path2D();
  const pad = T * 0.8;
  const v = (i: number, j: number) => f[j * n + i]! - level;
  const edge = (i0: number, j0: number, i1: number, j1: number): Pt => {
    const a = v(i0, j0), b = v(i1, j1), t = a / (a - b);
    const x = px(i0 + (i1 - i0) * t), y = px(j0 + (j1 - j0) * t);
    const [dx, dy] = tear(wx0 + x / T, wy0 + y / T, seed);
    return [x + dx * amp * 2, y + dy * amp * 2];
  };
  for (let j = 0; j < n - 1; j++) {
    const y0 = px(j), y1 = px(j + 1);
    if (y1 < -pad || y0 > size + pad) continue;
    for (let i = 0; i < n - 1; i++) {
      const x0 = px(i), x1 = px(i + 1);
      if (x1 < -pad || x0 > size + pad) continue;
      const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
      const inA = a > 0, inB = b > 0, inC = c > 0, inD = d > 0;
      if (!inA && !inB && !inC && !inD) continue;
      if (inA && inB && inC && inD) { path.rect(x0, y0, x1 - x0, y1 - y0); continue; }
      const pts: Pt[] = [];
      if (inA) pts.push([x0, y0]);
      if (inA !== inB) pts.push(edge(i, j, i + 1, j));
      if (inB) pts.push([x1, y0]);
      if (inB !== inC) pts.push(edge(i + 1, j, i + 1, j + 1));
      if (inC) pts.push([x1, y1]);
      if (inC !== inD) pts.push(edge(i + 1, j + 1, i, j + 1));
      if (inD) pts.push([x0, y1]);
      if (inD !== inA) pts.push(edge(i, j + 1, i, j));
      pts.forEach(([x, y], k) => (k ? path.lineTo(x, y) : path.moveTo(x, y)));
      path.closePath();
    }
  }
  return path;
}

let fibre: CanvasPattern | null = null;
function fibrePattern(ctx: Ctx): CanvasPattern {
  if (fibre) return fibre;
  const c = makeCanvas(256, 256);
  const g = context(c);
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    // Tileable: long fibres from a hash of the column, grain from a hash of the pixel.
    const v = (hash(x >> 1, (y >> 4) & 15, 4) * 0.6 + hash(x, y, 11) * 0.4);
    const k = (y * 256 + x) * 4, w = v > 0.5 ? 255 : 0;
    img.data[k] = w; img.data[k + 1] = w; img.data[k + 2] = w; img.data[k + 3] = Math.abs(v - 0.5) * 30;
  }
  g.putImageData(img, 0, 0);
  fibre = ctx.createPattern(c as CanvasImageSource, "repeat")!;
  return fibre;
}

function blob(x: number, y: number, r: number, seed: number, n = 12): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, k = 0.88 + hash(i, seed, 1) * 0.24;
    return [x + Math.cos(a) * r * k, y + Math.sin(a) * r * k] as Pt;
  });
}

/** Trees, houses, peaks, reeds, drifts and bubbles, in scene units (a tile is 32). */
function decorate(ctx: Ctx, at: (tx: number, ty: number) => Tile, tx0: number, ty0: number, span: number) {
  const S = 32;
  const marks: { y: number; draw: () => void }[] = [];
  for (let ty = ty0; ty < ty0 + span; ty++) for (let tx = tx0; tx < tx0 + span; tx++) {
    const k = at(tx, ty), r = (i: number) => hash(tx, ty, 200 + i);
    if (k === Tile.Forest) {
      for (let i = 0; i < 2; i++) {
        const x = tx * S + 8 + r(i) * 18 + i * 4, y = ty * S + 10 + r(i + 4) * 18, R = 7 + r(i + 8) * 4;
        const pine = r(i + 12) < 0.3;
        marks.push({ y, draw: () => {
          withShadow(ctx, 3, () => { ctx.fillStyle = "#6b4a2e"; ctx.fillRect(x - 1.5, y - R * 0.8, 3, R * 0.8); });
          if (pine) cutout(ctx, [[x, y - R * 3.1], [x + R, y - R * 0.6], [x - R, y - R * 0.6]], "#4f7a4a", 3, 1);
          else {
            cutout(ctx, smooth(blob(x, y - R * 1.5, R, tx * 31 + ty + i), 1), ["#5f8a4a", "#6f9a50", "#557f45"][Math.floor(r(i + 16) * 3)]!, 3, 1);
            fillPoly(ctx, blob(x - R * 0.25, y - R * 1.75, R * 0.55, tx + ty * 7 + i, 9), "rgba(190,220,140,0.35)");
          }
        } });
      }
    } else if (k === Tile.City && !((((tx % 3) + 3) % 3 === 0) || (((ty % 3) + 3) % 3 === 0)) && r(0) > 0.35) {
      const x = tx * S + 16 + (r(1) - 0.5) * 6, y = ty * S + 26, w = 9 + r(2) * 4, h = 10 + r(3) * 8;
      const wall = ["#efe4cf", "#e9d8b8", "#f2ead8"][Math.floor(r(4) * 3)]!;
      const roof = ["#c9775a", "#6f9d9a", "#d9b45a", "#b5655a"][Math.floor(r(5) * 4)]!;
      marks.push({ y, draw: () => {
        cutout(ctx, [[x - w, y], [x - w, y - h], [x + w, y - h], [x + w, y]], wall, 3, 0.8);
        cutout(ctx, [[x - w - 3, y - h + 1], [x, y - h - 10], [x + w + 3, y - h + 1]], roof, 2, 0.8);
        ctx.fillStyle = "#8a6a4a"; ctx.fillRect(x - 2, y - 6, 4, 6);
        ctx.fillStyle = "#7aa0b0"; ctx.fillRect(x - w + 3, y - h + 4, 3, 3); ctx.fillRect(x + w - 6, y - h + 4, 3, 3);
      } });
    } else if (k === Tile.Mountain && r(0) < 0.7) {
      const x = tx * S + 16 + (r(1) - 0.5) * 10, y = ty * S + 26, w = 16 + r(2) * 6, h = 24 + r(3) * 10;
      marks.push({ y, draw: () => {
        cutout(ctx, [[x - w, y], [x, y - h], [x + w, y]], "#8d877c", 4, 1);
        fillPoly(ctx, [[x - w * 0.32, y - h * 0.68], [x, y - h], [x + w * 0.32, y - h * 0.68], [x + w * 0.1, y - h * 0.6], [x - w * 0.1, y - h * 0.72]], "#f6f1e6");
      } });
    } else if (k === Tile.Hill && r(0) < 0.35) {
      const x = tx * S + 16, y = ty * S + 24, w = 14 + r(2) * 6;
      marks.push({ y, draw: () => cutout(ctx, smooth([[x - w, y], [x - w * 0.4, y - 10], [x + w * 0.3, y - 12], [x + w, y]], 2), "#c3ba80", 2, 0.8) });
    } else if (k === Tile.Grass && r(0) < 0.12) {
      const x = tx * S + r(1) * S, y = ty * S + r(2) * S;
      marks.push({ y, draw: () => cutout(ctx, [[x - 4, y], [x - 2, y - 6], [x, y - 2], [x + 2, y - 7], [x + 4, y]], "#7f9b52", 1.5, 0.6) });
    } else if (k === Tile.Field) {
      // Furrows across the soil, with green shoots along them.
      const x = tx * S, y = ty * S;
      marks.push({ y: y + 4, draw: () => {
        ctx.strokeStyle = "rgba(60,40,24,0.55)"; ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let row = 0; row < 4; row++) { ctx.moveTo(x + 2, y + 5 + row * 8); ctx.lineTo(x + S - 2, y + 5 + row * 8); }
        ctx.stroke();
        for (let row = 0; row < 4; row++) for (let i = 0; i < 3; i++) {
          const sx = x + 5 + i * 10 + r(row * 3 + i) * 4, sy = y + 4 + row * 8;
          cutout(ctx, [[sx - 2, sy], [sx, sy - 5], [sx + 2, sy]], "#8fb35a", 0.8, 0.4);
        }
      } });
    } else if (k === Tile.Swamp) {
      const x = tx * S + 6 + r(1) * 20, y = ty * S + 8 + r(2) * 18;
      if (r(3) < 0.55) marks.push({ y: y - 40, draw: () => { ctx.fillStyle = "#4f5a3a"; ctx.beginPath(); ctx.ellipse(x, y, 7 + r(4) * 5, 3 + r(5) * 2, 0, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(200,220,180,0.35)"; ctx.fillRect(x - 3, y - 1, 4, 1); } });
      if (r(6) < 0.6) {
        const rx = tx * S + r(7) * S, ry = ty * S + r(8) * S;
        marks.push({ y: ry, draw: () => {
          for (let i = 0; i < 3; i++) cutout(ctx, [[rx - 1 + i * 2.5, ry], [rx + i * 2.5 - 2 + i, ry - 10 - i * 3], [rx + 1 + i * 2.5, ry]], "#6f7a3a", 1.2, 0.5);
          cutout(ctx, [[rx + 4, ry - 12], [rx + 6, ry - 12], [rx + 6, ry - 6], [rx + 4, ry - 6]], "#6b4a2e", 1, 0.4);
        } });
      }
    } else if (k === Tile.Snow && r(0) < 0.3) {
      const x = tx * S + 6 + r(1) * 20, y = ty * S + 10 + r(2) * 16;
      marks.push({ y, draw: () => {
        if (r(3) < 0.5) {
          cutout(ctx, [[x, y - 26], [x + 8, y - 6], [x - 8, y - 6]], "#4f7a5a", 3, 1);
          fillPoly(ctx, [[x, y - 26], [x + 4, y - 16], [x - 4, y - 16]], "#fbf7ec");
          ctx.fillStyle = "#6b4a2e"; ctx.fillRect(x - 1.2, y - 6, 2.4, 6);
        } else cutout(ctx, smooth([[x - 10, y], [x - 4, y - 5], [x + 3, y - 6], [x + 10, y]], 2), "#fbfbf8", 2, 0.6);
      } });
    } else if (k === Tile.Lava && r(0) < 0.45) {
      const x = tx * S + 6 + r(1) * 20, y = ty * S + 8 + r(2) * 18;
      marks.push({ y, draw: () => {
        if (r(3) < 0.5) paperFlame(ctx, x, y, 8 + r(4) * 8, r(5) * 6, tx + ty);
        else { ctx.fillStyle = "#f4c95d"; ctx.beginPath(); ctx.arc(x, y, 2 + r(6) * 2.5, 0, 7); ctx.fill(); ctx.fillStyle = "#fbe7a0"; ctx.beginPath(); ctx.arc(x - 0.6, y - 0.6, 0.9, 0, 7); ctx.fill(); }
      } });
    } else if (k === Tile.Wall) {
      // Brick courses on top of the raised sheet.
      const x = tx * S, y = ty * S;
      marks.push({ y: y + 16, draw: () => {
        ctx.strokeStyle = "rgba(90,70,50,0.35)"; ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let row = 0; row < 4; row++) {
          ctx.moveTo(x, y + row * 8); ctx.lineTo(x + S, y + row * 8);
          for (let b = 0; b < 2; b++) { const bx = x + (row % 2 ? 8 : 0) + b * 16; ctx.moveTo(bx, y + row * 8); ctx.lineTo(bx, y + row * 8 + 8); }
        }
        ctx.stroke();
      } });
    } else if (k === Tile.Water && r(0) < 0.25) {
      const x = tx * S + 16 + (r(1) - 0.5) * 12, y = ty * S + 16;
      marks.push({ y: y - 64, draw: () => {
        ctx.strokeStyle = "rgba(235,245,245,0.45)"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.quadraticCurveTo(x, y - 4, x + 7, y); ctx.stroke();
      } });
    }
  }
  marks.sort((a, b) => a.y - b.y).forEach((m) => m.draw());
  // Stitched road centre.
  ctx.save();
  ctx.setLineDash([5, 4]); ctx.strokeStyle = "rgba(255,250,235,0.85)"; ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let ty = ty0; ty < ty0 + span; ty++) for (let tx = tx0; tx < tx0 + span; tx++) {
    if (at(tx, ty) !== Tile.Road) continue;
    if (at(tx + 1, ty) === Tile.Road) { ctx.moveTo(tx * S + 16, ty * S + 16); ctx.lineTo(tx * S + 48, ty * S + 16); }
    if (at(tx, ty + 1) === Tile.Road) { ctx.moveTo(tx * S + 16, ty * S + 16); ctx.lineTo(tx * S + 16, ty * S + 48); }
  }
  ctx.stroke();
  ctx.restore();
}
