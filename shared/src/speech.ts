import type { Dictionary } from "./dictionary.js";
import type { Letters } from "./phrase.js";
import type { Stats } from "./stats.js";
import type { Value } from "./types.js";

/**
 * Spelling rules (concept "language is the battlefield"): what a spelling costs and which
 * letters it may use. Any word can carry them as its own values, and its kind decides whom they
 * bind (server: an area binds whoever it reaches, an act passed on a person binds them, a verb its
 * speller, a thing its owner):
 *
 * - `ban_letters`: letters that cannot be spelled with (letters, "vowels", or "top": each one's
 *   commonest held letter). Blanks do not cover a banned letter.
 * - `spell_cost`: letters a spelling costs, times this. Over 1, extra copies of the word's own
 *   letters (round(length × (cost − 1)), the word's letters in order); under 1, the rarest letters
 *   are free (floor(length × (1 − cost))).
 * - `word_limit`: the longest word that may be spelled.
 * - `wild_letters`: blanks, any letter not banned, for each spelling.
 * - `double_letters`: each such letter held pays for two copies.
 * - `misspell_ok`: a word one letter off (wrong, missing, extra) reads as the real word.
 * - `free_speech`: rules laid by others (hindering ones) do not bind.
 */
export interface SpeechRule {
  ban: string;
  cost: number;
  limit: number;
  wild: number;
  double: string;
  typos: number;
  free: boolean;
}

/** In force on one speller: the rules combined and the words they came from. */
export interface SpeechRules {
  banned: string[];
  cost: number;
  limit: number;
  wild: number;
  doubled: string[];
  typos: number;
  free: boolean;
  /** The words binding them, for the spell window ("CENSORSHIP bans E"). */
  by: string[];
  /** The words that ban letters and that limit words, for the reasons a spelling is refused. */
  banBy?: string[];
  limitBy?: string[];
}

export const SPEECH_PROPS = ["ban_letters", "spell_cost", "word_limit", "wild_letters", "double_letters", "misspell_ok", "free_speech"] as const;

const VOWELS = "aeiou";
const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
/** Commonest English letters first: the free letters of a cost under 1 are taken from the end. */
const BY_FREQUENCY = "etaoinshrdlcumwfgypbvkjxqz";

/** The spelling rule a word carries as its own values, or null if it carries none. */
export function speechOf(s: Stats): SpeechRule | null {
  const num = (p: string, d: number) => { const n = s.num(p); return Number.isFinite(n) ? n : d; };
  const r: SpeechRule = {
    ban: String(s.get("ban_letters") ?? "").toLowerCase(),
    cost: Math.max(0, num("spell_cost", 1)),
    limit: Math.max(0, Math.floor(num("word_limit", 0))),
    wild: Math.max(0, Math.floor(num("wild_letters", 0))),
    double: String(s.get("double_letters") ?? "").toLowerCase(),
    typos: Math.max(0, Math.floor(num("misspell_ok", 0))),
    free: s.flag("free_speech"),
  };
  return r.ban || r.cost !== 1 || r.limit > 0 || r.wild > 0 || r.double || r.typos > 0 || r.free ? r : null;
}

/** The same from a plain record of values (a buff's `set`). */
export function speechFromSet(set: Record<string, Value>): SpeechRule | null {
  if (!SPEECH_PROPS.some((p) => p in set)) return null;
  const n = (p: string, d: number) => (typeof set[p] === "number" ? (set[p] as number) : d);
  return {
    ban: typeof set.ban_letters === "string" ? set.ban_letters.toLowerCase() : "",
    cost: Math.max(0, n("spell_cost", 1)),
    limit: Math.max(0, Math.floor(n("word_limit", 0))),
    wild: Math.max(0, Math.floor(n("wild_letters", 0))),
    double: typeof set.double_letters === "string" ? set.double_letters.toLowerCase() : "",
    typos: Math.max(0, Math.floor(n("misspell_ok", 0))),
    free: set.free_speech === true,
  };
}

/** A rule as values for a buff's `set`. */
export function speechSet(r: SpeechRule): Record<string, Value> {
  const out: Record<string, Value> = {};
  if (r.ban) out.ban_letters = r.ban;
  if (r.cost !== 1) out.spell_cost = r.cost;
  if (r.limit) out.word_limit = r.limit;
  if (r.wild) out.wild_letters = r.wild;
  if (r.double) out.double_letters = r.double;
  if (r.typos) out.misspell_ok = r.typos;
  if (r.free) out.free_speech = true;
  return out;
}

/** True if a rule only helps whoever it binds (blanks, doubles, cheaper, typos, free speech). */
export function helpful(r: SpeechRule): boolean {
  return !r.ban && r.cost <= 1 && !r.limit;
}

/** Letters a `ban_letters` or `double_letters` value names, for someone holding `held`. */
export function lettersOf(value: string, held: Letters = {}): string[] {
  const v = value.toLowerCase().trim();
  if (!v) return [];
  if (v === "all") return [...ALPHABET];
  if (v === "vowels") return [...VOWELS];
  if (v === "consonants") return [...ALPHABET].filter((c) => !VOWELS.includes(c));
  if (v === "top") {
    // Their commonest held letter (ties: the commonest in English).
    let best = "", most = 0;
    for (const ch of BY_FREQUENCY) if ((held[ch] ?? 0) > most) { best = ch; most = held[ch]!; }
    return best ? [best] : ["e"];
  }
  return [...new Set([...v].filter((c) => ALPHABET.includes(c)))];
}

/**
 * The rules binding one speller, from the parts in force on them. `mine` parts are their own
 * (what they own, verbs they cast); others' hindering parts are ignored under `free_speech`.
 */
export function combineSpeech(parts: readonly { word: string; rule: SpeechRule; mine: boolean }[], held: Letters = {}): SpeechRules {
  const free = parts.some((p) => p.rule.free);
  const out: SpeechRules = { banned: [], cost: 1, limit: 0, wild: 0, doubled: [], typos: 0, free, by: [] };
  const banned = new Set<string>(), doubled = new Set<string>();
  for (const { word, rule, mine } of parts) {
    const binds = mine || !free;
    let used = false;
    if (rule.ban && binds) { for (const c of lettersOf(rule.ban, held)) banned.add(c); used = true; (out.banBy ??= []).push(word.toUpperCase()); }
    if (rule.cost !== 1 && (rule.cost < 1 || binds)) { out.cost *= rule.cost; used = true; }
    if (rule.limit > 0 && binds) { out.limit = out.limit ? Math.min(out.limit, rule.limit) : rule.limit; used = true; (out.limitBy ??= []).push(word.toUpperCase()); }
    if (rule.wild > 0) { out.wild += rule.wild; used = true; }
    if (rule.double) { for (const c of lettersOf(rule.double, held)) doubled.add(c); used = true; }
    if (rule.typos > 0) { out.typos = Math.max(out.typos, rule.typos); used = true; }
    if (rule.free) used = true;
    if (used && !out.by.includes(word.toUpperCase())) out.by.push(word.toUpperCase());
  }
  out.banned = [...banned].sort();
  out.doubled = [...doubled].sort();
  return out;
}

export const NO_RULES: SpeechRules = { banned: [], cost: 1, limit: 0, wild: 0, doubled: [], typos: 0, free: false, by: [] };

/** True if nothing binds the speller. */
export const unbound = (r: SpeechRules): boolean =>
  !r.banned.length && r.cost === 1 && !r.limit && !r.wild && !r.doubled.length && !r.typos;

/**
 * What a spelling costs under the rules: `pay` the letters spent (blanks not included), `wild` the
 * blanks used, `extra` the letters a cost over 1 adds, `free` those a cost under 1 waives, and the
 * `problem` if it cannot be spelled (a banned letter, a word too long, letters missing).
 */
export interface Price { pay: string; wild: number; extra: string; free: string; missing: string; problem: string | null }

export function priceOf(letters: string, words: readonly string[], rules: SpeechRules, held: Letters): Price {
  const out: Price = { pay: "", wild: 0, extra: "", free: "", missing: "", problem: null };
  const hit = [...new Set([...letters].filter((c) => rules.banned.includes(c)))];
  if (hit.length) {
    const by = rules.banBy ?? rules.by;
    out.problem = `${hit.join(" ").toUpperCase()} ${hit.length === 1 ? "is" : "are"} banned${by.length ? ` (${by.join(", ")})` : ""}`;
    return out;
  }
  const long = words.find((w) => rules.limit > 0 && w.replace(/[^a-z]/g, "").length > rules.limit);
  if (long) {
    const by = rules.limitBy ?? rules.by;
    out.problem = `${long.toUpperCase()} is too long: ${rules.limit} letters at most${by.length ? ` (${by.join(", ")})` : ""}`;
    return out;
  }
  let need = [...letters];
  if (rules.cost > 1) {
    const n = Math.round(letters.length * (rules.cost - 1));
    for (let i = 0; i < n && letters.length; i++) out.extra += letters[i % letters.length];
    need = need.concat([...out.extra]);
  } else if (rules.cost < 1) {
    const n = Math.min(letters.length, Math.floor(letters.length * (1 - rules.cost)));
    const rarest = [...need].sort((a, b) => BY_FREQUENCY.indexOf(b) - BY_FREQUENCY.indexOf(a)).slice(0, n);
    for (const c of rarest) { need.splice(need.indexOf(c), 1); out.free += c; }
  }
  const counts: Letters = {};
  for (const c of need) counts[c] = (counts[c] ?? 0) + 1;
  // A doubled letter held pays for two copies.
  for (const c of rules.doubled) if (counts[c]) counts[c] = Math.ceil(counts[c] / 2);
  let lacking = "";
  for (const [c, n] of Object.entries(counts)) {
    const have = Math.max(0, held[c] ?? 0);
    out.pay += c.repeat(Math.min(n, have));
    if (n > have) lacking += c.repeat(n - have);
  }
  out.wild = Math.min(rules.wild, lacking.length);
  out.missing = lacking.slice(out.wild);
  if (out.missing) out.problem = `You need ${out.missing.toUpperCase().split("").join(" ")}`;
  return out;
}

/**
 * A word one letter off a real one, read as the real word (`misspell_ok`): a letter wrong, missing
 * or extra. Returns the spelling with each unknown word put right, or null if it cannot be read.
 * Words are tried in a fixed order (a letter put back, then changed, then taken out; a to z).
 */
export function readMisspelt(dict: Dictionary, text: string): { text: string; fixed: [string, string][] } | null {
  const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const fixed: [string, string][] = [];
  const known = (w: string) => !!dict.word(w) || !!dict.word(w.replace(/s$/, "")) || !!dict.word(w.replace(/es$/, ""));
  const out = words.map((w) => {
    if (!/^[a-z]+$/.test(w) || known(w)) return w;
    const tries: string[] = [];
    for (let i = 0; i <= w.length; i++) for (const c of ALPHABET) tries.push(w.slice(0, i) + c + w.slice(i));
    for (let i = 0; i < w.length; i++) for (const c of ALPHABET) if (c !== w[i]) tries.push(w.slice(0, i) + c + w.slice(i + 1));
    for (let i = 0; i < w.length; i++) tries.push(w.slice(0, i) + w.slice(i + 1));
    const hit = tries.find((t) => t.length > 1 && dict.word(t));
    if (hit) fixed.push([w, hit]);
    return hit ?? w;
  });
  return fixed.length ? { text: out.join(" "), fixed } : null;
}

/** What a word's spelling rule does, in short lines for its card. */
export function speechText(r: SpeechRule | null): string[] {
  if (!r) return [];
  const out: string[] = [];
  if (r.ban) out.push(`bans ${r.ban === "top" ? "their commonest letter" : r.ban === "vowels" ? "vowels" : r.ban.toUpperCase().split("").join(" ")}`);
  if (r.cost > 1) out.push(`spelling costs ×${+r.cost.toFixed(2)}`);
  if (r.cost < 1) out.push(`spelling costs ×${+r.cost.toFixed(2)}: the rarest letters free`);
  if (r.limit) out.push(`words of ${r.limit} letters at most`);
  if (r.wild) out.push(`${r.wild} blank${r.wild === 1 ? "" : "s"} in every word`);
  if (r.double) out.push(`${r.double === "all" ? "every letter" : r.double === "vowels" ? "vowels" : r.double.toUpperCase()} count double`);
  if (r.typos) out.push("a letter off still reads");
  if (r.free) out.push("free speech: others' spelling rules do not bind");
  return out;
}

/** What binds a speller now, in short lines for the spell window. */
export function rulesLines(r: SpeechRules): string[] {
  const out: string[] = [];
  if (r.banned.length) out.push(`banned ${r.banned.join("").toUpperCase()}`);
  if (r.cost !== 1) out.push(`cost ×${+r.cost.toFixed(2)}`);
  if (r.limit) out.push(`max ${r.limit} letters`);
  if (r.wild) out.push(`${r.wild} blank${r.wild === 1 ? "" : "s"}`);
  if (r.doubled.length) out.push(`${r.doubled.length === 26 ? "all" : r.doubled.join("").toUpperCase()} ×2`);
  if (r.typos) out.push("typos ok");
  return out;
}
