/**
 * 1. LIVING LETTERS. Everything is drawn with the letters of its own word: water is a field of
 * O's and ~'s, forest a thicket of T's and Y's, a wolf is W, O, L, F arranged on a quadruped
 * skeleton.
 *
 * Scaling: no per-word art at all. Each archetype (quadruped, flyer, humanoid, box, swarm,
 * field, wall) is a skeleton of letter slots; a noun pours its own letters into its archetype's
 * slots, so all 36,000 nouns draw themselves. Adjectives are their own letters too: BURNING
 * sheds flame-coloured B-U-R-N letters, GIANT scales the glyphs and thickens the weight.
 */
import { areas, COLS, H, inset, ROWS, S, things, tile, Tile, W, type Thing } from "./scene.js";
import type { Style } from "./style.js";
import { clamp, hash, layer, makeField, maskCanvas, type Ctx } from "./util.js";

const FONT = "'Bricolage Grotesque', system-ui, sans-serif";
const BONE = "#f4f1ea";
const f = (w: number, px: number) => `${w} ${px}px ${FONT}`;

/** A letter slot on an archetype skeleton, relative to the feet, facing right. */
interface Slot { x: number; y: number; size: number; rot?: number; sx?: number; color?: string; flap?: number; /** Repeats another slot's letter. */ same?: number }

const SKELETONS: Record<"quadruped" | "flyer" | "humanoid", Slot[]> = {
  // W O L F: head, body, legs, tail.
  quadruped: [
    { x: 19, y: -24, size: 22, rot: Math.PI },
    { x: -3, y: -17, size: 34, sx: 1.55 },
    { x: 9, y: -6, size: 20 },
    { x: -27, y: -21, size: 24, rot: -1.1 },
    { x: -12, y: -6, size: 20, same: 2 },
  ],
  // D R A G O N: body, tail, wing, head, eye, tail tip.
  flyer: [
    { x: 0, y: -2, size: 46, sx: 1.35 },
    { x: -34, y: 2, size: 28, rot: 0.5 },
    { x: -2, y: -34, size: 54, rot: -0.55, flap: 1 },
    { x: 34, y: -18, size: 32, rot: 0.15 },
    { x: 37, y: -22, size: 9 },
    { x: -54, y: 10, size: 22, rot: 1.0 },
  ],
  // Name: head in a ring, torso, legs.
  humanoid: [
    { x: 0, y: -34, size: 13 },
    { x: 0, y: -18, size: 24, sx: 1.25 },
    { x: 0, y: -4, size: 18, rot: Math.PI },
  ],
};

/** Set while drawing creatures and objects, so their letters stand off the letter-filled ground. */
let halo = false;

function glyph(ctx: Ctx, ch: string, x: number, y: number, size: number, color: string, rot = 0, sx = 1, weight = 800) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sx, 1);
  ctx.font = f(weight, size);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (halo) { ctx.lineJoin = "round"; ctx.strokeStyle = BONE; ctx.lineWidth = Math.max(2, size * 0.12); ctx.strokeText(ch, 0, 0); }
  ctx.fillStyle = color;
  ctx.fillText(ch, 0, 0);
  ctx.restore();
}

/** Letters placed on a skeleton: the word's letters fill the slots in order, cycling if short. */
function creature(ctx: Ctx, word: string, kind: keyof typeof SKELETONS, x: number, y: number, scale: number, facing: number, colors: string[], t: number, weight = 800) {
  const letters = word.toUpperCase().split("");
  const slots = SKELETONS[kind];
  const n = Math.max(letters.length, kind === "quadruped" ? 5 : slots.length);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => (slots[a % slots.length]!.flap ? -1 : 0) - (slots[b % slots.length]!.flap ? -1 : 0));
  // A flyer's far wing first, in a paler colour.
  if (kind === "flyer") {
    const w = slots[2]!;
    const flap = Math.sin(t * 4) * 0.35;
    ctx.globalAlpha = 0.45;
    glyph(ctx, letters[2 % letters.length]!, x + (w.x - 18) * facing * scale, y + (w.y + 2) * scale, w.size * 0.8 * scale, colors[2]!, (w.rot! - flap - 0.5) * facing, 1, weight);
    ctx.globalAlpha = 1;
  }
  for (const i of order) {
    const s = slots[i % slots.length]!;
    const ch = letters[(s.same ?? i) % letters.length]!;
    const flap = s.flap ? Math.sin(t * 4) * 0.35 : 0;
    const bob = kind === "humanoid" ? 0 : Math.sin(t * 3 + i) * 0.6;
    const c = s.color ?? colors[i % colors.length]!;
    if (kind === "humanoid" && i === 0) {
      ctx.beginPath();
      ctx.arc(x, y + s.y * scale, 9 * scale, 0, Math.PI * 2);
      ctx.fillStyle = colors[0]!;
      ctx.fill();
      glyph(ctx, ch, x, y + s.y * scale + 0.5, s.size * scale, BONE, 0, 1, weight);
      continue;
    }
    if (i === 4 && kind === "flyer") { glyph(ctx, "O", x + s.x * facing * scale, y + s.y * scale, s.size * scale, "#ffd23f", 0, 1, 900); continue; }
    glyph(ctx, ch, x + s.x * facing * scale, y + (s.y + bob) * scale, s.size * scale, c, ((s.rot ?? 0) + flap) * facing, (s.sx ?? 1) * facing, weight);
  }
}

/** The word written round a circle, turning slowly. */
function ring(ctx: Ctx, word: string, x: number, y: number, r: number, color: string, spin: number, size = 14) {
  const text = `${word} · `;
  ctx.font = f(800, size);
  const per = ctx.measureText("M").width * 0.95 / r;
  const reps = Math.floor((Math.PI * 2) / (per * text.length));
  const full = text.repeat(reps);
  const step = (Math.PI * 2) / full.length;
  for (let i = 0; i < full.length; i++) {
    const a = spin + i * step;
    glyph(ctx, full[i]!, x + Math.cos(a) * r, y + Math.sin(a) * r, size, color, a + Math.PI / 2);
  }
}

/** Letters rising and fading like flames or sparks. */
function rising(ctx: Ctx, word: string, x: number, y: number, r: number, n: number, t: number, palette: string[], size: number, speed: number, height: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const a = hash(i, 1, seed) * Math.PI * 2, d = Math.sqrt(hash(i, 2, seed)) * r;
    const life = (t * speed + hash(i, 3, seed)) % 1;
    const px = x + Math.cos(a) * d + Math.sin(t * 5 + i) * 2;
    const py = y + Math.sin(a) * d * 0.8 - life * height;
    const c = palette[Math.min(palette.length - 1, Math.floor(life * palette.length))]!;
    ctx.globalAlpha = clamp(1.2 - life) * clamp(life * 6);
    glyph(ctx, word[i % word.length]!, px, py, size * (1.15 - life * 0.6) * (0.7 + hash(i, 4, seed) * 0.6), c, (hash(i, 5, seed) - 0.5) * 0.6);
  }
  ctx.globalAlpha = 1;
}

let terrain: HTMLCanvasElement | null = null;

/** Static terrain: soft washes, then a glyph field per tile. */
function buildTerrain(): HTMLCanvasElement {
  const res = 2;
  const [c, ctx] = layer(W, H, res);
  ctx.fillStyle = BONE;
  ctx.fillRect(0, 0, W, H);
  const wash = (test: (t: Tile) => boolean, rgb: [number, number, number], alpha: number) => {
    const field = makeField(COLS, ROWS, S, 4, 3, (x, y) => (test(tile(x, y)) ? 1 : 0));
    ctx.drawImage(maskCanvas(field, W, H, res, 0.5, rgb, { alpha, rough: 0.12, roughScale: 4 }), 0, 0, W, H);
  };
  wash((t) => t === Tile.Water || t === Tile.DeepWater, [214, 229, 240], 1);
  wash((t) => t === Tile.DeepWater, [190, 212, 233], 1);
  wash((t) => t === Tile.Forest, [222, 234, 214], 1);
  wash((t) => t === Tile.City || t === Tile.Road, [228, 224, 216], 1);
  wash((t) => t === Tile.Sand, [240, 228, 196], 1);

  const marks: { y: number; draw: () => void }[] = [];
  for (let ty = -1; ty <= ROWS; ty++) for (let tx = -1; tx <= COLS; tx++) {
    const k = tile(tx, ty);
    const r = (i: number) => hash(tx * 7 + i, ty * 13 + i, 99);
    const X = tx * S, Y = ty * S;
    if (k === Tile.Grass) {
      for (let i = 0; i < 4; i++) {
        if (r(i) < 0.55) continue;
        const ch = "grass,'"[Math.floor(r(i + 10) * 7)]!;
        const x = X + (i % 2) * 16 + 4 + r(i + 20) * 10, y = Y + Math.floor(i / 2) * 16 + 6 + r(i + 30) * 8;
        marks.push({ y, draw: () => glyph(ctx, ch, x, y, 10 + r(i + 40) * 5, ["#6a9a3a", "#8bb043", "#4f7d2c"][Math.floor(r(i + 50) * 3)]!, (r(i + 60) - 0.5) * 0.5, 1, 600) });
      }
    } else if (k === Tile.Forest) {
      for (let i = 0; i < 3; i++) {
        const ch = r(i + 5) < 0.55 ? "T" : "Y";
        const x = X + r(i) * S, y = Y + r(i + 20) * S;
        const size = 20 + r(i + 30) * 10;
        marks.push({ y, draw: () => glyph(ctx, ch, x, y, size, ["#1f5a32", "#2e7a3e", "#164428", "#3f8f3a"][Math.floor(r(i + 40) * 4)]!, (r(i + 50) - 0.5) * 0.3) });
      }
    } else if (k === Tile.Sand) {
      for (let i = 0; i < 6; i++) {
        const x = X + r(i) * S, y = Y + r(i + 9) * S;
        marks.push({ y, draw: () => glyph(ctx, "sand.:"[Math.floor(r(i + 3) * 6)]!, x, y, 9 + r(i + 4) * 3, "#c79f4e", 0, 1, 600) });
      }
    } else if (k === Tile.Hill) {
      for (let i = 0; i < 1; i++) {
        const x = X + 10 + r(i) * 12, y = Y + 10 + r(i + 9) * 12;
        marks.push({ y, draw: () => glyph(ctx, r(i + 2) < 0.6 ? "n" : "h", x, y, 18 + r(i + 3) * 6, ["#9c8a3e", "#b39a48", "#857536"][Math.floor(r(i + 5) * 3)]!, 0, 1.3, 800) });
      }
    } else if (k === Tile.Mountain) {
      const x = X + 16 + (r(1) - 0.5) * 8, y = Y + 16 + (r(2) - 0.5) * 8;
      marks.push({ y, draw: () => { glyph(ctx, r(3) < 0.5 ? "M" : "A", x, y, 34, "#6d6a66", 0, 1.1, 800); glyph(ctx, "^", x, y - 11, 14, "#ffffff", 0, 1, 800); } });
    } else if (k === Tile.Road) {
      const ch = "ROAD"[((tx % 4) + 4) % 4]!;
      marks.push({ y: Y, draw: () => glyph(ctx, ch, X + 16, Y + 16, 24, "#9a6a3a", 0, 1, 800) });
    } else if (k === Tile.City) {
      // Blocks of C-I-T-Y with streets every fourth row and column.
      const street = ((tx % 3) + 3) % 3 === 0 || ((ty % 3) + 3) % 3 === 0;
      if (street) continue;
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
        const ch = "CITY"[(((tx % 3) + 3) % 3 - 1) * 2 + i]!;
        const lit = hash(tx * 2 + i, ty * 2 + j, 5) < 0.1;
        const x = X + 8 + i * 16, y = Y + 9 + j * 15;
        marks.push({ y, draw: () => glyph(ctx, ch, x, y, 17, lit ? "#e4572e" : ["#55524c", "#6e6a63", "#7f7a72"][Math.floor(hash(tx + i, ty + j, 6) * 3)]!, 0, 1, 800) });
      }
    }
  }
  marks.sort((a, b) => a.y - b.y).forEach((m) => m.draw());
  return c;
}

/** Water is drawn every frame: its O's and ~'s roll. */
function water(ctx: Ctx, t: number) {
  for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
    const k = tile(tx, ty);
    if (k !== Tile.Water && k !== Tile.DeepWater) continue;
    const deep = k === Tile.DeepWater;
    for (let i = 0; i < 4; i++) {
      const gx = tx * S + (i % 2) * 16 + 8, gy = ty * S + Math.floor(i / 2) * 16 + 8;
      const ph = t * 1.6 + gx * 0.03 + gy * 0.05;
      const ch = (hash(tx * 2 + (i % 2), ty * 2 + (i >> 1), 3) + t * 0.15) % 1 < 0.5 ? "~" : deep ? "O" : "o";
      glyph(ctx, ch, gx + Math.sin(ph) * 3, gy + Math.cos(ph * 0.8) * 1.5, ch === "~" ? 18 : deep ? 14 : 12, deep ? "#1d4f91" : "#3b82c4", 0, 1, ch === "~" ? 800 : 600);
    }
  }
}

function sword(ctx: Ctx, x: number, y: number, scale: number, rot: number, burning: boolean, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  glyph(ctx, "+", 0, -2, 18, "#3a3a3a");
  "SWORD".split("").forEach((ch, i) => glyph(ctx, ch, 0, -12 - i * 9, 13 - i * 0.6, "#5d6b78", 0, 1, 800));
  if (burning) rising(ctx, "BURNING", 9, -16, 6, 16, t, ["#ffd23f", "#ff9f1c", "#e4572e", "#a3261e"], 11, 0.6, 40, 5);
  ctx.restore();
}

function thing(ctx: Ctx, th: Thing, t: number) {
  halo = th.kind !== "swarm" && th.kind !== "wall";
  drawThing(ctx, th, t);
  halo = false;
}

function drawThing(ctx: Ctx, th: Thing, t: number) {
  const { x, y, scale: s, facing } = th;
  switch (th.kind) {
    case "wolf": {
      const giant = th.label.startsWith("GIANT");
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.beginPath(); ctx.ellipse(x, y, 26 * s, 4 * s, 0, 0, Math.PI * 2); ctx.fill();
      creature(ctx, th.word, "quadruped", x, y, s, facing, ["#3c4a5c", "#5b6b80", "#3c4a5c", "#7a8aa0"], t, giant ? 900 : 800);
      break;
    }
    case "dragon": {
      ctx.fillStyle = "rgba(60,20,10,0.12)";
      ctx.beginPath(); ctx.ellipse(x + 10, y + 46, 50, 9, 0, 0, Math.PI * 2); ctx.fill();
      creature(ctx, th.word, "flyer", x, y + Math.sin(t * 2) * 3, s, facing, ["#c0392b", "#d1495b", "#e4572e", "#a3261e", "#ffd23f", "#e4572e"], t);
      break;
    }
    case "player": {
      const color = th.who === 0 ? "#2a6fdb" : "#8e44ad";
      creature(ctx, th.word, "humanoid", x, y, s, facing, [color, color, color], t);
      if (th.held) sword(ctx, x + 12 * facing, y - 16, 0.9, 0.55 * facing, false, t);
      break;
    }
    case "sword":
      sword(ctx, x, y, s, 0.25, !!th.burning, t);
      break;
    case "chest": {
      glyph(ctx, "C", x, y - 21, 30, "#8a5a2b", Math.PI / 2, 1.3, 900);
      ctx.fillStyle = "#e9d9b8";
      ctx.fillRect(x - 17, y - 18, 34, 18);
      const body = "HEST";
      for (let i = 0; i < 4; i++) glyph(ctx, body[i]!, x - 11 + i * 7.5, y - 8, 15, i === 2 ? "#e4a72e" : "#8a5a2b", 0, 1, 900);
      break;
    }
    case "wall": {
      const len = (th.size ?? 3) * S;
      ctx.fillStyle = "#d9d2c5";
      ctx.fillRect(x - len / 2, y - 30, len, 30);
      for (let row = 0; row < 3; row++) {
        const text = "WALL".repeat(8);
        const off = row % 2 ? 7 : 0;
        ctx.save();
        ctx.beginPath(); ctx.rect(x - len / 2, y - 30, len, 30); ctx.clip();
        for (let i = 0; i * 13.5 - off < len + 14; i++) glyph(ctx, text[i]!, x - len / 2 + i * 13.5 - off + 6, y - 25 + row * 10, 13, row === 1 ? "#5a5550" : "#3d3934", 0, 1.1, 900);
        ctx.restore();
      }
      break;
    }
    case "swarm": {
      const r = (th.size ?? 1.5) * S;
      for (let i = 0; i < 170; i++) {
        const a = i * 2.399963, d = Math.sqrt((i + 0.5) / 170) * r;
        const px = x + Math.cos(a) * d + Math.sin(t * 4 + i) * 2, py = y + Math.sin(a) * d * 0.7 + Math.cos(t * 3.3 + i * 1.3) * 2;
        glyph(ctx, "ant"[i % 3]!, px, py, 8 + (i % 3), i % 4 === 0 ? "#a0522d" : "#2b2b2b", Math.sin(t * 2 + i), 1, 700);
      }
      break;
    }
  }
}

function caption(ctx: Ctx, text: string, x: number, y: number, color = "#1b1b1b", size = 11) {
  ctx.font = f(800, size);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = BONE;
  ctx.lineWidth = 4;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

export const lettersStyle: Style = {
  id: "letters",
  name: "Living Letters",
  tagline: "Everything is spelled: a wolf is W, O, L, F on a quadruped skeleton; water is rolling O's and ~'s, forest a thicket of T's and Y's, the road spells ROAD.",
  adjectives: "BURNING sheds its own letters as flames off the blade. GIANT doubles the glyphs and goes to the heaviest weight.",
  scaling: "Needs no per-word art. Each archetype (quadruped, flyer, humanoid, box, swarm, wall) is a skeleton of letter slots and every noun pours its own letters into its archetype; adjectives add their letters as an overlay or change size and weight. All 36,000 nouns work on day one.",
  fonts: [f(800, 20), f(600, 20), f(400, 20), f(700, 20), f(900, 20)],
  night: "rgba(16,20,44,0.74)",
  world(ctx, t) {
    terrain ??= buildTerrain();
    ctx.drawImage(terrain, 0, 0, W, H);
    water(ctx, t);
    const fire = areas[0]!, love = areas[1]!;
    const glow = ctx.createRadialGradient(fire.x, fire.y, 0, fire.x, fire.y, fire.r);
    glow.addColorStop(0, "rgba(255,159,28,0.35)"); glow.addColorStop(1, "rgba(255,159,28,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(fire.x, fire.y, fire.r, 0, Math.PI * 2); ctx.fill();
    rising(ctx, "FIRE", fire.x, fire.y + 18, fire.r * 0.85, 70, t, ["#ffd23f", "#ff9f1c", "#e4572e", "#a3261e", "#3a1a12"], 22, 0.55, 46, 11);
    ring(ctx, "FIRE", fire.x, fire.y, fire.r, "#e4572e", t * 0.25, 13);
    const pink = ctx.createRadialGradient(love.x, love.y, 0, love.x, love.y, love.r);
    pink.addColorStop(0, "rgba(232,72,128,0.0)"); pink.addColorStop(1, "rgba(232,72,128,0.16)");
    ctx.fillStyle = pink; ctx.beginPath(); ctx.arc(love.x, love.y, love.r, 0, Math.PI * 2); ctx.fill();
    ring(ctx, "LOVE", love.x, love.y, love.r, "#e0457b", -t * 0.2, 12);
    rising(ctx, "LOVE", love.x, love.y + 10, love.r * 0.8, 16, t, ["#ff8fb1", "#e0457b", "#e0457b"], 12, 0.18, 26, 21);
    [...things].sort((a, b) => a.y - b.y).forEach((th) => thing(ctx, th, t));
  },
  labels(ctx) {
    for (const th of things) {
      const below = th.kind === "dragon" ? 34 : th.kind === "swarm" ? 30 : 12;
      if (th.kind === "player") caption(ctx, th.label, th.x, th.y + below, th.who === 0 ? "#2a6fdb" : "#8e44ad", 12);
      else caption(ctx, th.label, th.x, th.y + below, "#1b1b1b", th.kind === "swarm" ? 13 : 11);
    }
  },
  inset(ctx, t) {
    ctx.fillStyle = BONE;
    ctx.fillRect(0, 0, inset.w, inset.h);
    ctx.fillStyle = "#e4dccb";
    ctx.fillRect(0, 128, inset.w, 2);
    thing(ctx, inset.sword, t);
    thing(ctx, inset.wolf, t);
    caption(ctx, "BURNING SWORD", 70, 150, "#e4572e", 12);
    caption(ctx, "GIANT WOLF", 190, 150, "#3c4a5c", 12);
  },
};
