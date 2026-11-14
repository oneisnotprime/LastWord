import type { Dictionary } from "./dictionary.js";
import type { Stats } from "./stats.js";
import type { Value, WordDef } from "./types.js";

/**
 * Materials (dictionary theme 11). A material is a noun of the `material` class (IRON, GLASS,
 * SILK, ACID, BONE, CRYSTAL...) or a `fabric`. Spelled before another noun it rewrites what that
 * thing is made of, and so do adjectives that set `material` to one (WOODEN, GOLDEN, SILKEN):
 * GLASS SWORD, IRON DOG, PAPER CASTLE. The rewrite reads only the material's own properties, the
 * same way for every word:
 *
 * - density: mass scales by the density ratio; blunt and crushing blows by its square root; speed
 *   by its fourth root the other way (an IRON DOG is heavy and slow, a PAPER one light).
 * - toughness (`integrity` of the material): integrity scales by the ratio.
 * - hardness: replaces the old; a body's armour moves by ARMOR_PER_HARDNESS a point (IRON DOG is
 *   armoured); edged damage scales by edge (the larger of hardness and sharpness).
 * - brittleness, flammability, conductivity, magnetism, melting point, transparency, reflectivity,
 *   buoyancy, temperature, colour: taken from the material.
 * - value scales by the ratio; beauty, toxicity, luminosity and corrosiveness rise to the material's.
 * - the material's own damage, resistances, immunities and statuses are added (an ICE sword
 *   freezes, an ACID one dissolves, a STONE dog shrugs off slashes).
 *
 * What a body is made of then decides what hurts it (`susceptibility`, used by every strike):
 * brittle things shatter under blows, flammable things burn, low melting points melt, and
 * conductors carry lightning.
 */

/** Armour a living body (or anything already armoured) gains per point of hardness over its old material. */
export const ARMOR_PER_HARDNESS = 5;
/** Properties a material simply hands to what is made of it, when it sets them. */
const TAKEN = ["hardness", "brittleness", "flammability", "conductivity", "magnetism", "melting_point", "transparency",
  "reflectivity", "buoyancy", "temperature", "elasticity", "burn_time", "slipperiness", "stickiness"] as const;
/** Properties that rise to the material's own if it has more. */
const RAISED = ["beauty", "toxicity", "luminosity", "corrosiveness", "radioactivity", "odor"] as const;

/** What any body is made of when its data names no material: living flesh, or ordinary stuff. */
const FLESH: Record<string, number> = { density: 1000, integrity: 100, hardness: 3, brittleness: 2, flammability: 1, conductivity: 3, value: 1, sharpness: 0 };

/** True for a word that names a material: a noun of the material class, or a fabric. */
export function isMaterial(def: WordDef | undefined): boolean {
  return !!def && def.role === "noun" && (def.class === "material" || def.archetype === "fabric");
}

/** The first material word among a `material` tag list that the dictionary knows. */
export function knownMaterial(dict: Dictionary, tags: Value): string | null {
  for (const t of Array.isArray(tags) ? tags : typeof tags === "string" && tags ? [tags] : []) {
    if (isMaterial(dict.word(t))) return t.toLowerCase();
  }
  return null;
}

/** A material's numbers, its own values over the property defaults. */
function grain(dict: Dictionary, word: string | null): Record<string, number> {
  if (!word) return FLESH;
  const set = dict.word(word)!.set;
  const n = (id: string, fallback?: number) => {
    const v = set[id];
    return typeof v === "number" ? v : fallback ?? Number(dict.property(id).default);
  };
  return {
    density: n("density", 1000), integrity: n("integrity", 100), hardness: n("hardness"), brittleness: n("brittleness"),
    flammability: n("flammability"), conductivity: n("conductivity"), value: Math.max(1e-3, n("value")), sharpness: n("sharpness"),
  };
}

const edge = (g: Record<string, number>) => Math.max(1, g.hardness ?? 3, g.sharpness ?? 0);

/**
 * Remakes a thing out of a material (see the file comment). `stats` is changed in place; `word`
 * is the material noun. Absolutes stay absolute.
 */
export function applyMaterial(dict: Dictionary, stats: Stats, word: string): void {
  const def = dict.word(word);
  if (!isMaterial(def)) throw new Error(`${word} is not a material`);
  const from = grain(dict, knownMaterial(dict, stats.get("material")));
  const to = grain(dict, word);
  const scale = (id: string, f: number) => {
    const v = stats.get(id);
    if (typeof v === "number" && v !== 0 && Number.isFinite(f)) stats.set(id, v * f);
  };
  const d = to.density! / Math.max(1, from.density!);
  scale("mass", d);
  scale("integrity", to.integrity! / Math.max(1, from.integrity!));
  scale("value", to.value! / from.value!);
  for (const id of ["speed_land", "speed_air", "speed_water"]) scale(id, d ** -0.25);
  const blows = Math.sqrt(d), cut = edge(to) / edge(from);
  for (const [id, v] of stats.entries()) {
    if (typeof v !== "number" || !id.startsWith("dmg_")) continue;
    if (id === "dmg_blunt" || id === "dmg_crush") scale(id, blows);
    else if (id === "dmg_slash" || id === "dmg_pierce") scale(id, cut);
  }
  const armor = stats.get("armor");
  if (typeof armor === "number" && (armor > 0 || stats.flag("alive"))) {
    stats.set("armor", Math.max(0, armor + ARMOR_PER_HARDNESS * (to.hardness! - from.hardness!)));
  }
  const own = def!.set;
  if (typeof own.sharpness === "number" && stats.num("sharpness") > 0) stats.set("sharpness", own.sharpness);
  for (const id of TAKEN) if (own[id] !== undefined) stats.set(id, own[id]!);
  for (const id of RAISED) {
    const v = own[id];
    if (typeof v === "number" && v > stats.num(id)) stats.set(id, v);
  }
  if (typeof own.density === "number") stats.set("density", own.density);
  const hits = [...stats.entries()].some(([id, v]) => id.startsWith("dmg_") && typeof v === "number" && v > 0);
  for (const [id, v] of Object.entries(own)) {
    if (id.startsWith("dmg_") && typeof v === "number" && hits) stats.set(id, stats.num(id) + v);
    else if ((id.startsWith("res_") || id.startsWith("inflict_")) && typeof v === "number" && v > stats.num(id)) stats.set(id, v);
    else if (id.startsWith("immune_") && v === true) stats.set(id, true);
  }
  stats.set("color", typeof own.color === "string" && own.color ? own.color : word.toLowerCase());
  stats.set("material", [word.toLowerCase()]);
}

/** Blows and crushing from brittleness: ×1 at 2 or less, ×2.75 for glass (9). */
export const SHATTER = 0.25;
/** Fire from flammability: ×1 at 1, ×3 for paper (9), ×0.5 for stone (0). */
export const KINDLE = 0.25;
/** Lightning from conductivity: ×1 at 1, about ×2 for iron (7). */
export const CONDUCT = 0.15;
/** Below this melting point (°C) fire melts a thing away faster: ice (0) takes ×3. */
export const MELTS_BELOW = 200;

/**
 * How much more (or less) a body takes of one damage type for what it is made of. 1 means
 * ordinary. Read by every strike.
 */
export function susceptibility(target: Stats, type: string): number {
  switch (type) {
    case "blunt": case "crush": case "blast": case "sonic":
      return 1 + Math.max(0, target.num("brittleness") - 2) * SHATTER;
    case "fire": {
      const f = target.num("flammability");
      const kindle = f >= 1 ? 1 + (f - 1) * KINDLE : 0.5 + 0.5 * Math.max(0, f);
      const mp = target.num("melting_point");
      // What melts (ice, wax, butter) goes in fire however little it burns.
      return mp < MELTS_BELOW ? Math.max(1, kindle) * (1 + (MELTS_BELOW - Math.max(-100, mp)) / 100) : Math.max(0, kindle);
    }
    case "electric":
      return 1 + Math.max(0, target.num("conductivity") - 1) * CONDUCT;
    default:
      return 1;
  }
}

/** What a thing's make-up does to it in a fight, in plain short lines for its card. */
export function materialText(dict: Dictionary, s: Stats): string[] {
  const out: string[] = [];
  const made = knownMaterial(dict, s.get("material"));
  if (made) out.push(`made of ${made.replaceAll("_", " ")}`);
  const fmt = (n: number) => `×${+n.toFixed(2)}`;
  const blows = susceptibility(s, "blunt"), fire = susceptibility(s, "fire"), shock = susceptibility(s, "electric");
  if (blows > 1.01) out.push(`brittle: takes blows ${fmt(blows)}`);
  if (fire > 1.01) out.push(`${s.num("melting_point") < MELTS_BELOW ? "melts" : "burns"}: takes fire ${fmt(fire)}`);
  else if (fire < 0.99) out.push(`does not burn: takes fire ${fmt(fire)}`);
  if (shock > 1.01) out.push(`conducts: takes lightning ${fmt(shock)}`);
  return out;
}
