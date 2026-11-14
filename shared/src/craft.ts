import type { Dictionary } from "./dictionary.js";
import { isMaterial } from "./material.js";
import type { Stats } from "./stats.js";

/**
 * Tools and crafting (dictionary theme 5). A crafting station (an ANVIL, a WORKBENCH, a LOOM, a
 * KILN, a FORGE) lists in `crafts` the kinds of thing made at it (archetypes such as weapon, tool,
 * furniture, container, clothing, or a class such as artifact) and the materials it works (a
 * material word such as wood or iron, or a material archetype: metal, mineral, gem, fabric,
 * material). What its owner spells within CRAFT_RANGE of it, of a kind it makes, is crafted:
 *
 * - it comes out HANDMADE (a state, no adjective slot): sturdier, sharper, worth more;
 * - if no material was spelled and its maker carries a material the station works (a bar of IRON,
 *   a pile of WOOD), the thing is made of that material, which is used up: IRON carried to an
 *   ANVIL makes an IRON SWORD for the letters of SWORD alone; GLASS at a KILN, a GLASS VASE.
 *
 * Counter: break or steal the station, or take the material before it is worked.
 */

/** Tiles from a station within which what its owner spells is crafted. */
export const CRAFT_RANGE = 6;
/** The state a crafted thing takes (an adjective in the data; it takes no slot). */
export const CRAFTED = "handmade";

/** What a station makes and works, from its `crafts`. */
export const craftsOf = (s: Stats): string[] => s.tags("crafts").map((t) => t.toLowerCase());

/** True if a station's `crafts` take a noun: its archetype, its class or the word itself. */
export function makesAt(dict: Dictionary, crafts: readonly string[], noun: string): boolean {
  const def = dict.word(noun);
  if (!def || def.role !== "noun" || isMaterial(def)) return false;
  return crafts.includes(def.archetype) || crafts.includes(def.class) || crafts.includes(noun);
}

/** True if a station's `crafts` work a material word: the word itself or its archetype. */
export function worksAt(dict: Dictionary, crafts: readonly string[], material: string): boolean {
  const def = dict.word(material);
  if (!isMaterial(def)) return false;
  return crafts.includes(material) || crafts.includes(def!.archetype);
}

/** A station near the speller, and the materials they carry (by noun, in carrying order). */
export interface CraftPlan {
  station: string;
  /** Index into the carried list of the material used up, if one is. */
  used: number | null;
  /** States the made thing takes: HANDMADE, and the material it is made of. */
  states: string[];
}

/**
 * How a noun spelled with `adjectives` is crafted, given the stations its maker has in reach
 * (word and `crafts`, nearest first) and the nouns of what they carry; null if no station makes it.
 * A spelled material (GLASS SWORD, WOODEN) is kept and nothing carried is used.
 */
export function craftPlan(
  dict: Dictionary, noun: string, adjectives: readonly string[],
  stations: readonly { word: string; crafts: readonly string[] }[], carried: readonly string[],
): CraftPlan | null {
  const at = stations.find((s) => makesAt(dict, s.crafts, noun));
  if (!at) return null;
  const states = dict.word(CRAFTED) ? [CRAFTED] : [];
  const spelledMaterial = adjectives.some((a) => {
    const d = dict.lookup(a)?.def;
    return isMaterial(d) || d?.set.material !== undefined;
  });
  if (spelledMaterial) return { station: at.word, used: null, states };
  const used = carried.findIndex((n) => worksAt(dict, at.crafts, n));
  if (used < 0) return { station: at.word, used: null, states };
  return { station: at.word, used, states: [...states, carried[used]!] };
}

/** A station's line for a card. */
export function craftText(s: Stats): string[] {
  const crafts = craftsOf(s);
  if (!crafts.length) return [];
  return [`crafting station (${crafts.join(", ")}): what you spell within ${CRAFT_RANGE} tiles of it comes out handmade, made of a material you carry that it works`];
}
