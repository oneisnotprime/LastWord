import type { Dictionary } from "./dictionary.js";
import { resolve, Stats } from "./stats.js";

/** Letters a player holds: letter -> count. */
export type Letters = Record<string, number>;

export interface Phrase {
  /**
   * What spelling it does: makes an object, casts a verb on the speller, sets off an event on a
   * target, or changes the sky and weather.
   */
  kind: "object" | "verb" | "event" | "sky" | "field";
  noun: string;
  adjectives: string[];
  /** Every letter the phrase costs, in order, lower case. */
  letters: string;
  stats: Stats;
}

/**
 * Reads what a player typed, such as "bigger sword": adjectives first, noun last.
 * Throws an Error with a message fit to show the player.
 */
export function parsePhrase(dict: Dictionary, text: string): Phrase {
  const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) throw new Error("Spell something");
  for (const w of words) {
    if (!/^[a-z]+$/.test(w)) throw new Error(`${w} is not a word`);
    if (!dict.lookup(w)) throw new Error(`${w.toUpperCase()} is not in the dictionary yet`);
  }
  const noun = words[words.length - 1]!;
  const adjectives = words.slice(0, -1);
  const def = dict.lookup(noun)!.def;
  if (def.role === "verb") {
    if (adjectives.length) throw new Error(`${noun.toUpperCase()} is something you do; spell it on its own`);
    const stats = new Stats(dict);
    for (const [id, value] of Object.entries(def.set)) stats.set(id, value);
    return { kind: "verb", noun, adjectives, letters: noun, stats };
  }
  if (def.role !== "noun") throw new Error(`${noun.toUpperCase()} is not a thing; end with a noun`);
  const stats = resolve(dict, noun, adjectives);
  const placement = stats.get("placement");
  const kind = def.class === "event" ? "event" : kindOf(stats, def.class);
  return { kind, noun, adjectives, letters: words.join(""), stats };
}

/** Classes whose words are things in the world, not states or feelings. */
const PHYSICAL = new Set(["artifact", "creature", "person", "flora", "material", "consumable", "bodypart"]);

/**
 * Sky words change daylight or weather. Field words are auras and conditions that act on
 * whoever is inside them (LOVE, FEAR, CHAOS, HEAVEN, a PLANET's gravity). Anything else is an object.
 */
function kindOf(stats: Stats, cls: string): Phrase["kind"] {
  const placement = stats.get("placement");
  const overhead = placement === "sky" || placement === "region" || placement === "map";
  const changesSky = stats.get("sets_daylight") !== "none" || stats.get("sets_weather") !== "" || stats.tags("clears_weather").length > 0;
  if (overhead && changesSky) return "sky";
  const reaches = stats.num("field_radius") > 0;
  if (PHYSICAL.has(cls)) return "object"; // a GOD in the sky is still a creature that fights for you
  if (stats.get("tile_type") !== "none") return "object"; // RIVER and CANYON reshape the land
  if (overhead || (reaches && cls !== "terrain")) return "field";
  return "object";
}

/** Letters the player lacks for a spelling, as a string such as "ss" for two missing S. */
export function missing(held: Letters, letters: string): string {
  const need: Letters = {};
  for (const ch of letters) need[ch] = (need[ch] ?? 0) + 1;
  return Object.entries(need)
    .map(([ch, n]) => ch.repeat(Math.max(0, n - (held[ch] ?? 0))))
    .join("");
}

/** Removes a spelling's letters from the player's hand. Call only when nothing is missing. */
export function spend(held: Letters, letters: string): void {
  for (const ch of letters) held[ch] = (held[ch] ?? 0) - 1;
}
