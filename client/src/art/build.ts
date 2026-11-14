/**
 * The vocabulary silhouettes are written in: points, ellipses, bands, and builders for families
 * of shapes (four-legged animals, people, birds, vehicles, buildings, signs).
 *
 * Units: one map tile is 32 units, a person stands about 40 tall. Origin at the feet, facing
 * right, y up is negative. The renderer adds the white cut border, the shadow and the stand.
 */

export type Pt = [number, number];

/**
 * A piece's colour: `body` is the word's colour (its own, its material's, or an adjective's),
 * `dark`, `deep`, `light` and `pale` are shades of it, anything else is a fixed hex colour.
 */
export type Ink = "body" | "dark" | "deep" | "light" | "pale" | string;

export interface Piece {
  pts: Pt[];
  ink: Ink;
  /** Painted on top with no border: eyes, windows, stripes. */
  detail?: boolean;
  /** Its own cut-out with its own border and shadow, glued on in front (or behind, with `back`). */
  glued?: boolean;
  back?: boolean;
  /** Chaikin passes to round it off. */
  round?: number;
}

export interface Silhouette {
  pieces: Piece[];
  /** Colour when the word gives none. */
  colour?: string;
  /** Hangs in the air on a thread, its shadow on the ground below. */
  flies?: boolean;
  /** Lies on the ground: no stand, no sway. */
  flat?: boolean;
  /** Alive: stands on a wooden base and sways. */
  living?: boolean;
  /** Where a held thing goes. */
  hand?: Pt;
  /** Many of a small thing are drawn as a swarm of dots, not copies. */
  speck?: boolean;
}

// ---------------------------------------------------------------------------------------------
// Points

/** An ellipse as a polygon. */
export function E(cx: number, cy: number, rx: number, ry = rx, n = 18, from = 0, to = Math.PI * 2): Pt[] {
  const whole = Math.abs(to - from - Math.PI * 2) < 1e-6;
  const m = whole ? n : n + 1;
  return Array.from({ length: m }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as Pt;
  });
}

/** A rectangle from corner (x0, y0) to (x1, y1). */
export const R = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** Points from a flat list: P(0,0, 4,-3, 8,0). */
export function P(...n: number[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i]!, n[i + 1]!]);
  return out;
}

/** Mirrors a half outline drawn on the right (x >= 0), giving a closed symmetric outline. */
export function sym(half: Pt[]): Pt[] {
  return [...half, ...[...half].reverse().map(([x, y]) => [-x, y] as Pt)];
}

/** A polyline thickened into a polygon, `w0` wide at the start tapering to `w1`. */
export function band(line: Pt[], w0: number, w1 = w0): Pt[] {
  const left: Pt[] = [], right: Pt[] = [];
  line.forEach((p, i) => {
    const a = line[Math.max(0, i - 1)]!, b = line[Math.min(line.length - 1, i + 1)]!;
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const len = Math.hypot(nx, ny) || 1;
    nx /= len; ny /= len;
    const w = (w0 + (w1 - w0) * (i / Math.max(1, line.length - 1))) / 2;
    left.push([p[0] + nx * w, p[1] + ny * w]);
    right.push([p[0] - nx * w, p[1] - ny * w]);
  });
  return [...left, ...right.reverse()];
}

/** Moves and scales points. */
export const at = (pts: Pt[], x: number, y: number, s = 1, sy = s): Pt[] => pts.map(([px, py]) => [x + px * s, y + py * sy] as Pt);

/** Rotates points about the origin. */
export const turn = (pts: Pt[], a: number): Pt[] => {
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c] as Pt);
};

// Piece shorthands.
export const part = (pts: Pt[], ink: Ink = "body", round = 0): Piece => ({ pts, ink, round });
export const dot = (pts: Pt[], ink: Ink): Piece => ({ pts, ink, detail: true });
export const glue = (pts: Pt[], ink: Ink = "body", round = 0): Piece => ({ pts, ink, glued: true, round });
export const behind = (pts: Pt[], ink: Ink = "dark", round = 0): Piece => ({ pts, ink, glued: true, back: true, round });
export const eye = (x: number, y: number, r = 1.4): Piece => dot(E(x, y, r, r, 8), "#2b2a28");

/** Moves and scales every piece of a silhouette. */
export function moved(s: Silhouette, x: number, y: number, k = 1): Silhouette {
  return {
    ...s,
    pieces: s.pieces.map((p) => ({ ...p, pts: at(p.pts, x, y, k) })),
    hand: s.hand ? [x + s.hand[0] * k, y + s.hand[1] * k] : undefined,
  };
}

// ---------------------------------------------------------------------------------------------
// Four-legged animals

export interface Quad {
  len?: number; h?: number; leg?: number; legW?: number;
  /** How far the head rises above the back. */
  neck?: number; head?: number; snout?: number; snoutH?: number;
  ear?: "point" | "round" | "flop" | "none";
  tail?: "bushy" | "thin" | "tuft" | "curl" | "stub" | "long" | "none";
  horns?: "bull" | "ram" | "antler" | "spike" | "none";
  mane?: boolean; trunk?: boolean; tusk?: boolean; hump?: boolean; wool?: boolean;
  stripes?: boolean; spots?: boolean; belly?: string; nose?: string; colour?: string;
  /** Head held low (bear, boar) or the back sloped (hyena). */
  low?: boolean;
}

export function quad(o: Quad = {}): Silhouette {
  const len = o.len ?? 40, h = o.h ?? 13, leg = o.leg ?? 12, lw = o.legW ?? 4;
  const head = o.head ?? 6.5, snout = o.snout ?? 6, sh = o.snoutH ?? 4, neck = o.neck ?? 7;
  const top = -(leg + h), mid = -(leg + h / 2);
  const hx = len / 2 + head * 0.5, hy = o.low ? mid - head * 0.2 : top - neck + head * 0.4;
  const pieces: Piece[] = [];
  // Far legs, darker, behind.
  for (const x of [len / 2 - lw * 1.6 + 3, -len / 2 + lw * 1.4 + 3]) pieces.push(behind(R(x - lw / 2, mid, x + lw / 2, 0), "dark", 1));
  if (o.mane) pieces.push(behind(E(hx - head * 0.3, hy + head * 0.2, head * 2, head * 2.1, 14), "deep", 1));
  if (o.trunk) pieces.push(part(band([[hx + head * 0.8, hy + head * 0.2], [hx + head * 1.3, hy + head * 1.6], [hx + head * 1.2, -leg * 0.4], [hx + head * 1.6, -1]], head * 0.8, head * 0.45)));
  // Body: torso, neck and head as one cut-out.
  pieces.push(part(E(0, mid, len / 2, h / 2, 20)));
  if (o.hump) pieces.push(part(E(-len * 0.05, top + 1, len * 0.22, h * 0.45, 14)));
  pieces.push(part(P(len / 2 - 8, top + 1, hx - head * 0.5, hy - head * 0.6, hx + head * 0.4, hy + head * 0.6, len / 2 + 1, mid + h * 0.2)));
  pieces.push(part(E(hx, hy, head, head * 0.9, 14)));
  if (snout > 0) pieces.push(part(sym([[sh / 2, 0], [sh / 2, snout]]).map(([y, x]) => [hx + head * 0.4 + x, hy + y + head * 0.15] as Pt), "body", 1));
  for (const x of [len / 2 - lw * 1.6, -len / 2 + lw * 1.4]) pieces.push(part(R(x - lw / 2, mid, x + lw / 2, 0)));
  // Ears.
  if (o.ear === "point" || o.ear === undefined) pieces.push(part(P(hx - head * 0.55, hy - head * 0.5, hx - head * 0.3, hy - head * 1.75, hx + head * 0.15, hy - head * 0.7)));
  if (o.ear === "round") pieces.push(part(E(hx - head * 0.35, hy - head * 0.85, head * 0.42, head * 0.42, 10)));
  if (o.ear === "flop") pieces.push(glue(P(hx - head * 0.3, hy - head * 0.7, hx - head * 0.9, hy + head * 0.1, hx - head * 0.6, hy + head * 1.1, hx - head * 0.1, hy - head * 0.2), "dark", 1));
  // Tail.
  const tx = -len / 2 + 1, ty = top + h * 0.3, tl = len * 0.4;
  switch (o.tail ?? "thin") {
    case "bushy": pieces.push(part(P(tx + 2, ty - 1, tx - tl * 0.55, ty - h * 0.2, tx - tl, ty + h * 0.55, tx - tl * 0.7, ty + h * 0.75, tx + 1, ty + h * 0.45), "body", 2)); break;
    case "thin": pieces.push(part(band([[tx + 1, ty], [tx - tl * 0.4, ty + 2], [tx - tl * 0.6, ty + h * 0.7]], 2.4, 1.2))); break;
    case "long": pieces.push(part(band([[tx + 1, ty], [tx - tl * 0.5, ty - 2], [tx - tl, ty + 3], [tx - tl * 1.3, ty - 3]], 3, 1))); break;
    case "tuft":
      pieces.push(part(band([[tx + 1, ty], [tx - tl * 0.45, ty + 3], [tx - tl * 0.55, ty + h * 0.8]], 2, 1.2)));
      pieces.push(part(E(tx - tl * 0.56, ty + h * 0.95, 2.4, 3.2, 8), "deep"));
      break;
    case "curl": pieces.push(part(band(E(tx - 2.5, ty, 2.5, 2.5, 8, 0, Math.PI * 1.6), 1.6))); break;
    case "stub": pieces.push(part(E(tx - 1, ty, 3, 2.4, 8))); break;
  }
  // Horns.
  if (o.horns === "bull") for (const s of [0, 3]) pieces.push(glue(band([[hx - head * 0.2 + s, hy - head * 0.7], [hx - head * 0.6 + s, hy - head * 1.6], [hx - head * 0.1 + s, hy - head * 2.2]], 2.6, 0.8), "#efe6d0"));
  if (o.horns === "ram") pieces.push(glue(band(E(hx - head * 0.4, hy - head * 0.1, head * 0.75, head * 0.75, 12, -Math.PI * 0.9, Math.PI * 0.8), 2.6, 1.5), "#d9c6a0"));
  if (o.horns === "spike") pieces.push(glue(P(hx + head * 0.5, hy - head * 0.4, hx + head * 0.9, hy - head * 2, hx + head * 1.1, hy - head * 0.3), "#efe6d0"));
  if (o.horns === "antler") for (const s of [0, 3]) {
    const bx = hx - head * 0.2 + s, by = hy - head * 0.7;
    pieces.push(glue(band([[bx, by], [bx - 3, by - 8], [bx - 1, by - 15]], 1.8, 1), "#a88760"));
    pieces.push(glue(band([[bx - 2.4, by - 6], [bx + 3, by - 10]], 1.4, 0.8), "#a88760"));
    pieces.push(glue(band([[bx - 2, by - 11], [bx - 7, by - 15]], 1.4, 0.8), "#a88760"));
  }
  // Details.
  if (o.wool) for (let i = 0; i < 7; i++) pieces.push(dot(E(-len * 0.35 + i * len * 0.12, mid + ((i % 2) - 0.5) * h * 0.4, h * 0.22, h * 0.22, 8), "light"));
  if (o.stripes) for (let i = 0; i < 4; i++) pieces.push(dot(band([[-len * 0.3 + i * len * 0.17, top + 1.5], [-len * 0.33 + i * len * 0.17, mid + 1]], 2.4, 0.6), "deep"));
  if (o.spots) for (let i = 0; i < 5; i++) pieces.push(dot(E(-len * 0.3 + i * len * 0.14, mid + ((i * 7) % 3 - 1) * h * 0.18, 2.6, 2, 8), "deep"));
  if (o.belly) pieces.push(dot(E(len * 0.05, mid + h * 0.28, len * 0.3, h * 0.16, 12), o.belly));
  if (o.tusk) pieces.push(glue(band([[hx + head * 0.5, hy + head * 0.6], [hx + head * 1.2, hy + head * 1.4], [hx + head * 1.8, hy + head * 1.0]], 2, 0.6), "#f6f0e2"));
  pieces.push(eye(hx + head * 0.3, hy - head * 0.2));
  if (snout > 0) pieces.push(dot(E(hx + head * 0.4 + snout, hy + head * 0.15 - sh * 0.2, 1.6, 1.3, 8), o.nose ?? "#2b2a28"));
  return { pieces, colour: o.colour, living: true };
}

// ---------------------------------------------------------------------------------------------
// People and people-shaped things

export interface Biped {
  h?: number; w?: number; head?: number; skin?: string; hair?: string; legs?: Ink;
  robe?: boolean; cloak?: Ink;
  hat?: "crown" | "wizard" | "helmet" | "cap" | "hood" | "halo" | "horns" | "tophat" | "hair" | "bun" | "none";
  wings?: "feather" | "bat"; tail?: boolean; arms?: "down" | "forward" | "up";
  held?: "staff" | "spear" | "none"; ghost?: boolean; beard?: string; belt?: string; colour?: string;
}

export function biped(o: Biped = {}): Silhouette {
  const k = (o.h ?? 40) / 40, hw = (o.w ?? 9) * k, head = (o.head ?? 6) * k, skin = o.skin ?? "#efcfae";
  const pieces: Piece[] = [];
  const sh = -28 * k, hip = -12 * k, hy = -34 * k;
  if (o.wings === "feather") for (const s of [1, -1]) pieces.push(behind(P(-2 * k, sh + 2 * k, -16 * k * s, sh - 14 * k, -24 * k * s, sh - 6 * k, -18 * k * s, sh + 6 * k, -20 * k * s, sh + 12 * k, -6 * k, hip), s > 0 ? "#fbf7ec" : "#e9e2d0", 2));
  if (o.wings === "bat") for (const s of [1, -1]) pieces.push(behind(P(-2 * k, sh + 2 * k, -14 * k * s, sh - 12 * k, -26 * k * s, sh - 4 * k, -20 * k * s, sh + 2 * k, -22 * k * s, sh + 8 * k, -14 * k * s, sh + 4 * k, -12 * k * s, sh + 12 * k, -4 * k, hip), "deep"));
  if (o.cloak) pieces.push(behind(P(-hw * 0.9, sh, hw * 0.7, sh, hw * 0.9, -2 * k, -hw * 1.8, 0), o.cloak, 1));
  if (o.tail) pieces.push(behind(band([[-3 * k, hip], [-12 * k, hip + 4 * k], [-16 * k, hip - 4 * k], [-20 * k, hip - 2 * k]], 2.2 * k, 1 * k), "deep"));
  // Legs.
  const legInk = o.legs ?? "deep";
  if (o.ghost) {
    pieces.push(part(P(-hw, sh, hw, sh, hw * 1.2, -4 * k, hw * 0.6, -1 * k, hw * 0.2, -5 * k, -hw * 0.3, 0, -hw * 0.8, -5 * k, -hw * 1.3, -2 * k), "body", 2));
  } else if (o.robe) {
    pieces.push(part(P(-hw * 0.8, sh, hw * 0.8, sh, hw * 1.4, 0, -hw * 1.4, 0), "body", 1));
  } else {
    pieces.push(part(R(-hw * 0.6, hip - 1, -hw * 0.05, 0), legInk));
    pieces.push(part(R(hw * 0.05, hip - 1, hw * 0.6, 0), legInk));
  }
  // Torso and arms.
  pieces.push(part(P(-hw, sh, hw, sh, hw * 0.75, hip, -hw * 0.75, hip), "body", 1));
  const arm = o.arms ?? "down";
  const hand: Pt = arm === "forward" ? [hw + 9 * k, sh + 6 * k] : arm === "up" ? [hw + 4 * k, sh - 10 * k] : [hw + 2.5 * k, hip - 2 * k];
  pieces.push(part(band([[hw * 0.8, sh + 1.5 * k], hand], 3.6 * k, 3 * k), "body"));
  pieces.push(behind(band([[-hw * 0.8, sh + 1.5 * k], arm === "forward" ? [hw + 6 * k, sh + 8 * k] : [-hw - 2.5 * k, hip - 2 * k]], 3.4 * k, 2.8 * k), "dark"));
  pieces.push(part(E(hand[0], hand[1], 1.9 * k, 1.9 * k, 8), o.ghost ? "body" : skin));
  // Head.
  pieces.push(part(E(0, hy, head, head * 1.05, 14), o.ghost ? "body" : skin));
  if (o.held === "staff") pieces.push(glue(band([[hand[0] + 1, hand[1] + 12 * k], [hand[0] + 1, hand[1] - 22 * k]], 2.2 * k), "#8a6440"), glue(E(hand[0] + 1, hand[1] - 23 * k, 3 * k, 3 * k, 10), "#7fc4d8"));
  if (o.held === "spear") pieces.push(glue(band([[hand[0], hand[1] + 12 * k], [hand[0], hand[1] - 24 * k]], 1.8 * k), "#8a6440"), glue(P(hand[0] - 2.4 * k, hand[1] - 23 * k, hand[0], hand[1] - 31 * k, hand[0] + 2.4 * k, hand[1] - 23 * k), "#d8e0e4"));
  // Headwear.
  const top = hy - head;
  switch (o.hat ?? "hair") {
    case "hair": pieces.push(dot(P(-head, hy - 1 * k, -head * 0.8, top + 1, 0, top - 0.6 * k, head * 0.9, top + 1.4, head, hy - 2 * k, head * 0.2, top + 2.4 * k, -head * 0.3, hy - 1 * k), o.hair ?? "#5a3a24")); break;
    case "bun": pieces.push(dot(P(-head, hy, -head * 0.8, top + 1, 0, top - 0.6 * k, head * 0.9, top + 1.4, head * 0.6, top + 3 * k, -head * 0.3, hy), o.hair ?? "#2b2a28"), glue(E(-head * 0.7, top + 1, 2.6 * k, 2.6 * k, 8), o.hair ?? "#2b2a28")); break;
    case "crown": pieces.push(glue(P(-head, top + 2 * k, -head, top - 5 * k, -head * 0.5, top - 1 * k, 0, top - 6 * k, head * 0.5, top - 1 * k, head, top - 5 * k, head, top + 2 * k), "#e3b341")); break;
    case "wizard": pieces.push(glue(P(-head * 1.7, top + 2.5 * k, head * 1.7, top + 2.5 * k, head * 0.4, top - 4 * k, -head * 0.6, top - 14 * k, -head * 0.3, top - 4 * k), "deep", 1)); break;
    case "helmet": pieces.push(glue(P(-head * 1.15, hy + 1 * k, -head * 1.1, top + 2 * k, -head * 0.5, top - 1.5 * k, head * 0.5, top - 1.5 * k, head * 1.1, top + 2 * k, head * 1.15, hy - 1 * k, head * 0.2, hy - 1 * k, head * 0.2, hy + 1 * k), "#b8c2c8", 1)); break;
    case "cap": pieces.push(glue(P(-head, hy - 1 * k, -head * 0.8, top + 0.5, head * 0.8, top + 0.5, head, hy - 1 * k, head * 1.9, hy - 0.5 * k, head * 1.9, hy - 2 * k, head, hy - 2.5 * k), "deep", 1)); break;
    case "hood": pieces.push(behind(E(0, hy + 0.5 * k, head * 1.45, head * 1.5, 14), "deep"), dot(P(-head, hy, -head * 0.8, top + 1, head * 0.8, top + 1, head, hy), "deep")); break;
    case "tophat": pieces.push(glue([...R(-head * 0.8, top - 9 * k, head * 0.8, top + 1), ...R(-head * 1.4, top + 1, head * 1.4, top + 3)].slice(0, 4), "#2b2a28"), glue(R(-head * 1.4, top + 0.5, head * 1.4, top + 2.5), "#2b2a28")); break;
    case "halo": pieces.push(glue(band(E(0, top - 3 * k, head * 1.1, head * 0.35, 16), 1.6 * k), "#f4d35e")); break;
    case "horns": for (const s of [1, -1]) pieces.push(glue(band([[s * head * 0.5, top + 1.5 * k], [s * head * 0.9, top - 3 * k], [s * head * 0.6, top - 7 * k]], 2.6 * k, 0.6), "#3d2a1e")); break;
  }
  if (o.beard) pieces.push(dot(P(-head * 0.5, hy + 1.5 * k, head * 1.0, hy + 1 * k, head * 0.5, hy + head * 1.6, -head * 0.1, hy + head * 1.3), o.beard));
  if (o.belt) pieces.push(dot(R(-hw * 0.8, hip - 3 * k, hw * 0.8, hip - 1.5 * k), o.belt));
  pieces.push(eye(head * 0.45, hy - 0.5 * k, 1.1 * k));
  return { pieces, colour: o.colour, living: true, hand };
}

// ---------------------------------------------------------------------------------------------
// Birds, fish, small things

export interface Bird { size?: number; beak?: number; hooked?: boolean; flies?: boolean; neck?: number; legs?: number; tail?: number; crest?: boolean; wattle?: boolean; colour?: string; breast?: string; round?: boolean }

export function bird(o: Bird = {}): Silhouette {
  const k = (o.size ?? 1), legs = (o.legs ?? 5) * k, by = -(legs + 7 * k);
  const pieces: Piece[] = [];
  const hx = 9 * k, hy = by - 6 * k - (o.neck ?? 0) * k, hr = (o.round ? 5.5 : 4.2) * k;
  if (o.flies) {
    pieces.push(behind(P(-2 * k, by - 2 * k, -8 * k, by - 22 * k, -18 * k, by - 18 * k, -10 * k, by - 2 * k), "dark", 1));
  } else {
    for (const x of [-1.5, 2]) pieces.push(behind(band([[x * k, by + 4 * k], [x * k, 0]], 1.2 * k), "#c9873a"));
  }
  pieces.push(part(E(0, by, 10 * k, (o.round ? 8 : 6.5) * k, 16)));
  pieces.push(part(P(-8 * k, by - 2 * k, -(16 + (o.tail ?? 4)) * k, by - 5 * k, -(15 + (o.tail ?? 4)) * k, by + 2 * k, -6 * k, by + 4 * k)));
  pieces.push(part(P(4 * k, by - 4 * k, hx - 1 * k, hy, hx + 2 * k, hy + 3 * k, 8 * k, by + 1 * k)));
  pieces.push(part(E(hx, hy, hr, hr, 12)));
  const bl = (o.beak ?? 5) * k;
  pieces.push(glue(o.hooked ? P(hx + hr * 0.7, hy - 2 * k, hx + hr + bl, hy - 0.5 * k, hx + hr + bl * 0.7, hy + 2.5 * k, hx + hr * 0.6, hy + 1.5 * k) : P(hx + hr * 0.7, hy - 1.5 * k, hx + hr + bl, hy + 0.3 * k, hx + hr * 0.7, hy + 1.6 * k), "#e7a43c"));
  if (o.crest) pieces.push(part(P(hx - 2 * k, hy - hr + 1, hx - 4 * k, hy - hr - 5 * k, hx + 1 * k, hy - hr, hx + 1 * k, hy - hr - 4 * k, hx + 2.5 * k, hy - hr + 1)));
  if (o.wattle) pieces.push(glue(E(hx + hr * 0.6, hy + hr * 1.1, 1.8 * k, 3 * k, 8), "#d4473b"));
  if (o.breast) pieces.push(dot(E(4 * k, by + 1.5 * k, 5.5 * k, 4.5 * k, 12), o.breast));
  if (o.flies) pieces.push(glue(P(-1 * k, by - 2 * k, 2 * k, by - 24 * k, -8 * k, by - 30 * k, -6 * k, by - 18 * k, -12 * k, by - 4 * k), "light", 1));
  else pieces.push(glue(E(-2 * k, by - 0.5 * k, 7 * k, 4 * k, 12), "dark"));
  pieces.push(eye(hx + 1 * k, hy - 1 * k, 1.1 * k));
  return { pieces, colour: o.colour, living: true, flies: o.flies };
}

export function fish(o: { len?: number; shark?: boolean; colour?: string } = {}): Silhouette {
  const L = o.len ?? 26, h = o.shark ? L * 0.26 : L * 0.36, y = -h / 2 - 8;
  const pieces: Piece[] = [
    behind(P(-2, y + h * 0.4, 4, y + h * 0.9, 6, y + h * 0.3), "dark"),
    part(P(L / 2, y + (o.shark ? 1 : 0), L * 0.3, y - h / 2, -L * 0.1, y - h / 2 * 1.05, -L * 0.4, y - h * 0.2, -L / 2 + 2, y, -L * 0.4, y + h * 0.25, -L * 0.1, y + h / 2, L * 0.3, y + h / 2.2), "body", 2),
    part(P(-L / 2 + 4, y, -L / 2 - L * 0.2, y - h * 0.65, -L / 2 - L * 0.12, y, -L / 2 - L * 0.2, y + h * 0.6), "body", 1),
  ];
  if (o.shark) pieces.push(part(P(-L * 0.12, y - h / 2 + 1, -L * 0.02, y - h * 1.4, L * 0.12, y - h / 2)));
  else pieces.push(part(P(-L * 0.15, y - h / 2 + 1, -L * 0.05, y - h * 0.85, L * 0.12, y - h / 2 + 0.5)));
  pieces.push(dot(E(L * 0.05, y + h * 0.18, L * 0.3, h * 0.2, 12), "light"));
  pieces.push(eye(L * 0.32, y - h * 0.08, 1.3));
  if (o.shark) for (let i = 0; i < 3; i++) pieces.push(dot(band([[L * 0.2 - i * 2, y - 1], [L * 0.18 - i * 2, y + 3]], 0.8), "deep"));
  // A splash of paper water to stand in.
  pieces.unshift(behind(P(-L * 0.55, -1, -L * 0.3, -6, -L * 0.1, -3, L * 0.1, -7, L * 0.35, -3, L * 0.55, -1, L * 0.45, 0, -L * 0.45, 0), "#9cc6d2", 2));
  return { pieces, colour: o.colour, living: true };
}

/** A beetle-like thing seen from the side: ant, bee, cricket, spider. */
export function bug(o: { kind?: "ant" | "bee" | "cricket" | "spider"; colour?: string } = {}): Silhouette {
  const kind = o.kind ?? "ant";
  const pieces: Piece[] = [];
  const legs = (xs: number[], y: number, spread: number) => xs.forEach((x, i) => pieces.push(behind(band([[x, y], [x + (i - 1) * spread, y + 3], [x + (i - 1) * spread * 1.5, 0]], 1.1, 0.8), "deep")));
  if (kind === "spider") {
    for (let i = 0; i < 4; i++) for (const s of [1, -1]) pieces.push(behind(band([[0, -7], [s * (5 + i * 2), -12 + i], [s * (9 + i * 3), 0]], 1.2, 0.8), "deep"));
    pieces.push(part(E(-3, -8, 6, 5, 14)), part(E(4, -7, 3.5, 3, 10)));
    pieces.push(eye(6, -8, 0.8), eye(5, -9, 0.7));
    return { pieces, colour: o.colour ?? "#3d2f2a", living: true, speck: true };
  }
  legs([-2, 1, 4], -5, kind === "cricket" ? 4 : 3);
  if (kind === "cricket") pieces.push(behind(band([[-4, -7], [-10, -14], [-12, 0]], 1.6, 0.9), "deep"));
  pieces.push(part(E(-7, -6, kind === "bee" ? 6 : 5, kind === "bee" ? 5 : 4, 12)), part(E(1, -6, 3, 2.6, 10)), part(E(6, -7, 3, 3, 10)));
  pieces.push(dot(band([[7, -9], [10, -15], [13, -16]], 0.8), "deep"));
  if (kind === "bee") {
    for (const x of [-9, -6]) pieces.push(dot(band([[x, -10.5], [x, -1.5]], 1.4), "#2b2a28"));
    pieces.push(glue(E(-3, -13, 5, 3, 10), "#eef6f8"));
  }
  if (kind === "cricket") pieces.push(glue(E(-4, -9, 7, 2.2, 10), "dark"));
  pieces.push(eye(7.5, -7.5, 0.9));
  return { pieces, colour: o.colour, living: true, speck: true };
}

export function snake(colour?: string): Silhouette {
  const line: Pt[] = Array.from({ length: 12 }, (_, i) => [-18 + i * 3.4, -3 - Math.sin(i * 0.9) * 3] as Pt);
  line.push([22, -9], [24, -13]);
  return {
    pieces: [part(band(line, 3, 6), "body", 1), part(E(25, -14, 4, 3, 12)), dot(band([[28, -13], [32, -12], [33, -10]], 0.8), "#d4473b"), eye(26, -15, 1)].concat(
      Array.from({ length: 6 }, (_, i) => dot(E(-14 + i * 6, -3 - Math.sin((i * 6 + 4) / 3.4 * 0.9) * 3, 1.2, 1.2, 6), "deep"))),
    colour, living: true,
  };
}

/** The prototype's dragon, wings up. */
export function dragon(colour = "#c4583c"): Silhouette {
  const body = P(54, -6, 47, -10, 41, -13, 37, -24, 34, -14, 29, -12, 22, -7, 13, -3, 0, -1, -14, -1, -26, 1, -40, -1, -52, -7, -60, -6, -68, -12, -66, -1, -60, 3, -50, 4, -38, 8,
    -24, 10, -12, 12, -9, 17, -13, 25, -6, 25, -2, 16, 8, 12, 11, 17, 9, 23, 16, 23, 17, 14, 23, 6, 30, 1, 38, -1, 45, -2, 52, -3);
  const wing = (k: number): Pt[] => P(6, -3, 16, -30 * k, 8, -54 * k, -2, -34 * k, -12, -46 * k, -17, -28 * k, -30, -36 * k, -25, -12 * k, -16, -3);
  const lift = (pts: Pt[], dx: number, dy: number, s: number) => at(pts, dx, dy - 24, s);
  return {
    pieces: [
      behind(lift(wing(0.95), -8, -2, 0.85), "dark", 1),
      part(lift(body, 0, 0, 1)),
      dot(lift(P(-20, 8, -6, 11, 8, 11, 20, 5, 8, 7, -6, 7), 0, 0, 1), "#e9b46a"),
      glue(lift(wing(1), 0, 0, 1), "light", 1),
      eye(42, -32, 1.6),
    ],
    colour, living: true, flies: true,
  };
}

// ---------------------------------------------------------------------------------------------
// Plants

export function tree(o: { kind?: "round" | "pine" | "palm" | "dead" | "bush" | "cactus"; h?: number; colour?: string } = {}): Silhouette {
  const h = o.h ?? 46, kind = o.kind ?? "round";
  const trunk = "#6b4a2e";
  if (kind === "bush") return { pieces: [part(E(-5, -8, 9, 8, 12), "body", 1), part(E(5, -9, 9, 9, 12), "body", 1), part(E(0, -14, 8, 7, 12)), dot(E(-2, -14, 4, 3, 10), "light")], colour: o.colour ?? "#6f9a50" };
  if (kind === "cactus") return { pieces: [part(band([[0, 0], [0, -h * 0.7]], 9, 8), "body", 1), part(band([[0, -h * 0.3], [-9, -h * 0.32], [-9, -h * 0.5]], 5), "body", 1), part(band([[0, -h * 0.4], [8, -h * 0.42], [8, -h * 0.6]], 5), "body", 1), dot(band([[0, -4], [0, -h * 0.65]], 1), "dark")], colour: o.colour ?? "#6f9a50" };
  if (kind === "pine") return { pieces: [part(R(-2, -h * 0.3, 2, 0), trunk), part(P(0, -h, h * 0.22, -h * 0.62, h * 0.12, -h * 0.64, h * 0.3, -h * 0.28, -h * 0.3, -h * 0.28, -h * 0.12, -h * 0.64, -h * 0.22, -h * 0.62)), dot(P(0, -h + 3, -h * 0.15, -h * 0.62, -h * 0.05, -h * 0.62, -h * 0.2, -h * 0.32, -h * 0.05, -h * 0.32), "light")], colour: o.colour ?? "#4f7a4a" };
  if (kind === "palm") {
    const pieces: Piece[] = [part(band([[0, 0], [3, -h * 0.5], [1, -h * 0.85]], 4, 2.6), trunk)];
    for (const a of [-2.6, -2.0, -1.2, -0.6, 0]) pieces.push(glue(band(Array.from({ length: 5 }, (_, i) => [1 + Math.cos(a) * i * 4.5, -h * 0.85 + Math.sin(a) * i * 4.5 + i * i * 0.5] as Pt), 4, 1)));
    return { pieces, colour: o.colour ?? "#5f8a4a" };
  }
  if (kind === "dead") return { pieces: [part(band([[0, 0], [0, -h * 0.6], [-6, -h * 0.9]], 4, 1.4), trunk), part(band([[0, -h * 0.45], [8, -h * 0.75]], 2.4, 1), trunk), part(band([[-1, -h * 0.3], [-8, -h * 0.45]], 2, 1), trunk)] };
  return {
    pieces: [part(R(-2.5, -h * 0.4, 2.5, 0), trunk), part(E(0, -h * 0.62, h * 0.3, h * 0.32, 12), "body", 1), part(E(-h * 0.17, -h * 0.5, h * 0.2, h * 0.18, 10)), part(E(h * 0.17, -h * 0.52, h * 0.2, h * 0.2, 10)),
      dot(E(-h * 0.08, -h * 0.72, h * 0.14, h * 0.11, 10), "light")],
    colour: o.colour ?? "#5f8a4a",
  };
}

export function flower(colour = "#e0708f", petals = 6, h = 16): Silhouette {
  const pieces: Piece[] = [part(band([[0, 0], [1, -h * 0.5], [0, -h]], 1.6), "#5f8a4a"), part(P(1, -h * 0.4, 7, -h * 0.55, 3, -h * 0.3), "#6f9a50")];
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2;
    pieces.push(glue(E(Math.cos(a) * 3.6, -h + Math.sin(a) * 3.6, 3, 3, 8), "body"));
  }
  pieces.push(dot(E(0, -h, 2.4, 2.4, 8), "#f4c95d"));
  return { pieces, colour, flat: true };
}

// ---------------------------------------------------------------------------------------------
// Buildings and structures

export interface House {
  w?: number; h?: number;
  roof?: "gable" | "flat" | "dome" | "spire" | "tent" | "battlement" | "barn" | "columns";
  roofInk?: string; wall?: string; door?: string; windows?: number; floors?: number; chimney?: boolean; sign?: string;
}

export function house(o: House = {}): Silhouette {
  const w = o.w ?? 40, h = o.h ?? 30, x0 = -w / 2, x1 = w / 2, top = -h;
  const pieces: Piece[] = [];
  const wall = o.wall ?? "body", roof = o.roofInk ?? "#c9775a";
  if (o.chimney) pieces.push(behind(R(x1 - 10, top - 14, x1 - 5, top), "#a85a40"));
  switch (o.roof ?? "gable") {
    case "tent":
      pieces.push(part(P(x0 - 2, 0, 0, top - 8, x1 + 2, 0), "body", 0), dot(P(-4, 0, 0, top * 0.45, 4, 0), "deep"), dot(band([[0, top - 8], [0, top - 16]], 1.2), "#6b4a2e"), glue(P(0, top - 16, 7, top - 13, 0, top - 11), "#d9573b"));
      return { pieces, colour: "#e9d8b8" };
    case "barn":
      pieces.push(part(R(x0, top, x1, 0), wall), glue(P(x0 - 3, top + 1, x0 + 2, top - 10, 0, top - 15, x1 - 2, top - 10, x1 + 3, top + 1), roof, 0));
      pieces.push(dot(R(-7, -16, 7, 0), "#f2ead8"), dot(band([[-7, -16], [7, 0]], 1.4), "#f2ead8"), dot(band([[7, -16], [-7, 0]], 1.4), "#f2ead8"));
      return { pieces, colour: "#b5554a" };
    case "battlement": {
      const tw = w * 0.24;
      for (const cx of [x0 + tw / 2, x1 - tw / 2]) {
        pieces.push(part(R(cx - tw / 2, top - 14, cx + tw / 2, 0), wall));
        for (let i = 0; i < 3; i++) pieces.push(part(R(cx - tw / 2 + i * tw / 2.5, top - 19, cx - tw / 2 + i * tw / 2.5 + tw / 5, top - 13), wall));
        pieces.push(glue(P(cx - tw / 2 - 1, top - 19, cx, top - 32, cx + tw / 2 + 1, top - 19), roof));
        pieces.push(dot(R(cx - 1.5, top - 6, cx + 1.5, top), "#3d3a33"));
      }
      pieces.push(part(R(x0 + tw / 2, top + 4, x1 - tw / 2, 0), wall));
      for (let i = 0; i < 5; i++) pieces.push(part(R(x0 + tw + i * (w - tw * 2) / 5, top, x0 + tw + i * (w - tw * 2) / 5 + (w - tw * 2) / 10, top + 5), wall));
      pieces.push(dot([...E(0, -10, 6, 7, 10, Math.PI, Math.PI * 2), [6, 0], [-6, 0]], "#5a4030"));
      pieces.push(glue(band([[0, top - 32], [0, top - 46]], 1), "#6b4a2e"), glue(P(0, top - 46, 9, top - 43, 0, top - 40), "#d9573b"));
      return { pieces, colour: o.wall ? undefined : "#bfb3a0" };
    }
  }
  pieces.push(part(R(x0, top, x1, 0), wall));
  const roofKind = o.roof ?? "gable";
  if (roofKind === "gable") pieces.push(glue(P(x0 - 4, top + 1, 0, top - h * 0.55, x1 + 4, top + 1), roof));
  if (roofKind === "flat") pieces.push(glue(R(x0 - 2, top - 3, x1 + 2, top + 1), roof));
  if (roofKind === "dome") pieces.push(glue([...E(0, top + 1, w * 0.36, w * 0.32, 14, Math.PI, Math.PI * 2)], roof), glue(band([[0, top - w * 0.3], [0, top - w * 0.3 - 8]], 1.4), "#e3b341"));
  if (roofKind === "spire") pieces.push(glue(P(x0 - 3, top + 1, 0, top - h * 1.1, x1 + 3, top + 1), roof), glue(band([[0, top - h * 1.1], [0, top - h * 1.1 - 7]], 1.2), "#e3b341"));
  if (roofKind === "columns") {
    pieces.push(glue(P(x0 - 4, top + 1, 0, top - 10, x1 + 4, top + 1), roof));
    for (let i = 0; i < 5; i++) pieces.push(dot(R(x0 + 3 + i * (w - 8) / 4.5, top + 4, x0 + 6 + i * (w - 8) / 4.5, -2), "dark"));
    return { pieces, colour: "#efe4cf" };
  }
  pieces.push(dot(R(-3.5, -10, 3.5, 0), o.door ?? "#8a6a4a"));
  const floors = o.floors ?? 1, win = o.windows ?? 2;
  for (let f = 0; f < floors; f++) for (let i = 0; i < win; i++) {
    const wx = x0 + (w / (win + 1)) * (i + 1), wy = top + 5 + f * 9;
    if (Math.abs(wx) < 5 && f === floors - 1) continue;
    pieces.push(dot(R(wx - 2.5, wy, wx + 2.5, wy + 4.5), "#7aa0b0"));
  }
  if (o.sign) pieces.push(dot(R(-w * 0.3, top + 2, w * 0.3, top + 6), o.sign));
  return { pieces, colour: "#efe4cf" };
}

export function brickWall(len = 64, rows = 3, colour = "#bfb3a0"): Silhouette {
  const pieces: Piece[] = [];
  const bw = len / 5.5;
  for (let row = 0; row < rows; row++) for (let i = 0; i < 7; i++) {
    const bx = -len / 2 + i * bw - (row % 2 ? bw / 2 : 0), by = -(row + 1) * 9;
    const a = Math.max(-len / 2, bx), b = Math.min(len / 2, bx + bw - 1.5);
    if (b - a < 3) continue;
    pieces.push(glue(R(a, by, b, by + 8), (i + row) % 3 === 0 ? "dark" : (i + row) % 3 === 1 ? "body" : "light"));
  }
  return { pieces, colour };
}

// ---------------------------------------------------------------------------------------------
// Vehicles

export function wheel(x: number, y: number, r: number): Piece[] {
  return [glue(E(x, y, r, r, 14), "#3a3633"), dot(E(x, y, r * 0.45, r * 0.45, 10), "#c9c4b8")];
}

export interface Car { len?: number; h?: number; cab?: "car" | "truck" | "bus" | "van" | "none"; wheels?: number; r?: number; windows?: number; colour?: string }

export function car(o: Car = {}): Silhouette {
  const L = o.len ?? 44, H = o.h ?? 12, r = o.r ?? 5, base = -r;
  const pieces: Piece[] = [];
  const cab = o.cab ?? "car";
  if (cab === "car") pieces.push(part(P(-L / 2, base, -L / 2, base - H * 0.6, -L * 0.3, base - H * 0.75, -L * 0.18, base - H * 1.45, L * 0.15, base - H * 1.45, L * 0.3, base - H * 0.8, L / 2, base - H * 0.65, L / 2, base), "body", 1));
  if (cab === "truck") pieces.push(part(P(-L / 2, base, -L / 2, base - H * 1.4, L * 0.12, base - H * 1.4, L * 0.12, base - H * 0.7, L * 0.15, base - H * 0.7, L * 0.2, base - H * 1.3, L * 0.38, base - H * 1.3, L / 2, base - H * 0.6, L / 2, base), "body", 1));
  if (cab === "bus" || cab === "van") pieces.push(part(P(-L / 2, base, -L / 2, base - H * 1.6, L * 0.4, base - H * 1.6, L / 2, base - H * 1.1, L / 2, base), "body", 1));
  if (cab === "car") pieces.push(dot(P(-L * 0.15, base - H * 0.8, -L * 0.12, base - H * 1.3, L * 0.12, base - H * 1.3, L * 0.24, base - H * 0.8), "#cfe3ea"));
  if (cab === "truck") pieces.push(dot(P(L * 0.22, base - H * 0.75, L * 0.24, base - H * 1.15, L * 0.35, base - H * 1.15, L * 0.43, base - H * 0.75), "#cfe3ea"), dot(R(-L / 2 + 2, base - H * 1.3, L * 0.08, base - H * 1.25), "light"));
  if (cab === "bus" || cab === "van") {
    const n = o.windows ?? 5;
    for (let i = 0; i < n; i++) pieces.push(dot(R(-L / 2 + 3 + i * (L * 0.85 / n), base - H * 1.45, -L / 2 + 3 + i * (L * 0.85 / n) + L * 0.85 / n - 2.5, base - H * 0.95), "#cfe3ea"));
    pieces.push(dot(R(-L / 2, base - H * 0.5, L / 2, base - H * 0.35), "light"));
  }
  pieces.push(dot(E(L / 2 - 1.5, base - H * 0.45, 1.6, 1.3, 6), "#f4d35e"));
  const n = o.wheels ?? 2;
  for (let i = 0; i < n; i++) pieces.push(...wheel(-L * 0.32 + (n === 1 ? L * 0.32 : (L * 0.64 * i) / (n - 1)), -r, r));
  return { pieces, colour: o.colour ?? "#c9553f" };
}

export function tank(colour = "#7d8a55"): Silhouette {
  const pieces: Piece[] = [
    part(P(-26, -2, -30, -8, -27, -13, 27, -13, 30, -8, 26, -2), "#4a4a42", 1),
    part(P(-24, -13, -22, -20, 22, -20, 26, -13), "body"),
    glue(P(-12, -20, -10, -28, 8, -28, 12, -20), "light", 1),
    glue(R(8, -26, 34, -23), "dark"),
  ];
  for (let i = 0; i < 6; i++) pieces.push(dot(E(-21 + i * 8.4, -7.5, 3, 3, 8), "#8e8b80"));
  pieces.push(dot(E(-2, -24, 2, 2, 8), "dark"), dot(P(-18, -18, -12, -18, -15, -15), "#e3d9a8"));
  return { pieces, colour };
}

export function train(colour = "#3f6fa8"): Silhouette {
  const pieces: Piece[] = [
    part(P(-30, -6, -30, -26, -12, -26, -12, -18, 22, -18, 26, -12, 28, -6), "body", 0),
    glue(R(10, -28, 15, -18), "#3a3633"), glue(E(12.5, -31, 4, 2.5, 8), "#e9e2d0"),
    glue(P(28, -6, 33, -1, 26, -1), "#c9553f"),
  ];
  pieces.push(dot(R(-27, -23, -15, -18), "#cfe3ea"), dot(R(-30, -10, 28, -8), "#e3b341"));
  for (const x of [-22, -10, 2, 14]) pieces.push(...wheel(x, -5, 5));
  return { pieces, colour };
}

export function boat(o: { kind?: "boat" | "ship" | "sub"; colour?: string } = {}): Silhouette {
  const kind = o.kind ?? "boat";
  const water = behind(P(-34, -1, -24, -5, -12, -2, 0, -6, 12, -2, 24, -5, 34, -1, 30, 0, -30, 0), "#9cc6d2", 2);
  if (kind === "sub") return { pieces: [water, part(E(0, -9, 30, 7, 20)), part(R(-4, -22, 8, -12), "body", 1), glue(band([[4, -22], [4, -28], [8, -28]], 1.2), "dark"), dot(E(16, -10, 2, 2, 8), "#cfe3ea"), dot(E(4, -10, 2, 2, 8), "#cfe3ea"), dot(E(-8, -10, 2, 2, 8), "#cfe3ea")], colour: o.colour ?? "#d9b45a" };
  if (kind === "ship") return {
    pieces: [water, part(P(-34, -14, 36, -14, 28, -2, -28, -2), "body"), part(R(-14, -24, 12, -14), "#efe4cf"), glue(R(-6, -32, 2, -24), "#c9553f"), dot(R(-6, -32, 2, -30), "#2b2a28"),
      dot(R(-34, -9, 36, -7), "#efe4cf"), dot(E(-8, -19, 1.6, 1.6, 6), "#7aa0b0"), dot(E(-2, -19, 1.6, 1.6, 6), "#7aa0b0"), dot(E(4, -19, 1.6, 1.6, 6), "#7aa0b0")],
    colour: o.colour ?? "#3f5a7a",
  };
  return {
    pieces: [water, part(P(-20, -10, 22, -10, 16, -2, -16, -2), "body"), glue(band([[0, -10], [0, -40]], 1.6), "#6b4a2e"), glue(P(2, -38, 2, -14, 18, -14), "#fbf7ec", 0), glue(P(-2, -36, -2, -14, -14, -14), "#efe4cf")],
    colour: o.colour ?? "#a8703c",
  };
}

export function plane(o: { kind?: "plane" | "jet" | "heli" | "balloon" | "rocket"; colour?: string } = {}): Silhouette {
  const kind = o.kind ?? "plane";
  if (kind === "balloon") return { pieces: [part(E(0, -44, 16, 18, 18)), part(P(-10, -32, 10, -32, 4, -22, -4, -22)), dot(band([[-5, -22], [-4, -10]], 0.8), "#6b4a2e"), dot(band([[5, -22], [4, -10]], 0.8), "#6b4a2e"), glue(R(-5, -11, 5, -3), "#a8703c"), dot(band([[0, -62], [0, -26]], 3), "light"), dot(band([[-9, -58], [-6, -28]], 3), "light")], colour: o.colour ?? "#d9573b", flies: true };
  if (kind === "rocket") return { pieces: [part(P(0, -52, 6, -40, 6, -12, -6, -12, -6, -40), "body", 1), glue(P(-6, -22, -12, -8, -6, -12), "#c9553f"), glue(P(6, -22, 12, -8, 6, -12), "#c9553f"), dot(E(0, -36, 2.6, 2.6, 8), "#7aa0b0"), glue(P(-4, -12, 0, -2, 4, -12), "#f4c95d")], colour: o.colour ?? "#efe4cf", flies: true };
  if (kind === "heli") return { pieces: [part(E(4, -22, 13, 8, 16)), part(band([[-6, -22], [-28, -24]], 4, 2)), glue(R(-30, -30, -26, -20), "dark"), glue(R(-22, -32, 30, -30), "#3a3633"), glue(R(3, -32, 5, -29), "#3a3633"), dot(P(8, -27, 15, -24, 15, -20, 8, -20), "#cfe3ea"), dot(band([[-6, -12], [12, -12]], 1.4), "#3a3633"), dot(band([[-2, -14], [-2, -12]], 1), "#3a3633")], colour: o.colour ?? "#5f8a4a", flies: true };
  const jet = kind === "jet";
  return {
    pieces: [part(P(-26, -26, 26, -28, 32, -25, 26, -22, -24, -21), "body", 1), behind(P(-4, -26, -14, -38, -8, -38, 6, -26), "dark"), glue(P(-6, -23, -14, -12, -6, -12, 8, -23), "light"),
      part(P(-24, -24, -30, -36, -24, -36, -18, -25)), dot(P(24, -27, 29, -26, 27, -24), "#cfe3ea"), ...(jet ? [] : [glue(band([[33, -32], [33, -18]], 1.2), "#3a3633")])],
    colour: o.colour ?? (jet ? "#b8c2c8" : "#e3b341"), flies: true,
  };
}

// ---------------------------------------------------------------------------------------------
// Signs and emblems for words that are not things you could hold: a placard on a stick with a
// drawn icon, or a rosette.

export function sign(icon: Piece[], board = "#fbf6ea", colour?: string): Silhouette {
  return {
    pieces: [part(R(-1.6, -22, 1.6, 0), "#8a6440"), part(R(-13, -40, 13, -18), board, 1), ...icon.map((p) => ({ ...p, pts: at(p.pts, 0, -29, 0.95), detail: true, glued: false }))],
    colour,
  };
}

export function rosette(icon: Piece[], colour = "#c9553f"): Silhouette {
  return {
    pieces: [glue(P(-6, -18, -10, 0, -5, -4, -2, 0, 0, -18), "dark"), glue(P(6, -18, 10, 0, 5, -4, 2, 0, 0, -18), "dark"),
      part(sym(Array.from({ length: 9 }, (_, i) => { const a = -Math.PI / 2 + (i / 16) * Math.PI * 2; const r = i % 2 ? 12 : 14; return [Math.cos(a) * r, -26 + Math.sin(a) * r] as Pt; })), "body"),
      part(E(0, -26, 9, 9, 14), "#fbf6ea"), ...icon.map((p) => ({ ...p, pts: at(p.pts, 0, -26, 0.75), detail: true, glued: false }))],
    colour,
  };
}

/** Icons, centred on the origin, about 18 across. */
export const icon = {
  heart: (ink = "#d4476a"): Piece[] => [dot(Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * Math.PI * 2; return [Math.sin(a) ** 3 * 8, -(6.5 * Math.cos(a) - 2.5 * Math.cos(2 * a) - Math.cos(3 * a) - 0.5 * Math.cos(4 * a)) * 1.0 + 1] as Pt; }), ink)],
  star: (ink = "#e3b341"): Piece[] => [dot(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 3.8 : 9; return [Math.cos(a) * r, Math.sin(a) * r] as Pt; }), ink)],
  swords: (): Piece[] => [dot(band([[-7, 7], [7, -8]], 2), "#8e98a0"), dot(band([[7, 7], [-7, -8]], 2), "#8e98a0"), dot(band([[-5, 2], [-1, 6]], 1.6), "#8a6440"), dot(band([[5, 2], [1, 6]], 1.6), "#8a6440")],
  coin: (): Piece[] => [dot(E(0, 0, 8, 8, 14), "#e3b341"), dot(E(0, 0, 5.5, 5.5, 12), "#f4d35e"), dot(R(-1, -3.5, 1, 3.5), "#c9932a")],
  hourglass: (): Piece[] => [dot(P(-6, -8, 6, -8, 1, 0, 6, 8, -6, 8, -1, 0), "#a8703c"), dot(P(-3.5, -5.5, 3.5, -5.5, 0, -1), "#e6d3a3"), dot(P(-4, 6.5, 4, 6.5, 0, 3), "#e6d3a3")],
  skull: (): Piece[] => [dot(E(0, -1, 7, 6.5, 14), "#f3ece0"), dot(R(-4, 4, 4, 8), "#f3ece0"), dot(E(-2.6, -1, 1.8, 2, 8), "#2b2a28"), dot(E(2.6, -1, 1.8, 2, 8), "#2b2a28")],
  cross: (ink = "#c9553f"): Piece[] => [dot(R(-2.5, -8, 2.5, 8), ink), dot(R(-8, -2.5, 8, 2.5), ink)],
  scroll: (): Piece[] => [dot(R(-6, -8, 6, 8), "#efe4cf"), dot(E(-6, -8, 2, 2, 8), "#d9c6a0"), dot(E(6, 8, 2, 2, 8), "#d9c6a0"), ...[-4, -1, 2, 5].map((y) => dot(R(-4, y, 4, y + 0.9), "#8a7a60"))],
  flag: (ink = "#c9553f"): Piece[] => [dot(R(-6, -9, -4.5, 9), "#6b4a2e"), dot(P(-4.5, -9, 8, -6, -4.5, -1), ink)],
  trophy: (): Piece[] => [dot(P(-6, -8, 6, -8, 4, 0, 1, 2, 1, 5, 4, 7, -4, 7, -1, 5, -1, 2, -4, 0), "#e3b341"), dot(band(E(-6, -4, 2.5, 3, 8, Math.PI * 0.5, Math.PI * 1.5), 1.2), "#e3b341"), dot(band(E(6, -4, 2.5, 3, 8, -Math.PI * 0.5, Math.PI * 0.5), 1.2), "#e3b341")],
  bolt: (ink = "#e3b341"): Piece[] => [dot(P(2, -9, -5, 1, 0, 1, -2, 9, 5, -2, 0, -2), ink)],
  eye: (): Piece[] => [dot([...E(0, 0, 8, 4.5, 14)], "#fbf7ec"), dot(E(0, 0, 3.4, 3.4, 10), "#4d7b8c"), dot(E(0, 0, 1.5, 1.5, 8), "#2b2a28")],
  crown: (): Piece[] => [dot(P(-8, 5, -8, -5, -4, 0, 0, -7, 4, 0, 8, -5, 8, 5), "#e3b341")],
  drop: (ink = "#4d7b8c"): Piece[] => [dot([[0, -9], ...E(0, 2, 6, 6, 12, -Math.PI * 0.1, Math.PI * 1.1)] as Pt[], ink)],
  flame: (): Piece[] => [dot(P(-5, 7, -6, 0, -2, -3, -1, -9, 3, -4, 5, -6, 6, 2, 4, 7), "#d9573b"), dot(P(-2, 7, -3, 2, 0, -2, 2, 2, 2, 7), "#f4c95d")],
  wave: (ink = "#4d7b8c"): Piece[] => [dot(band(Array.from({ length: 9 }, (_, i) => [-8 + i * 2, Math.sin(i * 1.2) * 2.5 - 2] as Pt), 2), ink), dot(band(Array.from({ length: 9 }, (_, i) => [-8 + i * 2, Math.sin(i * 1.2) * 2.5 + 4] as Pt), 2), ink)],
  moon: (): Piece[] => [dot([...E(0, 0, 8, 8, 16, Math.PI * 0.35, Math.PI * 1.65), ...E(3, 0, 6, 6.5, 12, Math.PI * 1.55, Math.PI * 0.45).reverse()] as Pt[], "#e9d98a")],
  sun: (): Piece[] => [dot(Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 6 : 9.5; return [Math.cos(a) * r, Math.sin(a) * r] as Pt; }), "#f4b942"), dot(E(0, 0, 5, 5, 12), "#f4d35e")],
  cloud: (ink = "#e9eef0"): Piece[] => [dot([...E(-4, 2, 5, 4, 10), ...E(1, -1, 5.5, 5, 10), ...E(5, 2, 4.5, 4, 10)], ink), dot(E(-4, 2, 5, 4, 10), ink), dot(E(1, -1, 5.5, 5, 10), ink), dot(E(5, 2, 4.5, 4, 10), ink)],
  leaf: (ink = "#6f9a50"): Piece[] => [dot(P(-7, 7, -6, -2, 0, -8, 7, -8, 5, 0, -2, 6), ink), dot(band([[-7, 7], [4, -5]], 0.9), "#4f7a4a")],
  note: (): Piece[] => [dot(E(-3, 5, 3.4, 2.6, 10), "#2b2a28"), dot(R(-0.2, -8, 1.3, 5), "#2b2a28"), dot(P(1.3, -8, 7, -5, 7, -2, 1.3, -4), "#2b2a28")],
  gem: (ink = "#5fb3c9"): Piece[] => [dot(P(-7, -3, -4, -7, 4, -7, 7, -3, 0, 8), ink), dot(P(-7, -3, 7, -3, 0, 8), "#3f8ea4")],
  house: (): Piece[] => [dot(R(-6, -1, 6, 8), "#efe4cf"), dot(P(-8, 0, 0, -8, 8, 0), "#c9775a"), dot(R(-1.5, 3, 1.5, 8), "#8a6a4a")],
  arrow: (ink = "#3f6fa8"): Piece[] => [dot(P(-8, -2, 2, -2, 2, -7, 9, 0, 2, 7, 2, 2, -8, 2), ink)],
  foot: (): Piece[] => [dot(E(-3, 2, 3, 5, 10), "#6b4a2e"), dot(E(4, -3, 3, 5, 10), "#6b4a2e")],
  key: (): Piece[] => [dot(band(E(-4, 0, 3.6, 3.6, 12), 1.8), "#c9932a"), dot(R(-0.5, -1, 8, 1), "#c9932a"), dot(R(5, 1, 6.5, 4), "#c9932a")],
  mask: (): Piece[] => [dot(P(-8, -4, 8, -4, 7, 2, 2, 3, 0, 1, -2, 3, -7, 2), "#2b2a28"), dot(E(-4, -1, 1.8, 1.4, 8), "#fbf7ec"), dot(E(4, -1, 1.8, 1.4, 8), "#fbf7ec")],
  gift: (): Piece[] => [dot(R(-7, -3, 7, 8), "#d4476a"), dot(R(-8, -6, 8, -2), "#e0708f"), dot(R(-1.2, -6, 1.2, 8), "#f4d35e"), dot(E(-3, -8, 3, 2, 8), "#f4d35e"), dot(E(3, -8, 3, 2, 8), "#f4d35e")],
  book: (ink = "#3f6fa8"): Piece[] => [dot(R(-7, -8, 7, 8), ink), dot(R(-5, -8, 7, 6), "#fbf7ec"), dot(R(-7, -8, -5, 8), "#2b2a28")],
  clock: (): Piece[] => [dot(E(0, 0, 8.5, 8.5, 16), "#fbf7ec"), dot(band(E(0, 0, 8, 8, 16), 1.2), "#4a3f33"), dot(band([[0, 0], [0, -6]], 1.2), "#4a3f33"), dot(band([[0, 0], [4, 1]], 1.2), "#4a3f33")],
  chain: (): Piece[] => [dot(band(E(-3.5, 0, 4.5, 3, 12), 1.8), "#8e98a0"), dot(band(E(3.5, 0, 4.5, 3, 12), 1.8), "#8e98a0")],
  spiral: (ink = "#8a5ac9"): Piece[] => [dot(band(Array.from({ length: 24 }, (_, i) => { const a = i * 0.5, r = 1 + i * 0.32; return [Math.cos(a) * r, Math.sin(a) * r] as Pt; }), 1.6), ink)],
  fist: (): Piece[] => [dot(R(-6, -5, 6, 6), "#efcfae"), ...[-4.5, -1.5, 1.5, 4.5].map((x) => dot(E(x, -5, 1.6, 1.6, 6), "#d9b896")), dot(R(-6, 6, 6, 9), "#3f6fa8")],
  mountain: (): Piece[] => [dot(P(-9, 7, -2, -7, 3, 0, 5, -3, 10, 7), "#8d877c"), dot(P(-4, -3, -2, -7, 0, -3), "#f6f1e6")],
  hole: (): Piece[] => [dot(E(0, 2, 9, 5, 14), "#5a4636"), dot(E(0, 3, 6.5, 3.4, 12), "#2e241c")],
  island: (): Piece[] => [dot(E(0, 4, 9, 3, 12), "#e6d3a3"), dot(band([[0, 4], [1, -4]], 1.4), "#6b4a2e"), dot(P(1, -4, -6, -2, 1, -6, 7, -3), "#5f8a4a")],
  wheat: (): Piece[] => [dot(band([[0, 9], [0, -6]], 1), "#c9a24a"), ...[-6, -3, 0, 3].map((y) => dot(E(-2, y, 1.8, 2.6, 6), "#e3b341")), ...[-5, -2, 1, 4].map((y) => dot(E(2, y, 1.8, 2.6, 6), "#e3b341"))],
  box: (): Piece[] => [dot(R(-7, -6, 7, 7), "#c9a77a"), dot(R(-7, -6, 7, -3), "#a8703c")],
  bubble: (ink = "#7fbf6a"): Piece[] => [dot(E(-3, 2, 4.5, 4.5, 10), ink), dot(E(4, -3, 3, 3, 8), ink), dot(E(3, 5, 2, 2, 8), ink)],
  bandage: (): Piece[] => [dot(turn(R(-9, -3.5, 9, 3.5), -0.6), "#f3dcc4"), dot(turn(R(-3, -3.5, 3, 3.5), -0.6), "#e9c9a8")],
  people: (): Piece[] => [dot(E(-4, -3, 3, 3, 8), "#c9775a"), dot(E(4, -3, 3, 3, 8), "#3f6fa8"), dot(E(-4, 5, 5, 4, 10), "#c9775a"), dot(E(4, 5, 5, 4, 10), "#3f6fa8")],
  bang: (): Piece[] => [dot(Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2, r = i % 2 ? 4 : 9; return [Math.cos(a) * r, Math.sin(a) * r] as Pt; }), "#ec8e3e"), dot(E(0, 0, 3.5, 3.5, 8), "#f4d35e")],
  snow: (): Piece[] => [0, 1, 2].map((i) => dot(turn(R(-8, -1, 8, 1), (i * Math.PI) / 3), "#9cc6d2")),
  rain: (): Piece[] => [...icon.cloud("#b8c2c8"), ...[-4, 0, 4].map((x) => dot(band([[x, 5], [x - 1.5, 9]], 1.2), "#4d7b8c"))],
};
