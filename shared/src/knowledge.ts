import type { Dictionary } from "./dictionary.js";
import type { Letters } from "./phrase.js";
import type { Stats } from "./stats.js";
import { bestWords } from "./tips.js";
import { countersOf } from "./inspect.js";

/**
 * Knowledge (concept: what you know about words and others). One shared quantity, `insight`: the
 * most `read_properties` of your body (fields you stand in, verbs in force, worn things and
 * statuses act on it: LIBRARY +3, IGNORANCE −4, AMNESIA nothing) and of anything you carry. Your
 * creatures read for you too, in their own sight (a SPY of yours, an ORACLE).
 *
 * - `KNOWS.counters` (2): the spell preview and word cards show the words that end a word
 *   (shared `countersOf`): BOOK, SCHOOL, a TEACHER.
 * - `KNOWS.racks` (5): the intel panel lists the letters and gear of people in sight: SPY,
 *   ESPIONAGE, a LIBRARY's field: within the reader's sight, or READ_TILES if that is shorter.
 * - `KNOWS.oracle` (8): and what each can spell now (shared `bestWords` on their rack): ORACLE,
 *   SEER, PROPHET, TRUTH.
 * - Hiding: `immune_expose` (CIPHER, ENCRYPTION) keeps you off anyone's intel. Falsifying: a reader
 *   fooled by lies (signal.ts `fooledByDecoys`: PROPAGANDA, RUMOR, LIE reach them) reads made-up
 *   racks and words (`falseRack`), and cannot tell.
 */

/** Insight from which each kind of knowledge comes. */
export const KNOWS = { counters: 2, racks: 5, oracle: 8 } as const;
/** Tiles within which a reader reads people even if its own sight is shorter (a creature's 10 m). */
export const READ_TILES = 20;
/** People the intel panel lists at most, nearest first. */
export const INTEL_MAX = 4;
/** Counter-words shown at most on a preview. */
export const COUNTERS_SHOWN = 3;

/** Insight: the most `read_properties` of a body and of the things it carries (each thing's own value). */
export function insightOf(body: Stats, carried: readonly Stats[] = []): number {
  let best = body.num("read_properties");
  for (const s of carried) {
    const own = s.num("read_properties");
    if (own > best) best = own;
  }
  return Number.isFinite(best) ? Math.max(0, best) : 10;
}

/** What insight shows, as the panels and lines it unlocks. */
export function knows(insight: number): { counters: boolean; racks: boolean; oracle: boolean } {
  return { counters: insight >= KNOWS.counters, racks: insight >= KNOWS.racks, oracle: insight >= KNOWS.oracle };
}

/** The words that end a word, shortest first, at most COUNTERS_SHOWN (only for insight to see). */
export function countersShown(dict: Dictionary, word: string, insight: number): string[] {
  return insight >= KNOWS.counters ? countersOf(dict, word).slice(0, COUNTERS_SHOWN) : [];
}

/** One person on the intel panel. `letters` like "AAEKT"; `words` only for an oracle. */
export interface Intel {
  id: string;
  name: string;
  letters: string;
  gear: string[];
  words?: string[];
}

/** Small stable hash of a string, 0 to 1. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** Letters by everyday frequency, for made-up racks. */
const COMMON = "eeeeeeaaaaarrrriiiioooottttnnnnsssllllcccuuddppmmhhggbbffyywkvxzjq";

/**
 * A made-up rack for someone read through lies: as many letters as they really hold (so the count
 * looks right), drawn from `key` (who reads whom, and the minute), so it holds still for a while.
 */
export function falseRack(real: Letters, key: string): Letters {
  const n = Object.values(real).reduce((a, b) => a + Math.max(0, b), 0);
  const out: Letters = {};
  for (let i = 0; i < n; i++) {
    const ch = COMMON[Math.floor(hash(`${key}:${i}`) * COMMON.length)]!;
    out[ch] = (out[ch] ?? 0) + 1;
  }
  return out;
}

/** A rack as one short string, sorted: "AAEKT", a letter held more than twice with its count: "A9 EE K". */
export const rackText = (letters: Letters): string => {
  const parts = Object.entries(letters).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b))
    .map(([ch, n]) => (n > 2 ? ` ${ch.toUpperCase()}${n} ` : ch.toUpperCase().repeat(n)));
  return parts.join("").replace(/\s+/g, " ").trim();
};

/** What a reader learns of one person at an insight: their rack and gear, and with an oracle's insight the words they could spell. */
export function readPerson(
  dict: Dictionary, insight: number, who: { id: string; name: string; letters: Letters; gear: readonly string[] }, fooledKey: string | null,
): Intel | null {
  if (insight < KNOWS.racks) return null;
  const rack = fooledKey ? falseRack(who.letters, fooledKey) : who.letters;
  const out: Intel = { id: who.id, name: who.name, letters: rackText(rack), gear: fooledKey ? [] : who.gear.map((g) => g.toUpperCase()) };
  if (insight >= KNOWS.oracle) out.words = bestWords(dict, rack, { armed: true, riding: true, income: 5, creatures: 1, health: 1 }, 3).map((b) => b.word.toUpperCase());
  return out;
}

/** Knowledge lines for a card. */
export function knowledgeText(s: Stats, ops: readonly [string, string, number][] = []): string[] {
  const own = s.num("read_properties");
  const add = ops.filter((o) => o[0] === "read_properties").reduce((n, o) => n + (o[1] === "add" ? o[2] : 0), 0);
  const level = Math.max(own, add);
  const out: string[] = [];
  if (level >= KNOWS.oracle) out.push(`insight ${level}: shows counters, the racks of people in sight and what they can spell`);
  else if (level >= KNOWS.racks) out.push(`insight ${level}: shows counters and the racks of people in sight`);
  else if (level >= KNOWS.counters) out.push(`insight ${level}: shows the words that end a word`);
  if (add < 0) out.push(`insight ${add}: knowledge lost`);
  return out;
}
