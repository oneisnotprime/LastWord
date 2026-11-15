import type { Dictionary } from "./dictionary.js";
import { knownMaterial } from "./material.js";
import { GROW_PACE } from "./produce.js";
import type { Stats } from "./stats.js";
import type { Spelled } from "./unit.js";

/**
 * Bugs, grubs and swarms (dictionary theme 26), read the same way for every word:
 *
 * - Growing up: a creature with `matures_into` (a LARVA, a MAGGOT, a CATERPILLAR, a TADPOLE)
 *   becomes that creature once it is `growth_time` × GROW_PACE minutes old: the count, its master
 *   and its adjectives kept (thirty MAGGOTS become thirty BLOWFLIES). Ageing words (CENTURY) grow
 *   it up at once, time fields hurry or hold it, and killing it young is the counter.
 * - Boring: a creature whose `bores` names materials (a TERMITE wood, a SHIPWORM wood, a MOTH
 *   cloth) eats into things made of them within BORE_TILES of it, on its own, at BORE_TIMES its
 *   bite and through their armour: wild ones anything, owned ones only other sides' things. A
 *   thing of another material (a STONE HOUSE, an IRON SHIP) is safe from it.
 * - Hatching (theme 29): a thing lying on the ground or carried that `matures_into` a creature (an
 *   EGG, a COCOON, a PUPA, a dragon's CLUTCH) hatches into it the same way, as a creature of the
 *   thing's owner: the count kept. Breaking or eating it first is the counter.
 */

/** Tiles from a borer that it eats into a thing (a building's middle: a HOUSE is two tiles across). */
export const BORE_TILES = 3;
/** A borer's bite on what it bores, against its ordinary blow: it eats from the inside. */
export const BORE_TIMES = 4;

/** Seconds a creature takes to grow into its `matures_into`, or Infinity if it never does. */
export function matureSeconds(s: Stats): number {
  const into = String(s.get("matures_into") || "");
  if (!into) return Infinity;
  return Math.max(5, s.num("growth_time") * GROW_PACE * 60);
}

/**
 * What a creature grows into, if its `matures_into` names a creature the dictionary has: the
 * count kept, adjectives kept while the new noun has room. Null if it never grows up.
 */
export function matured(dict: Dictionary, s: Spelled, stats: Stats): Spelled | null {
  const into = String(stats.get("matures_into") || "").toLowerCase();
  const next = into ? dict.word(into) : undefined;
  if (!next || next.role !== "noun" || into === s.noun) return null;
  const slots = Number(next.set.adjective_slots ?? dict.property("adjective_slots").default);
  const adjectives = (s.adjectives ?? []).slice(0, slots);
  return { noun: into, ...(adjectives.length ? { adjectives } : {}), ...(s.count ? { count: s.count } : {}) };
}

/** Whether a thing (not a creature) hatches: it `matures_into` a noun the dictionary has. */
export function hatches(dict: Dictionary, s: Stats): boolean {
  const into = String(s.get("matures_into") || "").toLowerCase();
  return !!into && dict.word(into)?.role === "noun";
}

/** True if a borer eats into a thing: the thing's material (its first known one) is among the borer's `bores`. */
export function bores(dict: Dictionary, borer: Stats, thing: Stats): boolean {
  const eats = borer.get("bores");
  const list = (Array.isArray(eats) ? eats : typeof eats === "string" && eats ? [eats] : []).map((x) => String(x).toLowerCase());
  if (!list.length) return false;
  const made = thing.get("material");
  const tags = (Array.isArray(made) ? made : typeof made === "string" && made ? [made] : []).map((x) => String(x).toLowerCase());
  const main = knownMaterial(dict, tags) ?? tags[0];
  return !!main && list.includes(main);
}

/** Lines for a card: what it grows into and what it eats. */
export function bugText(dict: Dictionary, s: Stats): string[] {
  const out: string[] = [];
  const into = String(s.get("matures_into") || "");
  if (into && dict.word(into)) out.push(`${s.flag("alive") && Math.max(s.num("speed_land"), s.num("speed_air"), s.num("speed_water")) > 0 ? "grows" : "hatches"} into ${into.toUpperCase()} in ${Math.round(matureSeconds(s))} s`);
  const eats = s.get("bores");
  const list = Array.isArray(eats) ? eats : typeof eats === "string" && eats ? [eats] : [];
  if (list.length) out.push(`bores into ${list.join(", ")}: eats things made of it within ${BORE_TILES} tiles, through armour`);
  return out;
}
