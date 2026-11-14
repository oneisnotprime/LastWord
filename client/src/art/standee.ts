/**
 * A whole standee as one canvas: the silhouette (or a crowd or swarm of it, for a count), its
 * stand or ground shadow, a thread for things that fly, and what a person holds.
 * Flames, badges, tags and health are separate sprites so they can move and change.
 */
import type { Pt, Silhouette } from "./build.js";
import type { Look } from "./look.js";
import { drawSilhouette, groundShadow, inks, stand, type Placed } from "./paper.js";
import { hash } from "./util.js";

export interface Standee {
  canvas: HTMLCanvasElement;
  /** The feet, in canvas pixels. */
  ox: number; oy: number;
  /** Canvas pixels per unit. */
  k: number;
  /** Height above the feet, in units, for what goes on top. */
  top: number;
  /** Half the width at the ground, in units. */
  half: number;
  /** Where flames go when it burns, in units from the feet, facing right. */
  flames: Pt[];
  flies: boolean;
  living: boolean;
}

/** Bounds of a silhouette in units at scale s. */
function bounds(sil: Silhouette, s: number) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of sil.pieces) for (const [x, y] of p.pts) {
    x0 = Math.min(x0, x * s); x1 = Math.max(x1, x * s); y0 = Math.min(y0, y * s); y1 = Math.max(y1, y * s);
  }
  return { x0, y0, x1, y1 };
}

/** Where flames sit: the highest points of the body across its width. */
function flameSpots(sil: Silhouette, s: number, lift: number): Pt[] {
  const pts = sil.pieces.filter((p) => !p.detail).flatMap((p) => p.pts).map(([x, y]) => [x * s, y * s - lift] as Pt);
  const b = bounds(sil, s);
  const n = Math.max(2, Math.min(5, Math.round((b.x1 - b.x0) / 14)));
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const xa = b.x0 + ((b.x1 - b.x0) * i) / n, xb = b.x0 + ((b.x1 - b.x0) * (i + 1)) / n;
    const inBand = pts.filter(([x]) => x >= xa && x <= xb);
    if (!inBand.length) continue;
    const topY = Math.min(...inBand.map((p) => p[1]));
    out.push([(xa + xb) / 2, topY + 4 * s]);
  }
  return out;
}

export interface StandeeOptions {
  /** Device pixels per unit. */
  k: number;
  /** A silhouette held in the hand, drawn small. */
  held?: { sil: Silhouette; colour: string };
}

export function renderStandee(look: Look, opt: StandeeOptions): Standee {
  const sil = look.shape, s = look.scale, k = opt.k;
  const flies = !!sil.flies, living = !!sil.living;
  const lift = flies ? 22 * Math.max(1, s * 0.8) : 0;
  const b = bounds(sil, s);
  // Crowds: copies around the first; swarms: specks.
  const many = look.count > 1;
  const swarm = many && (sil.speck || look.count > 60);
  const crowdR = swarm ? Math.min(70, 10 + Math.sqrt(look.count) * 1.4) : 0;
  const copies: Placed[] = [];
  if (many && !swarm) {
    const n = Math.min(7, 2 + Math.floor(Math.log10(look.count) * 2));
    const w = (b.x1 - b.x0) * 0.55;
    for (let i = n - 1; i >= 1; i--) {
      const a = (i / n) * Math.PI * 2;
      copies.push({ x: Math.cos(a) * w, y: -6 - Math.abs(Math.sin(a)) * 8 - (i % 2) * 4, s: s * 0.82, flip: i % 3 === 0 });
    }
  }
  const pad = 12 + (flies ? 6 : 0);
  const wx0 = Math.min(b.x0, -crowdR, ...copies.map((c) => c.x + b.x0 * 0.82)) - pad, wx1 = Math.max(b.x1, crowdR, ...copies.map((c) => c.x + b.x1 * 0.82), 16) + pad + 4;
  const wy0 = Math.min(b.y0 - lift, ...copies.map((c) => c.y + b.y0 * 0.82), -crowdR * 0.8) - pad - (opt.held ? 18 : 0);
  const wy1 = Math.max(b.y1 - lift, 6, crowdR * 0.8) + pad;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((wx1 - wx0) * k); canvas.height = Math.ceil((wy1 - wy0) * k);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(k, k);
  ctx.translate(-wx0, -wy0);
  const ink = inks(look.colour, look.frozen);
  const ghost = look.invisible || look.hidden;
  const halfW = Math.max(6, (b.x1 - b.x0) / 2);
  if (ghost) ctx.globalAlpha = look.invisible ? 0.55 : 0.8;
  if (swarm) {
    const n = Math.min(320, Math.max(30, Math.round(look.count / 4)));
    const dots: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i * 2.399963) % (Math.PI * 2);
      const d = Math.sqrt((i + 0.5) / n) * crowdR * (0.85 + 0.3 * hash(i, 3, 7));
      dots.push([Math.cos(a) * d, Math.sin(a) * d * 0.7 - 2]);
    }
    dots.sort((p, q) => p[1] - q[1]);
    ctx.fillStyle = "rgba(50,35,20,0.22)";
    for (const [x, y] of dots) ctx.fillRect(x + 0.8, y + 1.4, 3.4 * s, 2.2 * s);
    for (const [i, [x, y]] of dots.entries()) {
      const r = Math.max(1.2, 1.7 * s);
      ctx.fillStyle = ink.deep; ctx.beginPath(); ctx.ellipse(x, y, r * 1.25, r * 0.8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = ink.body; ctx.beginPath(); ctx.ellipse(x - r * 0.5 * (i % 2 ? 1 : -1), y - 0.3, r * 0.6, r * 0.55, 0, 0, 7); ctx.fill();
    }
    // A few drawn in full at the front.
    for (const [i, x] of [-crowdR * 0.35, crowdR * 0.3].entries()) drawSilhouette(ctx, sil, { x, y: crowdR * 0.45 + i * 3, s: s * 0.9, flip: i === 1 }, ink, { frozen: look.frozen, depth: 2 });
  } else {
    if (flies) {
      groundShadow(ctx, 6, 0, halfW * 0.9, 0.16);
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(0, b.y0 - lift - 4); ctx.lineTo(0, wy0); ctx.stroke();
    } else if (living) {
      stand(ctx, 0, 0, Math.min(26, halfW * 0.75 + 4));
    } else {
      groundShadow(ctx, 3, 0, halfW * 0.85 + 2, sil.flat ? 0.12 : 0.18);
    }
    for (const c of copies) {
      if (living) stand(ctx, c.x, c.y, Math.min(20, halfW * 0.6 + 3));
      drawSilhouette(ctx, sil, c, ink, { frozen: look.frozen, depth: 2.5 });
    }
    const main: Placed = { x: 0, y: -lift - (living ? 1.5 : 0), s, flip: false };
    drawSilhouette(ctx, sil, main, ink, { frozen: look.frozen, depth: sil.flat ? 1.5 : 2.5 + s * 1.5, ghost });
    if (opt.held && sil.hand) {
      const [hx, hy] = sil.hand;
      const hb = bounds(opt.held.sil, 1);
      const hs = Math.min(0.75, 26 / Math.max(10, hb.y1 - hb.y0, hb.x1 - hb.x0)) * s;
      ctx.save();
      ctx.translate(hx * s, hy * s - lift + 3 * s);
      ctx.rotate(0.35);
      drawSilhouette(ctx, opt.held.sil, { x: 0, y: 0, s: hs, flip: false }, inks(opt.held.colour), { depth: 2 });
      ctx.restore();
    }
  }
  return {
    canvas, ox: -wx0 * k, oy: -wy0 * k, k,
    top: -Math.min(b.y0 - lift, swarm ? -crowdR * 0.7 : 0, ...copies.map((c) => c.y + b.y0 * 0.82)),
    half: Math.max(halfW, crowdR),
    flames: swarm ? [[-crowdR * 0.4, -crowdR * 0.2], [crowdR * 0.3, -crowdR * 0.1], [0, crowdR * 0.3]] : flameSpots(sil, s, lift),
    flies, living,
  };
}
