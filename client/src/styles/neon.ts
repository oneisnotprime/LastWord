/**
 * 3. NEON VECTOR. Glowing vector lines on near-black: terrain as contour lines over a grid,
 * forests as wireframe pines, the city as extruded wireframe blocks, creatures as luminous
 * outlines, areas as pulsing rings, all under CRT scanlines.
 *
 * Scaling: one outline per archetype and one colour per word family (beasts magenta, fire red,
 * players cyan and gold, treasure amber). Everything is lines, so an adjective is a line
 * effect: BURNING emits sparks and a flickering second outline, GIANT doubles the stroke and
 * the size. Cheap to make, and any new noun only needs its archetype and its colour.
 */
import { areas, COLS, H, inset, ROWS, S, things, tile, Tile, W, type Thing } from "./scene.js";
import * as shape from "./shapes.js";
import type { Style } from "./style.js";
import { contour, hash, layer, makeField, place, smooth, type Ctx, type Pt } from "./util.js";

const ORB = "'Orbitron', system-ui, sans-serif";
const MONO = "'Share Tech Mono', ui-monospace, monospace";
const C = { cyan: "#39e6ff", pink: "#ff4fd8", green: "#39ff88", amber: "#ffcf3f", orange: "#ff9f1c", red: "#ff3b3b", violet: "#8a7dff", gold: "#ffe14f", lime: "#b6ff3b" };

/** Strokes a path several times, wide and faint to thin and bright, so it glows. */
function glow(ctx: Ctx, path: Path2D, color: string, width = 1.2, power = 1) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = color;
  for (const [w, a] of [[width * 7, 0.05], [width * 4, 0.1], [width * 2, 0.25], [width, 0.9]] as const) {
    ctx.globalAlpha = a * power;
    ctx.lineWidth = w;
    ctx.stroke(path);
  }
  ctx.globalAlpha = 0.55 * power;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = width * 0.4;
  ctx.stroke(path);
  ctx.restore();
}

function polyPath(pts: Pt[], closed = true, p = new Path2D()): Path2D {
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  if (closed) p.closePath();
  return p;
}

function segPath(segs: [Pt, Pt][]): Path2D {
  const p = new Path2D();
  for (const [a, b] of segs) { p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]); }
  return p;
}

/** A wireframe box in oblique projection. */
function box(x: number, y: number, w: number, d: number, h: number): Path2D {
  const ox = -h * 0.35, oy = -h;
  const base: Pt[] = [[x - w / 2, y - d / 2], [x + w / 2, y - d / 2], [x + w / 2, y + d / 2], [x - w / 2, y + d / 2]];
  const top = base.map(([px, py]) => [px + ox, py + oy] as Pt);
  const p = polyPath(base);
  polyPath(top, true, p);
  base.forEach(([px, py], i) => { p.moveTo(px, py); p.lineTo(top[i]![0], top[i]![1]); });
  return p;
}

let terrain: HTMLCanvasElement | null = null;
let scan: HTMLCanvasElement | null = null;

function buildTerrain(): HTMLCanvasElement {
  const [c, ctx] = layer(W, H, 2);
  const bg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
  bg.addColorStop(0, "#0b0820"); bg.addColorStop(1, "#030308");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // Grid.
  const grid = new Path2D(), major = new Path2D();
  for (let x = 0; x <= COLS; x++) (x % 4 ? grid : major).rect(x * S, 0, 0, H);
  for (let y = 0; y <= ROWS; y++) (y % 4 ? grid : major).rect(0, y * S, W, 0);
  ctx.strokeStyle = "rgba(138,125,255,0.10)"; ctx.lineWidth = 0.6; ctx.stroke(grid);
  ctx.strokeStyle = "rgba(138,125,255,0.22)"; ctx.lineWidth = 0.8; ctx.stroke(major);

  const HEIGHT: Partial<Record<Tile, number>> = { [Tile.DeepWater]: 0, [Tile.Water]: 0.12, [Tile.Sand]: 0.3, [Tile.Grass]: 0.38, [Tile.Forest]: 0.42, [Tile.Road]: 0.38, [Tile.City]: 0.4, [Tile.Hill]: 0.68, [Tile.Mountain]: 0.95 };
  const height = makeField(COLS, ROWS, S, 4, 4, (x, y) => HEIGHT[tile(x, y)] ?? 0.4);
  // Water depth lines, the coast, then hill contours stacked like a topographic map.
  for (const lv of [0.08, 0.14, 0.19]) glow(ctx, segPath(contour(height, lv)), C.cyan, 0.6, 0.35);
  glow(ctx, segPath(contour(height, 0.24)), C.cyan, 1.3, 1);
  glow(ctx, segPath(contour(height, 0.33)), C.amber, 0.6, 0.35);
  for (let lv = 0.46; lv < 0.95; lv += 0.06) glow(ctx, segPath(contour(height, lv)), C.pink, 0.8, 0.35 + (lv - 0.46) * 1.2);

  const road = makeField(COLS, ROWS, S, 4, 1, (x, y) => (tile(x, y) === Tile.Road ? 1 : 0));
  glow(ctx, segPath(contour(road, 0.5)), C.orange, 1, 0.9);

  // Sand: a dot lattice.
  ctx.fillStyle = "rgba(255,207,63,0.35)";
  const city = new Path2D(), trees = new Path2D(), windows: Pt[] = [];
  for (let ty = -1; ty <= ROWS; ty++) for (let tx = -1; tx <= COLS; tx++) {
    const k = tile(tx, ty);
    if (k === Tile.Sand) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) ctx.fillRect(tx * S + i * 8 + 4, ty * S + j * 8 + 4, 1, 1);
    if (k === Tile.Forest) {
      for (let i = 0; i < 2; i++) {
        const x = tx * S + 6 + hash(tx, ty, i) * 20, y = ty * S + 10 + hash(tx, ty, i + 5) * 20, h = 10 + hash(tx, ty, i + 9) * 6;
        polyPath([[x, y - h], [x + h * 0.45, y], [x - h * 0.45, y]], true, trees);
        trees.moveTo(x, y); trees.lineTo(x, y + 3);
      }
    }
    if (k === Tile.City && !(((tx % 3) + 3) % 3 === 0 || ((ty % 3) + 3) % 3 === 0)) {
      const h = 8 + hash(tx, ty, 3) * 26;
      city.addPath(box(tx * S + 18, ty * S + 22, 22, 18, h));
      for (let w = 0; w < 3; w++) if (hash(tx, ty, 20 + w) < 0.5) windows.push([tx * S + 10 + w * 6 - h * 0.17, ty * S + 26 - h * 0.5]);
    }
  }
  glow(ctx, trees, C.green, 0.8, 0.8);
  glow(ctx, city, C.amber, 0.8, 0.75);
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = "rgba(255,230,140,0.8)";
  for (const [x, y] of windows) ctx.fillRect(x, y, 2, 2);
  return c;
}

function scanlines(): HTMLCanvasElement {
  const [c, ctx] = layer(W, H, 2);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1.2);
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.7)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  return c;
}

function water(ctx: Ctx, t: number) {
  const p = new Path2D();
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
    const k = tile(tx, ty);
    if (k !== Tile.Water && k !== Tile.DeepWater) continue;
    for (let j = 0; j < 2; j++) {
      const y = ty * S + 8 + j * 16, off = ((t * 18 + hash(tx, ty * 2 + j, 1) * 32) % 32);
      const len = 6 + hash(tx, ty * 2 + j, 2) * 8;
      const x0 = tx * S + off;
      p.moveTo(x0, y); p.lineTo(Math.min(x0 + len, tx * S + S), y);
    }
  }
  glow(ctx, p, C.cyan, 0.7, 0.45);
}

function swordPath(x: number, y: number, s: number, rot: number): Path2D {
  const p = new Path2D();
  for (const part of [shape.sword.blade, shape.sword.guard, shape.sword.grip]) polyPath(place(part, x, y, s, false, rot), true, p);
  return p;
}

function sparks(ctx: Ctx, x: number, y: number, r: number, n: number, t: number, h: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const life = (t * 0.8 + hash(i, 1, 3)) % 1;
    const px = x + (hash(i, 2, 3) - 0.5) * r * 2 + Math.sin(t * 6 + i) * 3, py = y - life * h + (hash(i, 4, 3) - 0.5) * r;
    ctx.fillStyle = life < 0.4 ? C.gold : life < 0.7 ? C.orange : C.red;
    ctx.globalAlpha = 1 - life;
    ctx.fillRect(px - 1, py - 1, 2.2, 2.2);
  }
  ctx.restore();
}

function outline(ctx: Ctx, pts: Pt[], color: string, width = 1.3, fill = 0.07) {
  const path = polyPath(smooth(pts, 1));
  ctx.save();
  ctx.globalAlpha = fill;
  ctx.fillStyle = color;
  ctx.fill(path);
  ctx.restore();
  glow(ctx, path, color, width);
}

function thing(ctx: Ctx, th: Thing, t: number) {
  const { x, y, scale: s, facing } = th;
  const flip = facing < 0;
  const ground = (w: number, color: string, dy = 0) => {
    const p = new Path2D(); p.ellipse(x, y + dy, w, w * 0.3, 0, 0, Math.PI * 2);
    glow(ctx, p, color, 0.6, 0.4);
  };
  switch (th.kind) {
    case "wolf": {
      const giant = th.label.startsWith("GIANT");
      ground(22 * s, C.pink);
      for (const leg of shape.wolf.farLegs) outline(ctx, place(leg, x, y, s, flip), C.pink, 0.8, 0.03);
      outline(ctx, place(shape.wolf.body, x, y, s, flip), C.pink, giant ? 2 : 1.3);
      if (giant) outline(ctx, place(shape.wolf.body, x, y, s * 1.08, flip), C.violet, 0.8, 0);
      const [ex, ey] = place([shape.wolf.eye], x, y, s, flip)[0]!;
      ctx.fillStyle = "#fff"; ctx.fillRect(ex - 1.5, ey - 1, 3, 2);
      break;
    }
    case "dragon": {
      const hover = Math.sin(t * 2) * 3, f = Math.sin(t * 3.5);
      ground(46 * s, C.red, 44 * s);
      outline(ctx, place(shape.dragonWing(f * 0.8), x - 8 * s, y + hover - 2 * s, s * 0.85, flip), C.orange, 0.9, 0.04);
      outline(ctx, place(shape.dragonBody, x, y + hover, s, flip), C.red, 1.5, 0.1);
      const wing = place(shape.dragonWing(f), x, y + hover, s, flip);
      outline(ctx, wing, C.orange, 1.3, 0.08);
      const ribs = new Path2D();
      for (const i of [2, 4, 6]) { ribs.moveTo(wing[0]![0], wing[0]![1]); ribs.lineTo(wing[i]![0], wing[i]![1]); }
      glow(ctx, ribs, C.orange, 0.6, 0.6);
      const [ex, ey] = place([shape.dragonEye], x, y + hover, s, flip)[0]!;
      ctx.fillStyle = C.gold; ctx.fillRect(ex - 2, ey - 1.5, 4, 3);
      break;
    }
    case "player": {
      const col = th.who === 0 ? C.cyan : C.gold;
      ground(11 * s, col);
      outline(ctx, place(shape.human.body, x, y, s, flip), col, 1.3, 0.1);
      outline(ctx, place(shape.human.head, x, y, s, flip), col, 1.3, 0.1);
      if (th.held) {
        const [hx, hy] = place([shape.human.hand], x, y, s, flip)[0]!;
        glow(ctx, swordPath(hx, hy, s * 0.8, 0.5 * facing), "#e8f6ff", 1);
      }
      break;
    }
    case "sword":
      glow(ctx, swordPath(x, y, s * 1.4, 0.35), "#e8f6ff", 1.4);
      if (th.burning) {
        glow(ctx, swordPath(x + Math.sin(t * 20) * 1.2, y - 2, s * 1.5, 0.35), C.orange, 1, 0.6 + Math.sin(t * 13) * 0.2);
        sparks(ctx, x + 8, y - 26, 10, 40, t, 50);
      }
      break;
    case "chest": {
      const p = box(x, y - 4, 30 * s * 0.8, 14, 16 * s * 0.8);
      glow(ctx, p, C.amber, 1.2);
      const lock = new Path2D(); lock.rect(x - 3, y - 6, 6, 6);
      glow(ctx, lock, C.gold, 1);
      break;
    }
    case "wall": {
      const len = (th.size ?? 3) * S;
      const p = box(x + 10, y - 4, len, 10, 22);
      for (let i = 1; i < 3; i++) { p.moveTo(x + 10 - len / 2, y + 1 - i * 7.3 - 0); p.lineTo(x + 10 + len / 2, y + 1 - i * 7.3); }
      glow(ctx, p, C.violet, 1.1);
      break;
    }
    case "swarm": {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const [px, py] of shape.swarm(300, (th.size ?? 1.5) * S, t)) {
        ctx.fillStyle = C.lime; ctx.globalAlpha = 0.25; ctx.fillRect(x + px - 2, y + py - 2, 4, 4);
        ctx.globalAlpha = 1; ctx.fillRect(x + px - 0.8, y + py - 0.8, 1.6, 1.6);
      }
      ctx.restore();
      break;
    }
  }
}

function neonText(ctx: Ctx, text: string, x: number, y: number, color: string, size = 11) {
  ctx.save();
  ctx.font = `700 ${size}px ${ORB}`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(3,3,10,0.7)";
  const w = ctx.measureText(text).width;
  ctx.fillRect(x - w / 2 - 5, y - size * 0.75, w + 10, size * 1.5);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#ff2050"; ctx.fillText(text, x - 1.2, y);
  ctx.fillStyle = "#20c0ff"; ctx.fillText(text, x + 1.2, y);
  ctx.globalAlpha = 1;
  ctx.shadowColor = color; ctx.shadowBlur = 7;
  ctx.fillStyle = color; ctx.fillText(text, x, y);
  ctx.restore();
}

const COLOR: Record<string, string> = { wolf: C.pink, dragon: C.red, chest: C.amber, wall: C.violet, swarm: C.lime };

export const neonStyle: Style = {
  id: "neon",
  name: "Neon Vector",
  tagline: "Glowing vector lines on black: contour-line terrain over a grid, wireframe pines and city blocks, luminous outline creatures, areas as pulsing rings, CRT scanlines.",
  adjectives: "BURNING adds a flickering orange second outline and a stream of sparks. GIANT doubles the size and stroke and adds an outer echo line.",
  scaling: "One outline per archetype and one colour per word family (beasts magenta, fire red, treasure amber). An adjective is a line effect (echo, flicker, sparks, dashes), so combinations need no new art. Wireframes are cheap to draw by hand or generate as SVG paths, and lines stay readable at any zoom.",
  fonts: [`700 20px 'Orbitron'`, `500 20px 'Orbitron'`, `20px 'Share Tech Mono'`],
  night: "rgba(0,0,12,0.55)",
  world(ctx, t) {
    terrain ??= buildTerrain();
    ctx.drawImage(terrain, 0, 0, W, H);
    water(ctx, t);
    const fire = areas[0]!, love = areas[1]!;
    // Fire: rings radiating out, a jagged flickering edge.
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.45 + i / 4) % 1;
      const p = new Path2D(); p.arc(fire.x, fire.y, fire.r * k, 0, Math.PI * 2);
      glow(ctx, p, k < 0.5 ? C.orange : C.red, 1, 1 - k);
    }
    const jag: Pt[] = Array.from({ length: 48 }, (_, i) => {
      const a = (i / 48) * Math.PI * 2, r = fire.r * (0.94 + (i % 2) * 0.08 + Math.sin(t * 12 + i * 2.1) * 0.03);
      return [fire.x + Math.cos(a) * r, fire.y + Math.sin(a) * r];
    });
    glow(ctx, polyPath(jag), C.red, 1.3);
    sparks(ctx, fire.x, fire.y + 20, fire.r * 0.7, 70, t, 60);
    // Love: rings pulsing inward, a steady edge, and a heart beat.
    const edge = new Path2D(); edge.arc(love.x, love.y, love.r, 0, Math.PI * 2);
    glow(ctx, edge, C.pink, 1.1, 0.8 + Math.sin(t * 4) * 0.2);
    for (let i = 0; i < 3; i++) {
      const k = 1 - ((t * 0.35 + i / 3) % 1);
      const p = new Path2D(); p.arc(love.x, love.y, love.r * k, 0, Math.PI * 2);
      glow(ctx, p, C.pink, 0.7, (1 - k) * 0.7);
    }
    [...things].sort((a, b) => a.y - b.y).forEach((th) => thing(ctx, th, t));
  },
  labels(ctx, t) {
    for (const th of things) {
      const dy = th.kind === "dragon" ? 64 : th.kind === "swarm" ? 48 : 14;
      const col = th.kind === "player" ? (th.who === 0 ? C.cyan : C.gold) : COLOR[th.kind] ?? "#fff";
      neonText(ctx, th.kind === "player" && th.held ? `${th.label} · ${th.held.toUpperCase()}` : th.label, th.x, th.y + dy, col, th.kind === "swarm" ? 12 : 10);
    }
    neonText(ctx, "FIRE", areas[0]!.x, areas[0]!.y + areas[0]!.r + 12, C.orange, 11);
    neonText(ctx, "LOVE", areas[1]!.x, areas[1]!.y - areas[1]!.r - 10, C.pink, 10);
    ctx.font = `12px ${MONO}`;
    ctx.textAlign = "left"; ctx.fillStyle = "rgba(57,230,255,0.75)";
    ctx.fillText(`SECTOR ${14}.${156}.${199}  //  T+${t.toFixed(1)}`, 12, 16);
    scan ??= scanlines();
    ctx.drawImage(scan, 0, 0, W, H);
  },
  inset(ctx, t) {
    ctx.fillStyle = "#06061a";
    ctx.fillRect(0, 0, inset.w, inset.h);
    ctx.strokeStyle = "rgba(138,125,255,0.18)"; ctx.lineWidth = 0.5;
    for (let x = 0; x < inset.w; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, inset.h); ctx.stroke(); }
    for (let y = 0; y < inset.h; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(inset.w, y); ctx.stroke(); }
    thing(ctx, inset.sword, t);
    thing(ctx, inset.wolf, t);
    neonText(ctx, "BURNING SWORD", 70, 150, C.orange, 10);
    neonText(ctx, "GIANT WOLF", 190, 150, C.pink, 10);
  },
};
