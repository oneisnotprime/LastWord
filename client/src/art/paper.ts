/**
 * Drawing in paper: cut-outs with a white border and a soft drop shadow, paper flames, tags and
 * badges. Everything here draws onto a 2D canvas once; the game turns the canvases into textures.
 */
import { E, type Piece, type Pt, type Silhouette } from "./build.js";
import { HAND, INK, mix, PAPER, ROUND, shade } from "./palette.js";
import { smooth, tracePoly, type Ctx } from "./util.js";

export function withShadow(ctx: Ctx, depth: number, fn: () => void, alpha = 1) {
  ctx.save();
  const k = ctx.getTransform().a;
  ctx.shadowColor = `rgba(50,35,20,${(0.22 + depth * 0.04) * alpha})`;
  ctx.shadowOffsetX = depth * 0.8 * k;
  ctx.shadowOffsetY = depth * 1.2 * k;
  ctx.shadowBlur = depth * 1.6 * k;
  fn();
  ctx.restore();
}

export function fillPoly(ctx: Ctx, pts: Pt[], color: string) {
  tracePoly(ctx, pts);
  ctx.fillStyle = color;
  ctx.fill();
}

/** One cut-out piece: white border, coloured face. */
export function cutout(ctx: Ctx, pts: Pt[], color: string, depth = 3, border = 2) {
  withShadow(ctx, depth, () => {
    tracePoly(ctx, pts);
    ctx.lineJoin = "round";
    ctx.lineWidth = border * 2;
    ctx.strokeStyle = PAPER;
    ctx.stroke();
    ctx.fillStyle = PAPER;
    ctx.fill();
  });
  fillPoly(ctx, pts, color);
}

export interface Inks { body: string; dark: string; deep: string; light: string; pale: string }

export function inks(colour: string, frozen = false): Inks {
  const ice = (c: string) => (frozen ? mix(c, "#cfeaf5", 0.55) : c);
  return { body: ice(colour), dark: ice(shade(colour, -0.22)), deep: ice(shade(colour, -0.45)), light: ice(shade(colour, 0.28)), pale: ice(shade(colour, 0.55)) };
}

const inkOf = (ink: string, k: Inks, frozen: boolean) =>
  ink === "body" || ink === "dark" || ink === "deep" || ink === "light" || ink === "pale" ? k[ink] : frozen ? mix(ink, "#cfeaf5", 0.5) : ink;

export interface Placed { x: number; y: number; s: number; flip: boolean }

const place = (pts: Pt[], p: Placed): Pt[] => pts.map(([x, y]) => [p.x + (p.flip ? -x : x) * p.s, p.y + y * p.s] as Pt);
const shapeOf = (piece: Piece, p: Placed) => {
  const pts = place(piece.pts, p);
  return piece.round ? smooth(pts, piece.round) : pts;
};

/**
 * Draws a silhouette as a standee: pieces glued behind, the body as one cut-out (a single
 * border around the union of its pieces), pieces glued in front, then painted details.
 */
export function drawSilhouette(ctx: Ctx, sil: Silhouette, at: Placed, k: Inks, opts: { frozen?: boolean; depth?: number; ghost?: boolean } = {}) {
  const frozen = !!opts.frozen, depth = opts.depth ?? 3.5;
  const border = Math.max(0.9, Math.min(2.2, 1.6 * at.s));
  const main = sil.pieces.filter((p) => !p.detail && !p.glued);
  const back = sil.pieces.filter((p) => p.glued && p.back);
  const front = sil.pieces.filter((p) => p.glued && !p.back);
  const details = sil.pieces.filter((p) => p.detail);
  if (opts.ghost) {
    ctx.save();
    ctx.globalAlpha = 0.3;
  }
  for (const p of back) cutout(ctx, shapeOf(p, at), inkOf(p.ink, k, frozen), depth * 0.8, border * 0.8);
  // The body's border and shadow, all pieces at once.
  const shapes = main.map((p) => shapeOf(p, at));
  const union = new Path2D();
  for (const pts of shapes) {
    pts.forEach(([x, y], i) => (i ? union.lineTo(x, y) : union.moveTo(x, y)));
    union.closePath();
  }
  withShadow(ctx, depth, () => {
    ctx.lineJoin = "round";
    ctx.lineWidth = border * 2;
    ctx.strokeStyle = PAPER;
    ctx.stroke(union);
    ctx.fillStyle = PAPER;
    ctx.fill(union);
  });
  main.forEach((p, i) => fillPoly(ctx, shapes[i]!, inkOf(p.ink, k, frozen)));
  // A fold: the upper-left catches the light.
  if (shapes.length) {
    const xs = shapes.flat().map((q) => q[0]), ys = shapes.flat().map((q) => q[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
    ctx.save();
    ctx.clip(union);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x0, y1); ctx.closePath();
    ctx.fillStyle = "rgba(255,255,255,0.13)";
    ctx.fill();
    if (frozen) {
      ctx.fillStyle = "rgba(235,250,255,0.35)";
      ctx.fillRect(x0, y0, x1 - x0, (y1 - y0) * 0.18);
    }
    ctx.restore();
  }
  for (const p of front) cutout(ctx, shapeOf(p, at), inkOf(p.ink, k, frozen), depth * 0.6, border * 0.7);
  for (const p of details) fillPoly(ctx, shapeOf(p, at), inkOf(p.ink, k, frozen));
  if (opts.ghost) {
    ctx.restore();
    // A dashed outline where the thing would be.
    ctx.save();
    ctx.setLineDash([3 * at.s, 3 * at.s]);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "rgba(60,50,40,0.75)";
    ctx.stroke(union);
    ctx.restore();
  }
  if (frozen) {
    // Icicles along the bottom of the body.
    const xs = shapes.flat().map((q) => q[0]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const yb = Math.max(...shapes.flat().map((q) => q[1]));
    const n = Math.max(2, Math.round((x1 - x0) / 9));
    for (let i = 0; i < n; i++) {
      const x = x0 + ((i + 0.5) / n) * (x1 - x0);
      const y = Math.min(yb - 2, ...shapes.flat().filter((q) => Math.abs(q[0] - x) < 4).map((q) => q[1]).filter((v) => v > at.y - 30 * at.s).concat([yb - 2]));
      cutout(ctx, [[x - 2, y - 6], [x + 2, y - 6], [x, y + 3 + (i % 2) * 2]], "#dff2f8", 1, 0.5);
    }
  }
  return { shapes, union };
}

/** The base a living standee stands on. */
export function stand(ctx: Ctx, x: number, y: number, w: number) {
  withShadow(ctx, 2, () => {
    ctx.fillStyle = "#9c7b55";
    ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.32, 0, 0, Math.PI * 2); ctx.fill();
  });
  ctx.fillStyle = "#b8956a";
  ctx.beginPath(); ctx.ellipse(x, y - 1, w * 0.9, w * 0.26, 0, 0, Math.PI * 2); ctx.fill();
}

/** A soft paper shadow on the ground. */
export function groundShadow(ctx: Ctx, x: number, y: number, w: number, alpha = 0.2) {
  ctx.fillStyle = `rgba(40,30,20,${alpha})`;
  ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.25, 0, 0, Math.PI * 2); ctx.fill();
}

export function flamePts(x: number, y: number, h: number, t = 0, seed = 0): Pt[] {
  const sway = Math.sin(t * 5 + seed) * h * 0.1, w = h * 0.4, lick = 1 + Math.sin(t * 9 + seed * 3) * 0.08;
  return [[x - w, y], [x - w, y - h * 0.35], [x - w * 0.4 + sway, y - h * 0.55 * lick], [x - w * 0.5 + sway, y - h * 0.8 * lick], [x + sway * 1.5, y - h * lick],
    [x + w * 0.3 + sway, y - h * 0.62 * lick], [x + w * 0.65, y - h * 0.75 * lick], [x + w, y - h * 0.3], [x + w * 0.8, y]];
}

/** Three layers of paper flame, base at (x, y). */
export function paperFlame(ctx: Ctx, x: number, y: number, h: number, t = 0, seed = 0) {
  cutout(ctx, smooth(flamePts(x, y, h, t, seed), 1), "#d9573b", 2, 0.8);
  fillPoly(ctx, smooth(flamePts(x, y, h * 0.68, t + 0.3, seed + 1), 1), "#ec8e3e");
  fillPoly(ctx, smooth(flamePts(x, y, h * 0.38, t + 0.6, seed + 2), 1), "#f4c95d");
}

export function heartPts(x: number, y: number, s: number): Pt[] {
  return Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    const hx = 16 * Math.sin(a) ** 3, hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
    return [x + (hx * s) / 16, y + (hy * s) / 16] as Pt;
  });
}

/** A paper tag with a string hole; lines after the first are smaller. Returns its size. */
export function tag(ctx: Ctx, lines: string[], x: number, y: number, rot: number, color = INK, size = 13): { w: number; h: number } {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  const small = Math.round(size * 0.78);
  ctx.font = `700 ${size}px ${HAND}`;
  let w = ctx.measureText(lines[0] ?? "").width;
  ctx.font = `700 ${small}px ${HAND}`;
  for (const l of lines.slice(1)) w = Math.max(w, ctx.measureText(l).width);
  w += 20;
  const h = size + 7 + (lines.length - 1) * (small + 1);
  withShadow(ctx, 2, () => {
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 7, -h / 2); ctx.lineTo(w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2 + 7, h / 2); ctx.lineTo(-w / 2, 0); ctx.closePath();
    ctx.fill();
  });
  ctx.fillStyle = "#c9b99a"; ctx.beginPath(); ctx.arc(-w / 2 + 6, 0, 1.8, 0, 7); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `700 ${size}px ${HAND}`;
  ctx.fillText(lines[0] ?? "", 3, -h / 2 + size / 2 + 4.5);
  ctx.font = `700 ${small}px ${HAND}`;
  ctx.fillStyle = mix(color, "#9a8a70", 0.35);
  lines.slice(1).forEach((l, i) => ctx.fillText(l, 3, -h / 2 + size + 4 + (i + 0.5) * (small + 1) + 1));
  ctx.restore();
  return { w, h };
}

/** What each status looks like as a little paper badge. */
export const BADGE: Record<string, { ink: string; paper: string; text: string }> = {
  stun: { ink: "#7a5a10", paper: "#f4d35e", text: "✶ STUN" }, slow: { ink: "#3d4a5a", paper: "#c9d6e0", text: "SLOW" },
  blind: { ink: "#fbf7ec", paper: "#4a3f33", text: "BLIND" }, fear: { ink: "#fbf7ec", paper: "#6a4a8a", text: "FEAR" },
  burn: { ink: "#fbf7ec", paper: "#d9573b", text: "BURN" }, freeze: { ink: "#2f5a7a", paper: "#cfeaf5", text: "❄ FROZEN" },
  poison: { ink: "#fbf7ec", paper: "#5f9a4a", text: "POISON" }, bleed: { ink: "#fbf7ec", paper: "#a8323a", text: "BLEED" },
  sleep: { ink: "#fbf7ec", paper: "#4a4a8a", text: "Zz SLEEP" }, charm: { ink: "#fbf7ec", paper: "#e0708f", text: "♥ CHARM" },
  silence: { ink: "#4a3f33", paper: "#e6d3a3", text: "SILENCE" }, root: { ink: "#fbf7ec", paper: "#6b4a2e", text: "ROOT" },
  confuse: { ink: "#fbf7ec", paper: "#8a5ac9", text: "? CONFUSE" }, shrink: { ink: "#4a3f33", paper: "#e9c9d4", text: "SHRINK" },
  fleeing: { ink: "#fbf7ec", paper: "#8a6a4a", text: "FLEEING" }, hungry: { ink: "#4a3f33", paper: "#e3c46a", text: "HUNGRY" },
  starving: { ink: "#fbf7ec", paper: "#a8703c", text: "STARVING" }, wild: { ink: "#fbf7ec", paper: "#5a6a4a", text: "WILD" },
};

/** A little round-cornered paper badge for a status. */
export function badge(ctx: Ctx, status: string, x: number, y: number, rot = 0): { w: number; h: number } {
  const b = BADGE[status] ?? { ink: INK, paper: "#e6d3a3", text: status.toUpperCase() };
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.font = `600 9px ${ROUND}`;
  const w = ctx.measureText(b.text).width + 10, h = 13;
  withShadow(ctx, 1.4, () => {
    ctx.fillStyle = PAPER;
    ctx.beginPath(); ctx.roundRect(-w / 2 - 1.2, -h / 2 - 1.2, w + 2.4, h + 2.4, 4); ctx.fill();
  });
  ctx.fillStyle = b.paper;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 3); ctx.fill();
  ctx.fillStyle = b.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(b.text, 0, 0.5);
  ctx.restore();
  return { w: w + 2.4, h: h + 2.4 };
}

export { E, type Ctx };
