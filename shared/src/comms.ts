import type { Dictionary } from "./dictionary.js";
import { grand } from "./inspect.js";
import { parsePhrase } from "./phrase.js";
import type { Stats } from "./stats.js";
import { earshot } from "./sound.js";

/**
 * Communication (concept: who hears what). Players talk in pings: a mark on the map with one of a
 * few words (`PINGS`). Spelling is said aloud too: everyone in earshot hears "BOT3 spelled SWORD"
 * (grand words still go map-wide as entrances). Words decide who hears:
 *
 * - your side (you, a pact's members) hears your pings anywhere; anyone else only within earshot of
 *   your voice (`voiceOf`: VOICE, or your `loudness` if louder: a MEGAPHONE carries) and their
 *   `hearing_range` (a RADIO, a PHONE, TELEPATHY: `hears`). Spell calls are heard the same way.
 * - the deaf (`deaf`) hear nothing; the gagged and silenced (`unheard`: GAG, MUZZLE, SILENCE) say
 *   nothing: no pings, and their spelling is not called out, grand words included.
 * - lies: a field with `decoys` (RUMOR, LIE, PROPAGANDA, HOAX) also sends those it fools a made-up
 *   call every DECOY_CALL_SECONDS ("BOT2 spelled METEOR", a grand word, `fakeCall`) and a false
 *   DANGER ping; seen through with detect_stealth (signal.ts `fooledByDecoys`).
 */

/** What a ping can say. */
export const PINGS = ["here", "danger", "help", "attack", "run", "trade", "truce"] as const;
export type Ping = (typeof PINGS)[number];
/** How each ping reads on screen. */
export const PING_TEXT: Record<Ping, string> = { here: "HERE", danger: "DANGER", help: "HELP!", attack: "ATTACK", run: "RUN", trade: "TRADE?", truce: "TRUCE?" };
/** Loudness of a voice: earshot VOICE × EARSHOT tiles (40) plus the listener's hearing. */
export const VOICE = 5;
/** Seconds a person must wait between pings. */
export const PING_GAP = 2;
/** Seconds between the made-up calls of each lying field. */
export const DECOY_CALL_SECONDS = 12;

export const isPing = (p: unknown): p is Ping => typeof p === "string" && (PINGS as readonly string[]).includes(p);

/** How loud someone speaks: a voice, or louder with a loud thing (a MEGAPHONE, a HORN). */
export function voiceOf(body: Stats): number {
  const loud = body.num("loudness");
  return Math.max(VOICE, Number.isFinite(loud) ? loud : Infinity);
}

/** Whether a listener hears a speaker `tiles` away: their side always, others within earshot, the deaf never. */
export function hears(listener: { deaf: boolean; hearing: number }, voice: number, tiles: number, sameSide: boolean): boolean {
  if (listener.deaf) return false;
  if (sameSide) return true;
  return tiles <= earshot(voice, listener.hearing);
}

/** Grand nouns (shared `grand`), shortest first: what made-up calls claim was spelled. Worked out once per dictionary. */
export function grandWords(dict: Dictionary): string[] {
  let list = GRAND.get(dict);
  if (list) return list;
  list = [];
  for (const [w, def] of dict.words) {
    if (def.role !== "noun" || w.length > 9 || dict.crude(w)) continue;
    try { if (grand(parsePhrase(dict, w))) list.push(w); } catch { /* not a phrase alone */ }
  }
  list.sort((a, b) => a.length - b.length || a.localeCompare(b));
  GRAND.set(dict, list);
  return list;
}
const GRAND = new WeakMap<Dictionary, string[]>();

/** Small stable hash, 0 to 1. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** The made-up call a lying field sends at round second `t`: a name from `names` and a grand word. */
export function fakeCall(dict: Dictionary, key: string, names: readonly string[], t: number): { name: string; word: string } {
  const words = grandWords(dict), beat = Math.floor(t / DECOY_CALL_SECONDS);
  const name = names.length ? names[Math.floor(hash(`${key}:n:${beat}`) * names.length)]! : "STRANGER";
  const word = words.length ? words[Math.floor(hash(`${key}:w:${beat}`) * words.length)]! : "dragon";
  return { name, word };
}

/** Communication lines for a card. */
export function commsText(s: Stats): string[] {
  const out: string[] = [];
  if (s.num("decoys") > 0) out.push("lies: made-up spell calls and DANGER pings to those it fools");
  if (s.num("inflict_gag") > 0) out.push("gags: no pings, and their spelling goes unheard");
  return out;
}
