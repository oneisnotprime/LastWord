import type { Dictionary } from "./dictionary.js";
import { singulars } from "./plural.js";
import { resolve, type Stats } from "./stats.js";
import type { Op, Value } from "./types.js";
import { castVerb } from "./verb.js";

/** Letters a player holds: letter -> count. */
export type Letters = Record<string, number>;

export interface Phrase {
  /**
   * What spelling it does: makes an object, casts a verb on the speller, sets off an event on a
   * target, or changes the sky and weather.
   */
  kind: "object" | "verb" | "event" | "sky" | "field";
  /** The noun or verb, singular: CATS reads as cat. */
  noun: string;
  adjectives: string[];
  /** Adverbs on a verb: QUICKLY in QUICKLY RUN. */
  adverbs: string[];
  /** Spelled as a plural: CATS, WOLVES, MICE. */
  plural: boolean;
  /**
   * How many it makes: `plural_count` for a plural (3 by default). A singular makes exactly one
   * (WOLF is one wolf, ANT one ant), unless it is a collective (archetype group: an ARMY is its
   * `pack_size`) or its adjectives change `pack_size` (TEN WOLF, ACCOMPANIED WOLF). Number words
   * change both: TEN WOLVES is ten.
   */
  count: number;
  /** Every letter the phrase costs, in order, lower case: CATS costs the S. */
  letters: string;
  stats: Stats;
  /** For a verb: what it does to the body it lands on while it lasts. */
  effect?: { set: Record<string, Value>; ops: Op[] };
}

/** Up to this many spawn as separate creatures or things; more are one body with a count (see `massed`). */
export const SEPARATE_UP_TO = 12;

/**
 * What a typed word is as a noun: itself, or the plural of a noun. A plural wins over a word
 * of the same spelling when that word is a noun of the same archetype as its singular (ROADS,
 * LEGS, FALLS are many roads, legs, falls), and loses when it is something else (MEN and PEOPLE
 * are groups with their own data; NEWS is not many NEWs).
 */
export function readNoun(dict: Dictionary, text: string): { word: string; plural: boolean } | undefined {
  const own = dict.lookup(text);
  for (const s of singulars(text)) {
    const single = dict.word(s);
    if (!single || single.role !== "noun") continue;
    if (!own) return { word: s, plural: true };
    if (own.def.role === "noun" && own.def.archetype === single.archetype && own.degree === "positive") return { word: s, plural: true };
  }
  return own ? { word: text, plural: false } : undefined;
}

/**
 * Reads what a player typed: adjectives then a noun ("bigger sword", "ten wolves"), or adverbs
 * then a verb ("quickly run"). Throws an Error with a message fit to show the player.
 */
export function parsePhrase(dict: Dictionary, text: string): Phrase {
  const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) throw new Error("Spell something");
  for (const w of words) {
    if (!/^[a-z]+$/.test(w)) throw new Error(`${w} is not a word`);
    if (!dict.lookup(w) && !readNoun(dict, w)) throw new Error(`${w.toUpperCase()} is not in the dictionary yet`);
  }
  const last = words[words.length - 1]!;
  const modifiers = words.slice(0, -1);
  const letters = words.join("");
  const head = readNoun(dict, last)!;
  const def = dict.word(head.word) ?? dict.lookup(last)!.def;
  const role = (w: string) => dict.lookup(w)?.def.role;
  if (def.role === "adverb") {
    throw new Error(`${last.toUpperCase()} says how you do something: follow it with a verb, as in ${last.toUpperCase()} RUN`);
  }
  if (def.role === "verb") {
    const wrong = modifiers.find((w) => role(w) !== "adverb");
    if (wrong) throw new Error(`${last.toUpperCase()} is something you do; it takes an adverb, not ${wrong.toUpperCase()}`);
    const cast = castVerb(dict, head.word, modifiers);
    return { kind: "verb", noun: head.word, adjectives: [], adverbs: modifiers, plural: false, count: 1, letters, stats: cast.stats, effect: { set: cast.set, ops: cast.ops } };
  }
  if (def.role !== "noun") throw new Error(`${last.toUpperCase()} is not a thing; end with a noun`);
  const adverb = modifiers.find((w) => role(w) === "adverb");
  if (adverb) throw new Error(`${adverb.toUpperCase()} goes with a verb, not with ${last.toUpperCase()}`);
  // A singular is one of the thing: the noun's own pack_size counts only for a collective.
  const solo = !head.plural && def.archetype !== "group" && def.set.pack_size !== undefined;
  const stats = resolve(dict, head.word, modifiers, [], solo ? { pack_size: 1 } : {});
  const kind = def.class === "event" ? "event" : kindOf(stats, def.class);
  if (head.plural && kind !== "object") throw new Error(`${last.toUpperCase()}: only things come in plurals; spell ${head.word.toUpperCase()}`);
  const count = Math.round(stats.num(head.plural ? "plural_count" : "pack_size"));
  return {
    kind, noun: head.word, adjectives: modifiers, adverbs: [], plural: head.plural,
    count: head.plural ? count : Math.max(1, count), letters, stats,
  };
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
