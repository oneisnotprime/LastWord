/**
 * From a spelled phrase to how it looks: which silhouette, what colour, how big, and which
 * adjective effects are glued on. Everything comes from the word data through `shared/`.
 */
import { parsePhrase, statureOf, type Dictionary, type Stats } from "@lastword/shared";
import { COLOUR, MATERIAL } from "./palette.js";
import { ARCHETYPES, CLASSES, FALLBACK, men, WORDS } from "./shapes.js";
import { biped, type Silhouette } from "./build.js";

export interface Look {
  /** The word whose silhouette is drawn. */
  noun: string;
  shape: Silhouette;
  colour: string;
  /** The colour comes from an adjective (RED, GOLDEN), not the word: generated images are dyed. */
  dyed: boolean;
  /** 1 is the word's own size; GIANT, HUGE and TINY change it. */
  scale: number;
  burning: boolean;
  frozen: boolean;
  /** Invisible: drawn faint and dashed for whoever can see it at all. */
  invisible: boolean;
  hidden: boolean;
  /** Gives off light at night. */
  glows: boolean;
  /** Many as one body: ANT ×1,000. */
  count: number;
}

/** Drawn bigger than life where small would be unreadable, or bigger to read as big. */
const DISPLAY: Record<string, number> = {
  building: 1.5, fortification: 1.5, structure: 1.3, vehicle_land: 1.25, vehicle_water: 1.3, vehicle_air: 1.3,
  weapon: 1.3, tool: 1.25, container: 1.2, protection: 1.2, clothing: 1.2, adornment: 1.3, device: 1.2, document: 1.2, toy: 1.2,
};

const memo = new Map<string, Omit<Look, "count">>();

/** A silhouette's height and width in units. */
function extent(sil: Silhouette): { h: number; w: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of sil.pieces) for (const [x, y] of p.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return Number.isFinite(x0) ? { h: y1 - y0, w: x1 - x0 } : { h: 0, w: 0 };
}
/** A person's height in units (an ordinary biped): stature 1 on the map. */
const PERSON_UNITS = extent(biped()).h || 46;
const naturals = new Map<Silhouette, number>();
/** The stature a silhouette is drawn at as it is (its height, or most of its length), against a person's. */
function naturalStature(sil: Silhouette): number {
  let n = naturals.get(sil);
  if (n === undefined) { const e = extent(sil); n = Math.max(0.1, Math.max(e.h, e.w * 0.6) / PERSON_UNITS); naturals.set(sil, n); }
  return n;
}

/** The silhouette for a word: its own, else its archetype's, else its class's. */
export function shapeOf(dict: Dictionary, word: string): Silhouette {
  const def = dict.word(word);
  // A group of living people (a CREW, a TRIBE) is several of them, not a flag.
  if (!WORDS[word] && def?.archetype === "group" && def.set.alive === true) return men;
  return WORDS[word] ?? (def && (ARCHETYPES[def.archetype] ?? CLASSES[def.class])) ?? FALLBACK;
}

function safeStats(dict: Dictionary, text: string): { noun: string; stats: Stats | null } {
  try {
    const p = parsePhrase(dict, text);
    return { noun: p.noun, stats: p.stats };
  } catch {
    const last = text.toLowerCase().trim().split(/\s+/).pop() ?? text;
    return { noun: last.replace(/s$/, (s) => (dict.word(last) ? s : "")), stats: null };
  }
}

const num = (s: Stats | null, id: string) => {
  try { return s ? s.num(id) : 0; } catch { return 0; }
};
const tags = (s: Stats | null, id: string): string[] => {
  try { return s ? s.tags(id) : []; } catch { return []; }
};
const text = (s: Stats | null, id: string): string => {
  try { return s ? String(s.get(id) ?? "") : ""; } catch { return ""; }
};

/** How a phrase looks. `count` is how many it is, from the server. */
export function lookOf(dict: Dictionary, phrase: string, count = 1): Look {
  const key = phrase.toLowerCase();
  let base = memo.get(key);
  if (!base) {
    const { noun, stats } = safeStats(dict, key);
    const plain = safeStats(dict, noun).stats;
    const shape = shapeOf(dict, noun);
    // Colour: an adjective's colour or material first (RED CAR, GOLDEN WOLF), then the shape's
    // own, then the word's colour and material.
    const colour = text(stats, "color"), own = text(plain, "color");
    const mats = tags(stats, "material"), ownMats = tags(plain, "material");
    const newMat = mats.find((m) => !ownMats.includes(m));
    const dye = (colour && colour !== own ? COLOUR[colour] : undefined) ?? (newMat ? MATERIAL[newMat] : undefined);
    const paint = dye ??
      shape.colour ?? COLOUR[own] ?? (ownMats[0] ? MATERIAL[ownMats[0]] : undefined) ?? "#c9b99a";
    // Size: the cube root of the mass it gained or lost, else its height.
    const m1 = num(stats, "mass"), m0 = num(plain, "mass"), h1 = num(stats, "height"), h0 = num(plain, "height");
    const ratio = m0 > 0 && m1 > 0 ? Math.cbrt(m1 / m0) : h0 > 0 && h1 > 0 ? h1 / h0 : 1;
    const display = DISPLAY[dict.word(noun)?.archetype ?? ""] ?? 1;
    // A living body is drawn at its stature (shared scale.ts `statureOf`: the cube root of its mass
    // over a person's) when that is bigger than its silhouette already stands: a TITAN of 200 t
    // stands fourteen people tall even though it shares a ghost's or a giant's cut-out.
    const cls = dict.word(noun)?.class;
    const stature = (cls === "creature" || cls === "person") && m0 > 0 ? statureOf(m0, 1) : 0;
    const tall = stature > 0 ? Math.max(1, stature / naturalStature(shape)) : 1;
    const scale = display * tall * Math.max(0.45, Math.min(2.6, Math.pow(ratio, 0.6)));
    const dt = num(stats, "temperature") - num(plain, "temperature");
    const stealth = num(stats, "stealth");
    let untargetable = false;
    try { untargetable = !!stats?.flag("untargetable"); } catch { /* not a flag */ }
    base = {
      noun, shape, colour: paint, dyed: !!dye, scale,
      burning: dt >= 200 || num(stats, "dmg_fire") - num(plain, "dmg_fire") >= 40,
      frozen: dt <= -50,
      invisible: stealth === Infinity,
      hidden: stealth !== Infinity && (untargetable || stealth - num(plain, "stealth") >= 6),
      glows: num(stats, "luminosity") > 0 || dt >= 200,
    };
    memo.set(key, base);
  }
  return { ...base, count };
}

/** A visual key: two looks with the same key draw the same. */
export function lookKey(l: Look, extra = ""): string {
  const n = l.count > 1 ? Math.min(6, Math.floor(Math.log10(l.count) * 2) + 1) : 0;
  return [l.noun, l.colour, l.scale.toFixed(2), +l.burning, +l.frozen, +l.invisible, +l.hidden, n, extra].join("|");
}
