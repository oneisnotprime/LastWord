import type { Dictionary } from "./dictionary.js";
import type { Rng } from "./rng.js";
import type { Stats } from "./stats.js";
import type { Op } from "./types.js";

/**
 * Abstract ideas (dictionary theme 25): meta words that bend the rules through shared systems.
 * - `luck` shifts every roll its holder makes: each point is LUCK_POINT more (or less) chance to
 *   find something gathering, to hit, to land a critical and to dodge (`luckOps`).
 * - The `chaos` status multiplies a handful of a body's properties by random amounts (`chaosOps`).
 * - The `void` status (NOTHING) makes everything a body carries, wears, rides or stands in do
 *   nothing, and its own damage and flight nothing (status.ts).
 * - The `doom` status (FATE) seals an outcome: when it runs out the body takes DOOM_SHARE of its
 *   full integrity, which nothing resists.
 * - `swaps_owners` (PARADOX): a thing someone else owns and the speller's most valuable trade owners.
 * - `misspells` (TYPO): a thing becomes the word one letter off (`typoOf`), or breaks, unless
 *   something of its owner's side that `spellchecks` (a DICTIONARY) is close by (`spellchecked`).
 * - `stands_for` (WORD, LETTER, BOOK): spelled before another word it stands for it, and its own
 *   letters are paid instead (`standIn`): a length (WORD: any four-letter word) or an archetype
 *   (BOOK: any document).
 */

/** Chance each point of luck adds to a roll. */
export const LUCK_POINT = 0.03;

/** What luck does to a body's rolls in combat: aim, criticals and dodging. */
export function luckOps(luck: number): Op[] {
  if (!luck || !Number.isFinite(luck)) return [];
  return [["accuracy", "add", luck * LUCK_POINT], ["critical", "add", luck * LUCK_POINT], ["evasion", "add", luck * LUCK_POINT * 0.7]];
}

/** Properties chaos may scramble. */
export const CHAOS_PROPS = ["speed_land", "speed_air", "attack_rate", "armor", "accuracy", "strength", "sight_range", "evasion", "regeneration", "critical", "stealth", "luck"] as const;
/** What each scrambled property may be multiplied by. */
export const CHAOS_FACTORS = [0.25, 0.5, 0.75, 1.5, 2, 3] as const;
/** How many properties chaos scrambles. */
export const CHAOS_COUNT = 4;

/** CHAOS_COUNT different properties, each multiplied by a random factor. */
export function chaosOps(rng: Rng): Op[] {
  const pool: string[] = [...CHAOS_PROPS], out: Op[] = [];
  for (let i = 0; i < CHAOS_COUNT && pool.length; i++) {
    const id = pool.splice(Math.floor(rng() * pool.length), 1)[0]!;
    out.push([id, "mul", CHAOS_FACTORS[Math.floor(rng() * CHAOS_FACTORS.length)]!]);
  }
  return out;
}

/** Share of full integrity a sealed fate takes when it runs out. */
export const DOOM_SHARE = 0.75;
export const doomDamage = (fullIntegrity: number): number => Math.max(0, fullIntegrity) * DOOM_SHARE;

/** Classes a typo may turn a thing into: other things in the world. */
const TYPO_CLASSES = new Set(["artifact", "creature", "flora", "material", "consumable", "person", "bodypart"]);

/**
 * The words one letter off a noun (one letter changed, none added or taken) that are things in
 * the world, in order; one is picked with `rng`, or null if there is none (it breaks instead).
 */
export function typoOf(dict: Dictionary, noun: string, rng: Rng): string | null {
  const word = noun.toLowerCase(), out: string[] = [];
  for (let i = 0; i < word.length; i++) {
    for (let c = 97; c <= 122; c++) {
      const ch = String.fromCharCode(c);
      if (ch === word[i]) continue;
      const w = word.slice(0, i) + ch + word.slice(i + 1);
      const def = dict.word(w);
      if (def && def.role === "noun" && TYPO_CLASSES.has(def.class)) out.push(w);
    }
  }
  return out.length ? out[Math.floor(rng() * out.length)]! : null;
}

/** True if a thing `tiles` away from something that `spellchecks` that many metres (and tiles of `metresPerTile`) is safe from typos. */
export function spellchecked(spellchecks: number, tiles: number, metresPerTile: number): boolean {
  return spellchecks > 0 && tiles * metresPerTile <= spellchecks;
}

/** What a word with `stands_for` stands for: any word of a length, or any of an archetype. */
export function standsFor(value: unknown): { length: number } | { archetype: string } | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (Number.isInteger(n) && n > 0) return { length: n };
  return typeof value === "string" ? { archetype: value } : null;
}

/**
 * A spelling of a stand-in followed by one word it stands for ("word wolf", "book map"): the
 * stand-in, the word spelled, and the letters paid (the stand-in's). Null if the spelling is not
 * one, or the word does not fit (wrong length or kind, the same word, not in the dictionary).
 */
export function standIn(dict: Dictionary, text: string): { stand: string; word: string; letters: string } | null {
  const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length !== 2) return null;
  const [stand, word] = words as [string, string];
  const def = dict.word(stand);
  const rule = def ? standsFor(def.set.stands_for) : null;
  if (!rule || stand === word || !/^[a-z]+$/.test(word)) return null;
  const other = dict.word(word);
  if (!other) return null;
  if ("length" in rule ? word.length !== rule.length : other.archetype !== rule.archetype) return null;
  return { stand, word, letters: stand };
}

/** What a meta word does, in short lines for its card. */
export function ideaText(s: Stats): string[] {
  const out: string[] = [];
  const luck = s.num("luck");
  if (luck && Number.isFinite(luck)) out.push(`luck ${luck > 0 ? "+" : "−"}${Math.round(Math.abs(luck) * LUCK_POINT * 100)}% on every roll`);
  if (s.num("inflict_chaos") > 0) out.push("chaos: random properties");
  if (s.num("inflict_void") > 0) out.push("void: everything carried and worn does nothing");
  if (s.num("inflict_doom") > 0) out.push(`doom: ${Math.round(DOOM_SHARE * 100)}% of full health when it runs out`);
  if (s.flag("swaps_owners")) out.push("swaps the owners of a thing and your most valuable");
  if (s.flag("misspells")) out.push("turns a thing into the word one letter off, or breaks it");
  if (s.num("spellchecks") > 0) out.push(`no typo touches your things within ${Math.round(s.num("spellchecks"))} m`);
  const stands = standsFor(s.get("stands_for"));
  if (stands) out.push("length" in stands ? `before any ${stands.length}-letter word: spells it for these letters` : `before any ${stands.archetype}: spells it for these letters`);
  return out;
}
