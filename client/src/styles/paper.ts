/**
 * 4. PAPER DIORAMA. Layered papercraft: each height of land is a cut sheet with a torn white
 * edge and a soft drop shadow, trees and houses are little paper cut-outs, creatures are
 * cardboard standees with a white cut border and a stand, areas are tissue paper.
 *
 * Scaling: one cut-out silhouette per archetype in a craft-paper colour per word family; the
 * standee, border and shadow are added by code, so a new noun is its archetype plus a colour
 * and a paper tag with its name. Adjectives are extra paper pieces glued on (flames for
 * BURNING) or a change of scale and shadow depth (GIANT stands taller and casts further).
 */
import { areas, COLS, H, inset, ROWS, S, things, tile, Tile, W, type Thing } from "./scene.js";
import * as shape from "./shapes.js";
import type { Style } from "./style.js";
import { circle, grainCanvas, hash, layer, makeField, maskCanvas, place, smooth, tracePoly, vnoise, type Ctx, type Pt } from "../art/util.js";

const HAND = "'Kalam', 'Comic Sans MS', cursive";
const RIM: [number, number, number] = [250, 245, 232];
const rgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function withShadow(ctx: Ctx, depth: number, fn: () => void) {
  ctx.save();
  const k = ctx.getTransform().a;
  ctx.shadowColor = `rgba(50,35,20,${0.22 + depth * 0.04})`;
  ctx.shadowOffsetX = depth * 0.8 * k;
  ctx.shadowOffsetY = depth * 1.2 * k;
  ctx.shadowBlur = depth * 1.6 * k;
  fn();
  ctx.restore();
}

let terrain: HTMLCanvasElement | null = null;
let fibre: HTMLCanvasElement | null = null;

/** One sheet: a torn white rim under a coloured fill, dropped onto the scene with a shadow. */
function sheet(ctx: Ctx, test: (t: Tile) => boolean, color: string, depth: number, seed: number, blur = 3) {
  const field = makeField(COLS, ROWS, S, 4, blur, (x, y) => (test(tile(x, y)) ? 1 : 0));
  const [c, g] = layer(W, H, 1);
  g.drawImage(maskCanvas(field, W, H, 1, 0.42, RIM, { rough: 0.16, roughScale: 2.5, seed, soft: 0.04 }), 0, 0);
  g.drawImage(maskCanvas(field, W, H, 1, 0.5, rgb(color), { rough: 0.1, roughScale: 5, seed: seed + 1, soft: 0.03 }), 0, 0);
  withShadow(ctx, depth, () => ctx.drawImage(c, 0, 0, W, H));
}

function blob(x: number, y: number, r: number, seed: number, n = 12): Pt[] {
  return circle(x, y, r, n).map(([px, py], i) => [x + (px - x) * (0.88 + hash(i, seed, 1) * 0.24), y + (py - y) * (0.88 + hash(i, seed, 2) * 0.24)] as Pt);
}

function fill(ctx: Ctx, pts: Pt[], color: string) {
  tracePoly(ctx, pts);
  ctx.fillStyle = color;
  ctx.fill();
}

/** A cut-out: white border, coloured face, a faint fold highlight. */
function cutout(ctx: Ctx, pts: Pt[], color: string, depth = 3, border = 2.2) {
  const p = smooth(pts, 1);
  withShadow(ctx, depth, () => {
    tracePoly(ctx, p);
    ctx.lineJoin = "round";
    ctx.lineWidth = border * 2;
    ctx.strokeStyle = "#fbf7ec";
    ctx.stroke();
    ctx.fillStyle = "#fbf7ec";
    ctx.fill();
  });
  fill(ctx, p, color);
  // A fold: the upper-left half catches the light.
  ctx.save();
  tracePoly(ctx, p);
  ctx.clip();
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x0, y1); ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fill();
  ctx.restore();
}

function buildTerrain(): HTMLCanvasElement {
  const [c, ctx] = layer(W, H, 2);
  ctx.fillStyle = "#4d7b8c";
  ctx.fillRect(0, 0, W, H);
  const water = (t: Tile) => t === Tile.Water || t === Tile.DeepWater;
  sheet(ctx, (t) => t !== Tile.DeepWater, "#6d9eaa", 2, 1, 4);
  sheet(ctx, (t) => !water(t), "#e6d3a3", 3, 3);
  sheet(ctx, (t) => !water(t) && t !== Tile.Sand, "#a3b86f", 3, 5);
  sheet(ctx, (t) => t === Tile.Forest, "#7f9b5a", 2, 7, 2);
  sheet(ctx, (t) => t === Tile.City, "#ddd0b6", 2, 9);
  sheet(ctx, (t) => t === Tile.Road, "#c9a77a", 2, 11, 1);
  sheet(ctx, (t) => t === Tile.Hill || t === Tile.Mountain, "#b9b077", 4, 13);
  sheet(ctx, (t) => t === Tile.Mountain, "#a39b8c", 5, 15, 2);

  // Little cut-outs, back to front.
  const marks: { y: number; draw: () => void }[] = [];
  for (let ty = -1; ty <= ROWS + 1; ty++) for (let tx = -1; tx <= COLS; tx++) {
    const k = tile(tx, ty), r = (i: number) => hash(tx, ty, 200 + i);
    if (k === Tile.Forest) {
      for (let i = 0; i < 2; i++) {
        const x = tx * S + 8 + r(i) * 18 + i * 4, y = ty * S + 10 + r(i + 4) * 18, R = 7 + r(i + 8) * 4;
        const pine = r(i + 12) < 0.3;
        marks.push({ y, draw: () => {
          withShadow(ctx, 3, () => { ctx.fillStyle = "#6b4a2e"; ctx.fillRect(x - 1.5, y - R * 0.8, 3, R * 0.8); });
          if (pine) {
            cutout(ctx, [[x, y - R * 3.1], [x + R, y - R * 0.6], [x - R, y - R * 0.6]], "#4f7a4a", 3, 1);
          } else {
            const crown = blob(x, y - R * 1.5, R, tx * 31 + ty + i);
            cutout(ctx, crown, ["#5f8a4a", "#6f9a50", "#557f45"][Math.floor(r(i + 16) * 3)]!, 3, 1);
            fill(ctx, blob(x - R * 0.25, y - R * 1.75, R * 0.55, tx + ty * 7 + i, 9), "rgba(190,220,140,0.35)");
          }
        } });
      }
    } else if (k === Tile.City && !(((tx % 3) + 3) % 3 === 0 && ((ty % 3) + 3) % 3 === 0) && r(0) > 0.25) {
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
        fill(ctx, [[x - w * 0.32, y - h * 0.68], [x, y - h], [x + w * 0.32, y - h * 0.68], [x + w * 0.1, y - h * 0.6], [x - w * 0.1, y - h * 0.72]], "#f6f1e6");
      } });
    } else if (k === Tile.Hill && r(0) < 0.35) {
      const x = tx * S + 16, y = ty * S + 24, w = 14 + r(2) * 6;
      marks.push({ y, draw: () => cutout(ctx, smooth([[x - w, y], [x - w * 0.4, y - 10], [x + w * 0.3, y - 12], [x + w, y]], 2), "#c3ba80", 2, 0.8) });
    } else if (k === Tile.Grass && r(0) < 0.12) {
      const x = tx * S + r(1) * S, y = ty * S + r(2) * S;
      marks.push({ y, draw: () => cutout(ctx, [[x - 4, y], [x - 2, y - 6], [x, y - 2], [x + 2, y - 7], [x + 4, y]], "#7f9b52", 1.5, 0.6) });
    }
  }
  marks.sort((a, b) => a.y - b.y).forEach((m) => m.draw());
  // Stitched road centre.
  ctx.save();
  ctx.setLineDash([5, 4]); ctx.strokeStyle = "rgba(255,250,235,0.85)"; ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let ty = 0; ty < ROWS; ty++) for (let tx = -1; tx <= COLS; tx++) {
    if (tile(tx, ty) === Tile.Road && tile(tx + 1, ty) === Tile.Road) { ctx.moveTo(tx * S + 16, ty * S + 16); ctx.lineTo(tx * S + 48, ty * S + 16); }
  }
  ctx.stroke();
  ctx.restore();
  return c;
}

function paperFibre(): HTMLCanvasElement {
  return grainCanvas(W, H, 8, (x, y, n) => {
    const v = vnoise(x / 3, y / 40, 4) * 0.6 + n * 0.4;
    const k = v > 0.5 ? 255 : 0;
    return [k, k, k, Math.abs(v - 0.5) * 34];
  });
}

function heart(x: number, y: number, s: number): Pt[] {
  return Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    const hx = 16 * Math.sin(a) ** 3, hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
    return [x + hx * s / 16, y + hy * s / 16] as Pt;
  });
}

function flamePts(x: number, y: number, h: number, t: number, seed: number): Pt[] {
  const sway = Math.sin(t * 5 + seed) * h * 0.1, w = h * 0.4, lick = 1 + Math.sin(t * 9 + seed * 3) * 0.08;
  return [[x - w, y], [x - w * 1.0, y - h * 0.35], [x - w * 0.4 + sway, y - h * 0.55 * lick], [x - w * 0.5 + sway, y - h * 0.8 * lick], [x + sway * 1.5, y - h * lick],
    [x + w * 0.3 + sway, y - h * 0.62 * lick], [x + w * 0.65, y - h * 0.75 * lick], [x + w, y - h * 0.3], [x + w * 0.8, y]];
}

function paperFlame(ctx: Ctx, x: number, y: number, h: number, t: number, seed: number) {
  cutout(ctx, flamePts(x, y, h, t, seed), "#d9573b", 2, 0.8);
  fill(ctx, smooth(flamePts(x, y, h * 0.68, t + 0.3, seed + 1), 1), "#ec8e3e");
  fill(ctx, smooth(flamePts(x, y, h * 0.38, t + 0.6, seed + 2), 1), "#f4c95d");
}

function stand(ctx: Ctx, x: number, y: number, w: number) {
  withShadow(ctx, 2, () => {
    ctx.fillStyle = "#9c7b55";
    ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  });
  ctx.fillStyle = "#b8956a";
  ctx.beginPath(); ctx.ellipse(x, y - 1, w * 0.9, w * 0.26, 0, 0, Math.PI * 2); ctx.fill();
}

function swordAt(ctx: Ctx, x: number, y: number, s: number, rot: number, burning: boolean, t: number) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  if (burning) for (let i = 0; i < 4; i++) paperFlame(ctx, (i % 2 ? 4 : -4) * s, (-12 - i * 7) * s, (12 + (i % 2) * 4) * s, t, i * 2.3);
  cutout(ctx, place(shape.sword.blade, 0, 0, s), "#d8e0e4", 3, 1);
  cutout(ctx, place(shape.sword.guard, 0, 0, s), "#c9a24a", 2, 0.8);
  cutout(ctx, place(shape.sword.grip, 0, 0, s), "#6b4a2e", 2, 0.8);
  ctx.restore();
}

function thing(ctx: Ctx, th: Thing, t: number) {
  const { x, y, scale: s, facing } = th;
  const flip = facing < 0;
  const sway = Math.sin(t * 1.6 + x) * 0.025;
  const standee = (fn: () => void) => { ctx.save(); ctx.translate(x, y); ctx.rotate(sway); ctx.translate(-x, -y); fn(); ctx.restore(); };
  switch (th.kind) {
    case "wolf": {
      const giant = th.label.startsWith("GIANT");
      stand(ctx, x, y, 18 * s);
      standee(() => {
        for (const leg of shape.wolf.farLegs) cutout(ctx, place(leg, x, y - 2, s, flip), "#5e6670", giant ? 6 : 3, 1.6);
        cutout(ctx, place(shape.wolf.body, x, y - 2, s, flip), "#8a939e", giant ? 7 : 4, 2.2);
        fill(ctx, place([[24, -18], [28, -19], [26, -16]], x, y - 2, s, flip), "#f3ece0");
        const [ex, ey] = place([shape.wolf.eye], x, y - 2, s, flip)[0]!;
        ctx.fillStyle = "#2b2a28"; ctx.beginPath(); ctx.arc(ex, ey, 1.3 * s, 0, 7); ctx.fill();
      });
      break;
    }
    case "dragon": {
      const hover = Math.sin(t * 2) * 3, f = Math.sin(t * 3.5);
      // Flying: hangs on a thread, with its shadow on the ground far below.
      ctx.fillStyle = "rgba(40,30,20,0.18)";
      ctx.beginPath(); ctx.ellipse(x + 18, y + 48 * s, 44 * s, 8 * s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x, y - 40 * s + hover); ctx.lineTo(x, 0); ctx.stroke();
      cutout(ctx, place(shape.dragonWing(f * 0.8), x - 8 * s, y + hover - 2 * s, s * 0.85, flip), "#b9553c", 6, 1.6);
      cutout(ctx, place(shape.dragonBody, x, y + hover, s, flip), "#c4583c", 8, 2.4);
      fill(ctx, place([[-20, 8], [-6, 11], [8, 11], [20, 5], [8, 7], [-6, 7]], x, y + hover, s, flip), "#e9b46a");
      cutout(ctx, place(shape.dragonWing(f), x, y + hover, s, flip), "#e08a4a", 9, 1.8);
      const [ex, ey] = place([shape.dragonEye], x, y + hover, s, flip)[0]!;
      ctx.fillStyle = "#2b2a28"; ctx.beginPath(); ctx.arc(ex, ey, 1.6 * s, 0, 7); ctx.fill();
      break;
    }
    case "player": {
      const body = th.who === 0 ? "#3f6fa8" : "#a85a8a";
      stand(ctx, x, y, 9 * s);
      standee(() => {
        cutout(ctx, place(shape.human.body, x, y - 2, s, flip), body, 4, 2);
        cutout(ctx, place(shape.human.head, x, y - 2, s, flip), "#efcfae", 4, 2);
        fill(ctx, place([[-6, -38], [6, -38], [7, -34], [3, -36], [-6, -34]], x, y - 2, s, flip), th.who === 0 ? "#5a3a24" : "#2b2a28");
        if (th.held) {
          const [hx, hy] = place([shape.human.hand], x, y - 2, s, flip)[0]!;
          swordAt(ctx, hx, hy, s * 0.8, 0.5 * facing, false, t);
        }
      });
      break;
    }
    case "sword":
      swordAt(ctx, x, y, s * 1.4, 0.3, !!th.burning, t);
      break;
    case "chest": {
      cutout(ctx, place(shape.chest.body, x, y, s), "#a8703c", 4, 1.8);
      cutout(ctx, place(shape.chest.lid, x, y, s), "#bd8448", 4, 1.8);
      ctx.fillStyle = "#5a3a20";
      for (const bx of [-10, 10]) ctx.fillRect(x + (bx - 1.5) * s, y - 25 * s, 3 * s, 25 * s);
      fill(ctx, place([[-3, -18], [3, -18], [3, -11], [-3, -11]], x, y, s), "#e8c45a");
      break;
    }
    case "wall": {
      const len = (th.size ?? 3) * S;
      for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) {
        const bw = len / 5.5, bx = x - len / 2 + i * bw - (row % 2 ? bw / 2 : 0), by = y - (row + 1) * 9;
        if (bx < x - len / 2 - 2 || bx + bw > x + len / 2 + bw * 0.6) continue;
        cutout(ctx, [[bx, by], [bx + bw - 1.5, by], [bx + bw - 1.5, by + 8], [bx, by + 8]], ["#bfb3a0", "#cbbfa9", "#b3a68f"][(i + row) % 3]!, 2, 0.6);
      }
      break;
    }
    case "swarm": {
      const pts = shape.swarm(200, (th.size ?? 1.5) * S, t);
      ctx.fillStyle = "rgba(50,35,20,0.25)";
      for (const [px, py] of pts) ctx.fillRect(x + px + 1, y + py + 1.5, 3, 2);
      for (const [px, py] of pts) {
        ctx.fillStyle = "#3d2a1e"; ctx.fillRect(x + px - 1.5, y + py - 1, 3, 2);
        ctx.fillStyle = "#6b4a32"; ctx.fillRect(x + px - 1.5, y + py - 1, 1.2, 2);
      }
      break;
    }
  }
}

/** A paper tag with a string hole. */
function tag(ctx: Ctx, text: string, x: number, y: number, rot: number, color = "#4a3f33", size = 13) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.font = `700 ${size}px ${HAND}`;
  const w = ctx.measureText(text).width + 18, h = size + 8;
  withShadow(ctx, 2, () => {
    ctx.fillStyle = "#fbf7ec";
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 6, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2 + 6, h / 2); ctx.lineTo(-w / 2, 0); ctx.closePath();
    ctx.fill();
  });
  ctx.fillStyle = "#c9b99a"; ctx.beginPath(); ctx.arc(-w / 2 + 6, 0, 1.8, 0, 7); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, 3, 1);
  ctx.restore();
}

export const paperStyle: Style = {
  id: "paper",
  name: "Paper Diorama",
  tagline: "Layered papercraft: every height of land is a torn sheet with a white edge and a soft shadow, trees and houses are cut-outs, creatures are cardboard standees, areas are tissue paper.",
  adjectives: "BURNING glues layered paper flames onto the thing. GIANT stands it taller, and it casts a longer, softer shadow.",
  scaling: "One cut-out silhouette per archetype in a craft-paper colour per word family; the white border, stand, shadow and paper tag are all added by code. So a new noun is its archetype, a colour and its name on a tag. The terrain is pure code (sheets cut from the map), with no tiles to draw.",
  fonts: [`700 20px 'Kalam'`, `400 20px 'Kalam'`, `700 20px 'Fredoka'`, `500 20px 'Fredoka'`],
  night: "rgba(18,28,64,0.62)",
  world(ctx, t) {
    terrain ??= buildTerrain();
    ctx.drawImage(terrain, 0, 0, W, H);
    // Ripples cut from paper drift on the water.
    ctx.strokeStyle = "rgba(235,245,245,0.45)"; ctx.lineWidth = 1.6; ctx.lineCap = "round";
    for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
      const k = tile(tx, ty);
      if ((k !== Tile.Water && k !== Tile.DeepWater) || hash(tx, ty, 9) < 0.6) continue;
      const x = tx * S + 16 + Math.sin(t * 0.8 + tx) * 4, y = ty * S + 16;
      ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.quadraticCurveTo(x, y - 4, x + 7, y); ctx.stroke();
    }
    const fire = areas[0]!, love = areas[1]!;
    // Tissue paper discs.
    const tissue = (a: typeof fire, color: string, seed: number) => {
      const pts = circle(a.x, a.y, a.r, 40).map(([px, py], i) => [a.x + (px - a.x) * (0.96 + vnoise(i * 0.5, seed) * 0.08), a.y + (py - a.y) * (0.96 + vnoise(i * 0.5, seed + 3) * 0.08)] as Pt);
      withShadow(ctx, 1, () => fill(ctx, pts, color));
    };
    tissue(fire, "rgba(236,120,60,0.30)", 1);
    tissue(love, "rgba(240,140,170,0.30)", 2);
    const flames = Array.from({ length: 13 }, (_, i) => ({ a: hash(i, 1, 7) * Math.PI * 2, d: Math.sqrt(hash(i, 2, 7)) * fire.r * 0.78, i }))
      .map((f) => ({ ...f, x: fire.x + Math.cos(f.a) * f.d, y: fire.y + Math.sin(f.a) * f.d * 0.8 + 14 })).sort((a, b) => a.y - b.y);
    for (const f of flames) paperFlame(ctx, f.x, f.y, 22 + hash(f.i, 3, 7) * 14, t, f.i);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + t * 0.2;
      cutout(ctx, heart(love.x + Math.cos(a) * love.r, love.y + Math.sin(a) * love.r * 0.92, 6 + (i % 2) * 2), i % 2 ? "#e0708f" : "#f2a0b4", 2, 1);
    }
    [...things].sort((a, b) => a.y - b.y).forEach((th) => thing(ctx, th, t));
    fibre ??= paperFibre();
    ctx.drawImage(fibre, 0, 0, W, H);
  },
  labels(ctx) {
    for (const [i, th] of things.entries()) {
      const dy = th.kind === "dragon" ? 66 : th.kind === "swarm" ? 50 : 16;
      tag(ctx, th.kind === "player" && th.held ? `${th.label} + sword` : th.label, th.x, th.y + dy, (hash(i, 3, 3) - 0.5) * 0.12, th.kind === "player" ? (th.who === 0 ? "#2f5a8e" : "#8a3a6e") : "#4a3f33");
    }
    tag(ctx, "FIRE", areas[0]!.x, areas[0]!.y + areas[0]!.r + 14, 0.04, "#b8442a");
    tag(ctx, "LOVE", areas[1]!.x, areas[1]!.y - areas[1]!.r - 14, -0.05, "#b04a6a");
  },
  inset(ctx, t) {
    ctx.fillStyle = "#dccaa6";
    ctx.fillRect(0, 0, inset.w, inset.h);
    ctx.fillStyle = "#a3b86f";
    withShadow(ctx, 3, () => { ctx.beginPath(); ctx.roundRect(8, 96, inset.w - 16, 40, 10); ctx.fill(); });
    thing(ctx, inset.sword, t);
    thing(ctx, inset.wolf, t);
    tag(ctx, "BURNING SWORD", 70, 152, -0.04, "#b8442a", 12);
    tag(ctx, "GIANT WOLF", 194, 152, 0.03, "#4a3f33", 12);
  },
};
