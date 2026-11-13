/**
 * 2. INK AND PARCHMENT. An illuminated map: parchment with grain, wobbling ink lines, coastlines
 * echoed by ripple lines, woodcut trees and hills, towns with vermilion roofs, creatures as
 * engraved silhouettes, labels in blackletter with a rubricated (red) first letter.
 *
 * Scaling: one engraved silhouette per archetype (quadruped, flyer, humanoid, chest, swarm...)
 * plus a pigment per word family (beasts in ink, fire things in vermilion, magic in lapis).
 * Adjectives are marginalia drawn on top: flames for BURNING, a larger engraving with heavier
 * hatching for GIANT. A later pass can add a hand-made engraving for the few hundred commonest
 * nouns; the rest keep their archetype and their blackletter name.
 */
import { areas, COLS, H, inset, ROWS, S, things, tile, Tile, W, type Thing } from "./scene.js";
import * as shape from "./shapes.js";
import type { Style } from "./style.js";
import { circle, contour, fbm, grainCanvas, hash, layer, makeField, maskCanvas, place, smooth, strokeSegments, tracePoly, type Ctx, type Pt } from "./util.js";

const INK = "#2b1d14";
const VERMILION = "#b8321e";
const LAPIS = "#2f4f86";
const GOLD = "#b8892b";
const VERDIGRIS = "#7d9a5a";
const PARCH: [number, number, number] = [233, 214, 168];
const BLACK = "'UnifrakturMaguntia', 'Old English Text MT', serif";
const FELL = "'IM Fell English', Georgia, serif";

/** Parallel lines across a box at an angle; the caller clips. */
function hatch(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, angle: number, gap: number, color: string, width: number) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
  const dx = Math.cos(angle), dy = Math.sin(angle);
  ctx.beginPath();
  for (let o = -r; o <= r; o += gap) {
    const px = cx - dy * o, py = cy + dx * o;
    ctx.moveTo(px - dx * r, py - dy * r);
    ctx.lineTo(px + dx * r, py + dy * r);
  }
  ctx.stroke();
  ctx.restore();
}

function bounds(pts: Pt[]): [number, number, number, number] {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  return [a, b, c, d];
}

/** A filled silhouette with an ink outline and hatching: shade on the lower side, highlights above. */
function engrave(ctx: Ctx, pts: Pt[], fill: string, opts: { shade?: string; light?: string; outline?: number; wobble?: number; seed?: number; gap?: number } = {}) {
  const p = smooth(pts, 1);
  const [x0, y0, x1, y1] = bounds(p);
  tracePoly(ctx, p, true, opts.wobble ?? 0.8, opts.seed ?? 1);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const mid = y0 + (y1 - y0) * 0.55;
  ctx.beginPath(); ctx.rect(x0 - 2, mid, x1 - x0 + 4, y1 - mid + 2); ctx.save(); ctx.clip();
  hatch(ctx, x0, mid, x1, y1, 0.7, opts.gap ?? 2.6, opts.shade ?? INK, 0.8);
  ctx.restore();
  if (opts.light) {
    ctx.beginPath(); ctx.rect(x0 - 2, y0 - 2, x1 - x0 + 4, (y1 - y0) * 0.35 + 2); ctx.clip();
    hatch(ctx, x0, y0, x1, y0 + (y1 - y0) * 0.35, -0.15, 3, opts.light, 0.7);
  }
  ctx.restore();
  tracePoly(ctx, p, true, opts.wobble ?? 0.8, opts.seed ?? 1);
  ctx.strokeStyle = INK;
  ctx.lineWidth = opts.outline ?? 1.4;
  ctx.lineJoin = "round";
  ctx.stroke();
}

let terrain: HTMLCanvasElement | null = null;

function buildTerrain(): HTMLCanvasElement {
  const res = 2;
  const [c, ctx] = layer(W, H, res);
  // Parchment: blotchy base and fibre grain.
  const grain = grainCanvas(W, H, 5, (x, y, n) => {
    const b = fbm(x / 140, y / 140, 3) - 0.5, f = fbm(x / 18, y / 6, 8) - 0.5;
    const k = b * 26 + f * 8 + (n - 0.5) * 10;
    return [PARCH[0] + k, PARCH[1] + k * 0.95, PARCH[2] + k * 0.8, 255];
  });
  ctx.drawImage(grain, 0, 0, W, H);

  const land = makeField(COLS, ROWS, S, 4, 3, (x, y) => { const t = tile(x, y); return t === Tile.Water || t === Tile.DeepWater ? 0 : 1; });
  const deep = makeField(COLS, ROWS, S, 4, 4, (x, y) => (tile(x, y) === Tile.DeepWater ? 1 : 0));
  ctx.drawImage(maskCanvas(land, W, H, res, -0.5, [47, 79, 134], { alpha: 0.22, soft: 0.6 }), 0, 0, W, H);
  // Sea: lapis wash that deepens away from the shore, and ripple lines echoing the coast.
  const sea = makeField(COLS, ROWS, S, 4, 3, (x, y) => { const t = tile(x, y); return t === Tile.Water || t === Tile.DeepWater ? 1 : 0; });
  ctx.drawImage(maskCanvas(sea, W, H, res, 0.5, [80, 112, 160], { alpha: 0.32, rough: 0.05 }), 0, 0, W, H);
  ctx.drawImage(maskCanvas(deep, W, H, res, 0.4, [47, 79, 134], { alpha: 0.3, soft: 0.3 }), 0, 0, W, H);
  ctx.lineCap = "round";
  [0.36, 0.24, 0.14, 0.07].forEach((lv, i) => {
    ctx.strokeStyle = `rgba(36,52,92,${0.7 - i * 0.14})`;
    ctx.lineWidth = 1.1 - i * 0.15;
    strokeSegments(ctx, contour(land, lv), 2.5, 10 + i);
  });
  // Wave marks out at sea.
  ctx.strokeStyle = "rgba(36,52,92,0.55)";
  ctx.lineWidth = 1;
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
    if (tile(tx, ty) !== Tile.DeepWater && !(tile(tx, ty) === Tile.Water && hash(tx, ty, 2) < 0.3)) continue;
    if (hash(tx, ty, 1) < 0.45) continue;
    const x = tx * S + hash(tx, ty, 3) * 20 + 6, y = ty * S + hash(tx, ty, 4) * 20 + 6;
    ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.quadraticCurveTo(x - 3, y - 3, x, y); ctx.quadraticCurveTo(x + 3, y - 3, x + 6, y); ctx.stroke();
  }

  // Roads and town ground.
  const road = makeField(COLS, ROWS, S, 4, 1, (x, y) => (tile(x, y) === Tile.Road ? 1 : 0));
  const town = makeField(COLS, ROWS, S, 4, 3, (x, y) => (tile(x, y) === Tile.City ? 1 : 0));
  ctx.drawImage(maskCanvas(road, W, H, res, 0.5, [196, 160, 98], { alpha: 0.75, rough: 0.08 }), 0, 0, W, H);
  ctx.strokeStyle = "rgba(43,29,20,0.75)"; ctx.lineWidth = 1;
  strokeSegments(ctx, contour(road, 0.5), 1.5, 20);
  ctx.drawImage(maskCanvas(town, W, H, res, 0.5, [241, 228, 194], { alpha: 0.9 }), 0, 0, W, H);

  // Grass tufts and sand stipple.
  ctx.lineWidth = 0.9;
  for (let ty = -1; ty <= ROWS; ty++) for (let tx = -1; tx <= COLS; tx++) {
    const k = tile(tx, ty);
    if (k === Tile.Grass) {
      for (let i = 0; i < 3; i++) {
        if (hash(tx, ty, 30 + i) < 0.55) continue;
        const x = tx * S + hash(tx, ty, 40 + i) * S, y = ty * S + hash(tx, ty, 50 + i) * S;
        ctx.strokeStyle = "rgba(74,80,40,0.7)";
        ctx.beginPath();
        ctx.moveTo(x - 3, y - 4); ctx.lineTo(x - 1, y); ctx.moveTo(x, y - 6); ctx.lineTo(x, y); ctx.moveTo(x + 3, y - 4); ctx.lineTo(x + 1, y);
        ctx.stroke();
      }
    } else if (k === Tile.Sand) {
      ctx.fillStyle = "rgba(90,60,30,0.55)";
      for (let i = 0; i < 14; i++) ctx.fillRect(tx * S + hash(tx, ty, 60 + i) * S, ty * S + hash(tx, ty, 80 + i) * S, 1.1, 1.1);
    }
  }

  // Woodcut features, back to front: hills, mountains, trees, houses.
  const marks: { y: number; draw: () => void }[] = [];
  for (let ty = -1; ty <= ROWS + 1; ty++) for (let tx = -1; tx <= COLS; tx++) {
    const k = tile(tx, ty);
    const r = (i: number) => hash(tx, ty, 100 + i);
    if (k === Tile.Hill && r(0) < 0.7) {
      const x = tx * S + 16 + (r(1) - 0.5) * 12, y = ty * S + 22 + (r(2) - 0.5) * 8, w = 15 + r(3) * 6, h = 10 + r(4) * 5;
      marks.push({ y, draw: () => {
        const pts: Pt[] = [[x - w, y], [x - w * 0.5, y - h * 0.8], [x, y - h], [x + w * 0.55, y - h * 0.7], [x + w, y]];
        const p = smooth(pts, 3, false);
        tracePoly(ctx, p, true, 0, 0); ctx.fillStyle = "rgba(205,184,128,0.9)"; ctx.fill();
        ctx.save(); ctx.clip(); ctx.beginPath(); ctx.rect(x + w * 0.05, y - h - 2, w, h + 2); ctx.clip(); hatch(ctx, x, y - h, x + w, y, 1.2, 2.4, INK, 0.7); ctx.restore();
        tracePoly(ctx, p, false, 0.8, tx * 31 + ty); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
      } });
    } else if (k === Tile.Mountain && r(0) < 0.85) {
      const x = tx * S + 16 + (r(1) - 0.5) * 10, y = ty * S + 28, w = 18 + r(3) * 6, h = 28 + r(4) * 10;
      marks.push({ y, draw: () => {
        const pts: Pt[] = [[x - w, y], [x - w * 0.4, y - h * 0.55], [x - w * 0.1, y - h], [x + w * 0.3, y - h * 0.6], [x + w, y]];
        tracePoly(ctx, pts, true, 1.5, tx + ty * 7); ctx.fillStyle = "#d9c493"; ctx.fill();
        ctx.save(); ctx.clip(); ctx.beginPath(); ctx.moveTo(x - w * 0.1, y - h); ctx.lineTo(x + w, y); ctx.lineTo(x - w * 0.2, y); ctx.closePath(); ctx.clip(); hatch(ctx, x - w, y - h, x + w, y, 1.0, 2, INK, 0.8); ctx.restore();
        tracePoly(ctx, pts, false, 1.5, tx + ty * 7); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      } });
    } else if (k === Tile.Forest) {
      for (let i = 0; i < 2; i++) {
        const x = tx * S + 8 + r(10 + i) * 18 + i * 6, y = ty * S + 12 + r(20 + i) * 18;
        const R = 7 + r(30 + i) * 4;
        const conifer = r(40 + i) < 0.35;
        marks.push({ y, draw: () => {
          ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - R * 0.9); ctx.stroke();
          let crown: Pt[];
          if (conifer) crown = [[x, y - R * 3], [x + R * 0.9, y - R * 0.7], [x - R * 0.9, y - R * 0.7]];
          else crown = smooth(circle(x, y - R * 1.6, R, 10).map(([px, py], j) => [px + (hash(j, tx, ty) - 0.5) * 3, py + (hash(j, ty, tx) - 0.5) * 3] as Pt), 2);
          engrave(ctx, crown, conifer ? "#6c8a4e" : VERDIGRIS, { gap: 2.2, outline: 1.2, seed: tx * 13 + ty });
        } });
      }
    } else if (k === Tile.City) {
      const street = ((tx % 3) + 3) % 3 === 0 && ((ty % 3) + 3) % 3 === 0;
      if (street || r(0) < 0.3) continue;
      const tower = r(1) < 0.12;
      const x = tx * S + 16 + (r(2) - 0.5) * 6, y = ty * S + 26, w = tower ? 8 : 10 + r(3) * 4, h = tower ? 22 : 10 + r(4) * 5;
      marks.push({ y, draw: () => {
        engrave(ctx, [[x - w, y], [x - w, y - h], [x + w, y - h], [x + w, y]], "#efe0bb", { gap: 2.4, outline: 1.2, seed: tx + ty * 9 });
        const roof: Pt[] = tower ? [[x - w - 2, y - h], [x, y - h - 16], [x + w + 2, y - h]] : [[x - w - 2, y - h], [x - w * 0.5, y - h - 9], [x + w * 0.5, y - h - 9], [x + w + 2, y - h]];
        engrave(ctx, roof, tower ? LAPIS : VERMILION, { gap: 2.2, outline: 1.2, seed: tx * 3 + ty });
        ctx.fillStyle = INK; ctx.fillRect(x - 1.5, y - 5, 3, 5);
        if (!tower) { ctx.fillRect(x - w + 3, y - h + 3, 2.5, 2.5); ctx.fillRect(x + w - 5.5, y - h + 3, 2.5, 2.5); }
      } });
    }
  }
  marks.sort((a, b) => a.y - b.y).forEach((m) => m.draw());
  // Town wall: a heavy ink line with crenels.
  ctx.strokeStyle = INK; ctx.lineWidth = 2.6;
  strokeSegments(ctx, contour(town, 0.45), 1.5, 30);
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(43,29,20,0.6)";
  strokeSegments(ctx, contour(town, 0.3), 1.5, 31);

  // A compass rose in the margin, and a burnt vignette.
  const cx = 29.3 * S, cy = 11.4 * S;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.12);
  for (let i = 0; i < 8; i++) {
    const long = i % 2 === 0, L = long ? 26 : 14;
    ctx.save(); ctx.rotate((i * Math.PI) / 4);
    ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(4, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fillStyle = i === 0 ? VERMILION : INK; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(-4, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fillStyle = "#efe0bb"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
  ctx.font = `14px ${BLACK}`; ctx.fillStyle = VERMILION; ctx.textAlign = "center"; ctx.fillText("N", 0, -30);
  ctx.restore();

  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.72);
  v.addColorStop(0, "rgba(90,50,20,0)"); v.addColorStop(1, "rgba(90,50,20,0.45)");
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  return c;
}

/** A woodcut flame: an S-curved tongue, swaying. */
function flame(ctx: Ctx, x: number, y: number, h: number, t: number, seed: number) {
  const sway = Math.sin(t * 6 + seed) * h * 0.12, w = h * 0.38;
  const outer: Pt[] = [[x - w, y], [x - w * 0.9, y - h * 0.4], [x - w * 0.2 + sway * 0.5, y - h * 0.7], [x + sway, y - h], [x + w * 0.5 + sway * 0.4, y - h * 0.55], [x + w, y - h * 0.25], [x + w * 0.6, y]];
  engrave(ctx, outer, VERMILION, { gap: 2.4, outline: 1.2, seed });
  const inner: Pt[] = [[x - w * 0.45, y], [x - w * 0.3, y - h * 0.35], [x + sway * 0.6, y - h * 0.62], [x + w * 0.35, y - h * 0.3], [x + w * 0.3, y]];
  tracePoly(ctx, smooth(inner, 1), true, 0, 0); ctx.fillStyle = "#e8b23a"; ctx.fill();
}

function heart(ctx: Ctx, x: number, y: number, s: number, fill: string) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y, x - s * 0.7, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y, x, y + s * 0.9);
  ctx.fillStyle = fill; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.stroke();
}

function swordAt(ctx: Ctx, x: number, y: number, s: number, rot: number, burning: boolean, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  engrave(ctx, shape.sword.blade, "#e9e4d6", { gap: 2, outline: 1.1, wobble: 0.3 });
  engrave(ctx, shape.sword.guard, GOLD, { outline: 1, wobble: 0.2 });
  engrave(ctx, shape.sword.grip, INK, { outline: 1, wobble: 0 });
  engrave(ctx, shape.sword.pommel, GOLD, { outline: 1, wobble: 0 });
  if (burning) for (let i = 0; i < 5; i++) flame(ctx, (i % 2 ? 3 : -3), -8 - i * 5.5, 10 + (i % 3) * 3, t, i * 1.7);
  ctx.restore();
}

function thing(ctx: Ctx, th: Thing, t: number) {
  const { x, y, scale: s, facing } = th;
  const flip = facing < 0;
  const shadow = (w: number, dy = 0) => { ctx.fillStyle = "rgba(43,29,20,0.18)"; ctx.beginPath(); ctx.ellipse(x, y + dy, w, w * 0.18, 0, 0, Math.PI * 2); ctx.fill(); };
  switch (th.kind) {
    case "wolf": {
      const giant = th.label.startsWith("GIANT");
      shadow(24 * s);
      for (const leg of shape.wolf.farLegs) engrave(ctx, place(leg, x, y, s, flip), "#3b2a1e", { outline: 1 });
      engrave(ctx, place(shape.wolf.body, x, y, s, flip), "#4a3526", { light: "#e9d6a8", gap: giant ? 1.8 : 2.4, outline: giant ? 2 : 1.4, seed: 4 });
      const [ex, ey] = place([shape.wolf.eye], x, y, s, flip)[0]!;
      ctx.fillStyle = VERMILION; ctx.beginPath(); ctx.arc(ex, ey, 1.4 * s, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "dragon": {
      const hover = Math.sin(t * 2) * 3;
      shadow(48 * s, 44 * s);
      const f = Math.sin(t * 3.5);
      engrave(ctx, place(shape.dragonWing(f * 0.8), x - 8 * s, y + hover - 2 * s, s * 0.85, flip), "#3c5a8e", { gap: 2.2, outline: 1.2 });
      engrave(ctx, place(shape.dragonBody, x, y + hover, s, flip), VERMILION, { gap: 2.2, outline: 1.6, light: "#f0c27a", seed: 3 });
      const wing = place(shape.dragonWing(f), x, y + hover, s, flip);
      engrave(ctx, wing, LAPIS, { gap: 2.2, outline: 1.5, light: "#9fb4d8", seed: 5 });
      ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath(); for (const i of [2, 4, 6]) { ctx.moveTo(wing[0]![0], wing[0]![1]); ctx.lineTo(wing[i]![0], wing[i]![1]); } ctx.stroke();
      const [ex, ey] = place([shape.dragonEye], x, y + hover, s, flip)[0]!;
      ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(ex, ey, 1.8 * s, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "player": {
      shadow(10 * s);
      const robe = th.who === 0 ? LAPIS : VERMILION;
      engrave(ctx, place(shape.human.body, x, y, s, flip), robe, { gap: 2.2, light: "#e9d6a8", seed: th.who ?? 0 });
      engrave(ctx, place(shape.human.head, x, y, s, flip), "#ecd3a8", { gap: 2.4, outline: 1.2 });
      if (th.held) {
        const [hx, hy] = place([shape.human.hand], x, y, s, flip)[0]!;
        swordAt(ctx, hx, hy, s * 0.8, 0.5 * facing, false, t);
      }
      break;
    }
    case "sword":
      swordAt(ctx, x, y, s * 1.4, 0.35, !!th.burning, t);
      break;
    case "chest": {
      shadow(17 * s);
      engrave(ctx, place(shape.chest.body, x, y, s), "#8a5a2b", { gap: 2.2, outline: 1.4, light: "#e9c88a" });
      engrave(ctx, place(shape.chest.lid, x, y, s), "#9c6a35", { gap: 2.2, outline: 1.4, light: "#e9c88a" });
      ctx.fillStyle = INK;
      for (const bx of [-10, 10]) ctx.fillRect(x + bx * s - 1.5 * s, y - 25 * s, 3 * s, 25 * s);
      ctx.fillStyle = GOLD; ctx.fillRect(x - 3 * s, y - 17 * s, 6 * s, 7 * s);
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(x - 3 * s, y - 17 * s, 6 * s, 7 * s);
      break;
    }
    case "wall": {
      const len = (th.size ?? 3) * S, hgt = 22, top = 8;
      shadow(len * 0.55, 2);
      engrave(ctx, [[x - len / 2, y - hgt - top], [x + len / 2, y - hgt - top], [x + len / 2, y - hgt], [x - len / 2, y - hgt]], "#d8c79c", { outline: 1.2, gap: 4 });
      engrave(ctx, [[x - len / 2, y - hgt], [x + len / 2, y - hgt], [x + len / 2, y], [x - len / 2, y]], "#b9a272", { outline: 1.4, gap: 2.4 });
      ctx.strokeStyle = INK; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let row = 1; row < 3; row++) { ctx.moveTo(x - len / 2, y - hgt + row * 7.3); ctx.lineTo(x + len / 2, y - hgt + row * 7.3); }
      for (let row = 0; row < 3; row++) for (let bx = (row % 2) * 8 + 8; bx < len; bx += 16) { ctx.moveTo(x - len / 2 + bx, y - hgt + row * 7.3); ctx.lineTo(x - len / 2 + bx, y - hgt + (row + 1) * 7.3); }
      ctx.stroke();
      break;
    }
    case "swarm": {
      const pts = shape.swarm(220, (th.size ?? 1.5) * S, t);
      ctx.fillStyle = INK;
      for (const [px, py] of pts) {
        const a = Math.atan2(py, px) + Math.PI / 2;
        const dx = Math.cos(a) * 1.6, dy = Math.sin(a) * 1.6;
        ctx.beginPath();
        ctx.arc(x + px - dx, y + py - dy, 0.9, 0, 7); ctx.arc(x + px, y + py, 0.8, 0, 7); ctx.arc(x + px + dx, y + py + dy, 1.2, 0, 7);
        ctx.fill();
      }
      break;
    }
  }
}

/** Blackletter with a rubricated first letter, on a parchment halo. */
function rubric(ctx: Ctx, text: string, x: number, y: number, size: number, rest?: string) {
  const words = text.split(" ");
  const head = words[0]!, tail = rest ?? words.slice(1).join(" ");
  const cap = head[0]!, body = head.slice(1).toLowerCase();
  ctx.font = `${size}px ${BLACK}`;
  const capW = ctx.measureText(cap).width, bodyW = ctx.measureText(body).width;
  ctx.font = `italic ${size * 0.8}px ${FELL}`;
  const tailW = tail ? ctx.measureText(" " + tail).width : 0;
  let cx = x - (capW + bodyW + tailW) / 2;
  ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  const put = (s: string, font: string, color: string) => {
    ctx.font = font;
    ctx.strokeStyle = "rgba(240,226,188,0.92)"; ctx.lineWidth = 4; ctx.strokeText(s, cx, y);
    ctx.fillStyle = color; ctx.fillText(s, cx, y);
    cx += ctx.measureText(s).width;
  };
  put(cap, `${size * 1.15}px ${BLACK}`, VERMILION);
  put(body, `${size}px ${BLACK}`, INK);
  if (tail) put(" " + tail, `italic ${size * 0.8}px ${FELL}`, INK);
}

export const inkStyle: Style = {
  id: "ink",
  name: "Ink and Parchment",
  tagline: "An illuminated map: parchment grain, wobbling ink, coastlines echoed by ripple lines, woodcut forests and hills, towns with vermilion roofs, engraved beasts, blackletter names with a red capital.",
  adjectives: "BURNING adds woodcut flames up the blade, in vermilion and gold. GIANT is the same engraving drawn larger with heavier line and denser hatching.",
  scaling: "One engraved silhouette per archetype (quadruped, flyer, humanoid, box, swarm), tinted with a pigment per word family: ink for beasts, vermilion for fire, lapis for magic, gold for treasure. Adjectives are marginalia drawn over it. The commonest few hundred nouns can later get their own engraving; the rest keep the archetype and their blackletter name.",
  fonts: [`20px 'UnifrakturMaguntia'`, `20px 'IM Fell English'`, `italic 20px 'IM Fell English'`, `20px 'IM Fell English SC'`],
  night: "rgba(24,20,48,0.7)",
  world(ctx, t) {
    terrain ??= buildTerrain();
    ctx.drawImage(terrain, 0, 0, W, H);
    const fire = areas[0]!, love = areas[1]!;
    // Fire: a ring of dashes and a cluster of flames.
    ctx.save();
    ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 8;
    ctx.strokeStyle = VERMILION; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(fire.x, fire.y, fire.r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    const wash = ctx.createRadialGradient(fire.x, fire.y, 0, fire.x, fire.y, fire.r);
    wash.addColorStop(0, "rgba(184,50,30,0.28)"); wash.addColorStop(1, "rgba(184,50,30,0.04)");
    ctx.fillStyle = wash; ctx.beginPath(); ctx.arc(fire.x, fire.y, fire.r, 0, Math.PI * 2); ctx.fill();
    const flames = Array.from({ length: 14 }, (_, i) => ({ a: hash(i, 1, 7) * Math.PI * 2, d: Math.sqrt(hash(i, 2, 7)) * fire.r * 0.8, i }))
      .map((f) => ({ ...f, x: fire.x + Math.cos(f.a) * f.d, y: fire.y + Math.sin(f.a) * f.d * 0.8 + 10 })).sort((a, b) => a.y - b.y);
    for (const f of flames) flame(ctx, f.x, f.y, 18 + hash(f.i, 3, 7) * 14 + Math.sin(t * 8 + f.i) * 2, t, f.i);
    // Love: a decorated border of hearts.
    ctx.fillStyle = "rgba(184,50,30,0.08)";
    ctx.beginPath(); ctx.arc(love.x, love.y, love.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = VERMILION; ctx.lineWidth = 1; ctx.setLineDash([1.5, 3]);
    ctx.beginPath(); ctx.arc(love.x, love.y, love.r - 6, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(love.x, love.y, love.r, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.15;
      heart(ctx, love.x + Math.cos(a) * love.r, love.y + Math.sin(a) * love.r, 4.5, i % 2 ? VERMILION : "#e8b23a");
    }
    [...things].sort((a, b) => a.y - b.y).forEach((th) => thing(ctx, th, t));
  },
  labels(ctx) {
    for (const th of things) {
      const dy = th.kind === "dragon" ? 64 : th.kind === "swarm" ? 50 : 13;
      if (th.kind === "swarm") rubric(ctx, "Ant", th.x, th.y + dy, 17, "×1,000");
      else if (th.kind === "player") rubric(ctx, th.who === 0 ? "You" : "Mira", th.x, th.y + dy, 16, th.held ? "with Sword" : undefined);
      else rubric(ctx, th.label, th.x, th.y + dy, 16);
    }
    const fire = areas[0]!;
    rubric(ctx, "Fire", fire.x, fire.y + fire.r + 12, 18);
    const love = areas[1]!;
    rubric(ctx, "Love", love.x, love.y - love.r - 10, 16);
  },
  inset(ctx, t) {
    ctx.fillStyle = "#e9d6a8";
    ctx.fillRect(0, 0, inset.w, inset.h);
    ctx.strokeStyle = INK; ctx.lineWidth = 1;
    ctx.strokeRect(4.5, 4.5, inset.w - 9, inset.h - 9);
    ctx.strokeStyle = VERMILION; ctx.strokeRect(7.5, 7.5, inset.w - 15, inset.h - 15);
    thing(ctx, inset.sword, t);
    thing(ctx, inset.wolf, t);
    rubric(ctx, "Burning Sword", 70, 146, 15);
    rubric(ctx, "Giant Wolf", 192, 146, 15);
  },
};
