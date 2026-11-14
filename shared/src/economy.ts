import type { Dictionary } from "./dictionary.js";
import { ACTION_LETTERS, ACTION_SOURCES, DEED_SOURCES, production } from "./letters.js";
import { parsePhrase, type Letters } from "./phrase.js";
import type { Rng } from "./rng.js";
import { resolve } from "./stats.js";
import { TILE_TYPES } from "./world.js";

/** Letters a person starts a round with. */
export const STARTING_HAND = 8;

/** Letters to fill a hand with after its starter word, by how often words use them (no J, Q, X or Z). */
const FILL = "eeeeeeeeeeeiiiiiiiiaaaaaaaarrrrrrrnnnnnnnttttttoooooosssssslllllccccuuuudddpppmmmhhggyybbffwwkv";

let starters: { dict: Dictionary; words: string[] } | null = null;

/**
 * Words a starting hand is drawn around: short objects you can spell and keep (not terrain,
 * nothing that burns fuel or power) that produce at least one letter the actions do not give,
 * so the first word leads somewhere: DOG (I), FARM (A), MILL (W), LANE (R). Worked out once per
 * dictionary.
 */
export function starterWords(dict: Dictionary): string[] {
  if (starters?.dict === dict) return starters.words;
  const words: string[] = [];
  for (const [word, def] of dict.words) {
    if (def.role !== "noun" || !/^[a-z]{2,5}$/.test(word) || /[jqxz]/.test(word)) continue;
    let p;
    try { p = parsePhrase(dict, word); } catch { continue; }
    const s = p.stats;
    if (p.kind !== "object" || p.plural || p.count !== 1 || TILE_TYPES[String(s.get("tile_type"))] !== undefined) continue;
    if (s.num("upkeep_fuel") > 0 || s.num("upkeep_power") > 0) continue;
    const makes = Object.entries(production(s)).filter(([ch, rate]) => !ACTION_LETTERS.includes(ch) && rate >= 0.2);
    if (makes.length) words.push(word);
  }
  words.sort();
  starters = { dict, words };
  return words;
}

/**
 * A starting hand of STARTING_HAND letters: one starter word's letters (`starterWords`), the
 * rest drawn by how common each letter is. So every hand can spell at least one producer.
 */
export function starterHand(dict: Dictionary, rng: Rng): Letters {
  const words = starterWords(dict);
  const word = words[Math.floor(rng() * words.length)] ?? "";
  const hand: Letters = {};
  const add = (ch: string) => { hand[ch] = (hand[ch] ?? 0) + 1; };
  for (const ch of word) add(ch);
  for (let i = word.length; i < STARTING_HAND; i++) add(FILL[Math.floor(rng() * FILL.length)]!);
  return hand;
}

/** How a letter is first reached: an action, a deed, or a word that produces it. */
export interface Route {
  letter: string;
  /** 0 for actions; otherwise one more than the deepest letter the word needs. */
  depth: number;
  /** "action", "deed", "produces" (a word's produce_*) or "burns" (a word that deals fire damage). */
  how: "action" | "deed" | "produces" | "burns";
  /** The word, for "produces" and "burns". */
  word: string;
  /** Words to spell in order, from the actions, to reach it. */
  chain: string[];
  /** How the action letter or deed is had. */
  note: string;
}

/**
 * Walks the dictionary from the action letters: any word spelled only from reached letters
 * reaches what it produces (`produce_*`), and a word that deals fire damage reaches F (things it
 * destroys burn). V needs nothing but a fight with someone's things. Returns how each letter is
 * first reached, by the fewest steps, and the letters nothing reaches yet.
 */
export function reachability(dict: Dictionary): { routes: Map<string, Route>; unreached: string[] } {
  const routes = new Map<string, Route>();
  for (const ch of ACTION_LETTERS) routes.set(ch, { letter: ch, depth: 0, how: "action", word: "", chain: [], note: ACTION_SOURCES[ch]! });
  routes.set("v", { letter: "v", depth: 0, how: "deed", word: "", chain: [], note: DEED_SOURCES.v! });
  // What each spellable single word gives: its letters and what it produces or burns.
  const words: { word: string; letters: string; gives: [string, Route["how"]][] }[] = [];
  for (const [word, def] of dict.words) {
    if (!/^[a-z]+$/.test(word)) continue;
    let stats;
    try { stats = resolve(dict, word); } catch { continue; }
    const gives: [string, Route["how"]][] = Object.keys(production(stats)).map((ch) => [ch, "produces"]);
    if (stats.num("dmg_fire") > 0) gives.push(["f", "burns"]);
    if (gives.length && def.role !== "adverb") words.push({ word, letters: word, gives });
  }
  for (let depth = 1; ; depth++) {
    const found = new Map<string, Route>();
    for (const w of words) {
      const needs = [...new Set(w.letters)];
      if (!needs.every((ch) => routes.has(ch) && routes.get(ch)!.depth < depth)) continue;
      for (const [ch, how] of w.gives) {
        if (routes.has(ch) || found.has(ch)) continue;
        const chain: string[] = [];
        for (const n of needs) for (const c of routes.get(n)!.chain) if (!chain.includes(c)) chain.push(c);
        chain.push(w.word);
        found.set(ch, { letter: ch, depth, how, word: w.word, chain, note: how === "burns" ? `things ${w.word.toUpperCase()} destroys burn` : `${w.word.toUpperCase()} produces it` });
      }
    }
    if (!found.size) break;
    for (const [ch, r] of found) routes.set(ch, r);
  }
  const unreached = [..."abcdefghijklmnopqrstuvwxyz"].filter((ch) => !routes.has(ch));
  return { routes, unreached };
}

/** The reachability table as text, one letter a line, for the test log and the docs. */
export function reachTable(dict: Dictionary): string {
  const { routes, unreached } = reachability(dict);
  const lines = [...routes.values()].sort((a, b) => a.depth - b.depth || a.letter.localeCompare(b.letter)).map((r) =>
    `${r.letter.toUpperCase()}  ${r.depth}  ${r.how.padEnd(8)} ${r.chain.length ? r.chain.map((w) => w.toUpperCase()).join(" > ") : "-"}  (${r.note})`);
  if (unreached.length) lines.push(`pending: ${unreached.join(" ").toUpperCase()}`);
  return lines.join("\n");
}
