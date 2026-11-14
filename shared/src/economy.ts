import type { Dictionary } from "./dictionary.js";
import { ACTION_LETTERS, ACTION_SOURCES, DEED_SOURCES, TRANSMUTE_RATIO } from "./letters.js";
import { becomes } from "./inspect.js";
import { producerOf } from "./produce.js";
import { parsePhrase, type Letters } from "./phrase.js";
import type { Rng } from "./rng.js";
import { TILE_TYPES } from "./world.js";

/** Letters a person starts a round with. */
export const STARTING_HAND = 8;

/** Letters to fill a hand with after its starter word, by how often words use them (no J, Q, X or Z). */
const FILL = "eeeeeeeeeeeiiiiiiiiaaaaaaaarrrrrrrnnnnnnnttttttoooooosssssslllllccccuuuudddpppmmmhhggyybbffwwkv";

let starters: { dict: Dictionary; words: string[] } | null = null;

/**
 * Words a starting hand is drawn around: short objects you can spell and keep that produce at
 * least one letter the actions do not give, and can do so with nothing else built first: no
 * fuel or power, no claimed ground, no letters used up, no running water; tilled land only if
 * the word tills its own. So the first word leads somewhere: HOE (A), DOG (I), MILL (W), KILN (C).
 * Worked out once per dictionary.
 */
export function starterWords(dict: Dictionary): string[] {
  if (starters?.dict === dict) return starters.words;
  const words: string[] = [];
  for (const [word, def] of dict.words) {
    if (def.role !== "noun" || !/^[a-z]{2,5}$/.test(word) || /[jqxz]/.test(word)) continue;
    let p;
    try { p = parsePhrase(dict, word); } catch { continue; }
    const s = p.stats;
    const tile = String(s.get("tile_type"));
    if (p.kind !== "object" || p.plural || p.count !== 1 || (TILE_TYPES[tile] !== undefined && tile !== "tilled")) continue;
    if (s.num("upkeep_fuel") > 0 || s.num("upkeep_power") > 0) continue;
    const spec = producerOf(s);
    if (spec.uses.length || spec.needs.some((n) => n === "claim" || n === "flow" || (n === "tilled" && tile !== "tilled"))) continue;
    const makes = Object.entries(spec.rates).filter(([ch, rate]) => !ACTION_LETTERS.includes(ch) && rate >= 0.2);
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

/** How a letter is first reached: an action, a deed, or a word that makes it. */
export interface Route {
  letter: string;
  /** 0 for actions; otherwise one more than the deepest letter the word needs. */
  depth: number;
  /**
   * "action", "deed", "produces" (a producer: `produce_*` with its needs met), "burns" (a word
   * that deals fire damage), "ages" (anything left on the ground yields Y), "claims" (claimed
   * ground: L, and S where it takes a city), "lays road" (R) or "transmutes" (Z).
   */
  how: "action" | "deed" | "produces" | "burns" | "ages" | "claims" | "lays road" | "transmutes";
  /** The word, for a word's route. */
  word: string;
  /** Words to spell in order, from the actions, to reach it. */
  chain: string[];
  /** How the action letter or deed is had. */
  note: string;
}

/** Letters a later part of the economy gives that no word reaches yet: none once they are built. */
export const PENDING_SOURCES = "lrsz";

/**
 * Walks the dictionary from the action letters: any word spelled only from reached letters
 * reaches what it makes, if what it needs is reached too: a crop needs tilled land (a word that
 * tills), furniture claimed ground (a word that claims), a machine or kiln the letters it uses
 * up. A word that deals fire damage reaches F, anything left on the ground Y (it ages), a claim
 * L and S, a road R; V needs nothing but a fight with someone's things. Returns how each letter
 * is first reached, by the fewest steps, and the letters nothing reaches yet.
 */
export function reachability(dict: Dictionary, pending = PENDING_SOURCES): { routes: Map<string, Route>; unreached: string[] } {
  const routes = new Map<string, Route>();
  for (const ch of ACTION_LETTERS) routes.set(ch, { letter: ch, depth: 0, how: "action", word: "", chain: [], note: ACTION_SOURCES[ch]! });
  routes.set("v", { letter: "v", depth: 0, how: "deed", word: "", chain: [], note: DEED_SOURCES.v! });
  type Gift = { ch: string; how: Route["how"]; needs: string[] };
  // What each spellable single word gives: its letters and what it makes, and what that needs.
  const words: { word: string; letters: string; gives: Gift[]; tills: boolean; claims: boolean }[] = [];
  for (const [word, def] of dict.words) {
    if (!/^[a-z]+$/.test(word) || def.role === "adverb") continue;
    let p;
    try { p = parsePhrase(dict, word); } catch { continue; }
    const stats = p.stats;
    const object = p.kind === "object";
    const tile = String(stats.get("tile_type"));
    const tills = object && tile === "tilled";
    const claims = object && stats.num("claim_radius") > 0;
    const gives: Gift[] = [];
    if (object) {
      const spec = producerOf(stats);
      const needs = [...spec.uses.map((u) => (u === "vowel" ? "e" : u)), ...(spec.needs.includes("tilled") && !tills ? ["tilled"] : []), ...(spec.needs.includes("claim") ? ["claim"] : [])];
      for (const ch of Object.keys(spec.rates)) gives.push({ ch, how: "produces", needs });
      if (becomes(stats) === "ground" || becomes(stats) === "terrain") gives.push({ ch: "y", how: "ages", needs: [] });
      if (claims && !pending.includes("l")) gives.push({ ch: "l", how: "claims", needs: [] }, { ch: "s", how: "claims", needs: [] });
      if (tile === "road" && !pending.includes("r")) gives.push({ ch: "r", how: "lays road", needs: [] });
    }
    if (stats.num("dmg_fire") > 0) gives.push({ ch: "f", how: "burns", needs: [] });
    if (gives.length) words.push({ word, letters: word, gives, tills, claims });
  }
  // Tilled land and claimed ground, once some word reached makes them, by its route.
  let tilled: Route | null = null, claimed: Route | null = null;
  for (let depth = 1; ; depth++) {
    const found = new Map<string, Route>();
    let newTill: Route | null = null, newClaim: Route | null = null;
    for (const w of words) {
      const needs = [...new Set(w.letters)];
      if (!needs.every((ch) => routes.has(ch) && routes.get(ch)!.depth < depth)) continue;
      const chain: string[] = [];
      for (const n of needs) for (const c of routes.get(n)!.chain) if (!chain.includes(c)) chain.push(c);
      for (const g of w.gives) {
        if (routes.has(g.ch) || found.has(g.ch)) continue;
        const extra: string[] = [];
        let ok = true;
        for (const n of g.needs) {
          const r = n === "tilled" ? tilled : n === "claim" ? claimed : routes.get(n) ?? null;
          if (!r || r.depth >= depth) { ok = false; break; }
          extra.push(...r.chain);
        }
        if (!ok) continue;
        const full = [...new Set([...extra, ...chain])];
        full.push(w.word);
        const note = g.how === "burns" ? `things ${w.word.toUpperCase()} destroys burn`
          : g.how === "ages" ? `${w.word.toUpperCase()} ages on the ground`
          : g.how === "claims" ? `${w.word.toUpperCase()} claims ground${g.ch === "s" ? " (around a city's middle)" : ""}`
          : g.how === "lays road" ? `${w.word.toUpperCase()} lays road` : `${w.word.toUpperCase()} makes it`;
        found.set(g.ch, { letter: g.ch, depth, how: g.how, word: w.word, chain: full, note });
      }
      const self = { letter: "", depth, how: "produces" as const, word: w.word, chain: [...chain, w.word], note: "" };
      if (w.tills && !tilled && !newTill) newTill = self;
      if (w.claims && !claimed && !newClaim) newClaim = self;
    }
    if (!found.size && !newTill && !newClaim) break;
    for (const [ch, r] of found) routes.set(ch, r);
    tilled ??= newTill;
    claimed ??= newClaim;
  }
  if (!pending.includes("z") && routes.has("e")) {
    routes.set("z", { letter: "z", depth: 1, how: "transmutes", word: "", chain: [], note: `transmuting ${TRANSMUTE_RATIO} common letters, or a roaming boss` });
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
