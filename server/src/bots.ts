import { ACTION_LETTERS, becomes, parsePhrase, producerOf, TILE_METERS, TILE_TYPES, type Dictionary, type Letters, type Op, type Stats } from "@lastword/shared";

/**
 * Server-side bot players: what a bot knows about words, and how hard it plays. The room
 * (`WorldRoom.thinkBot`) does the acting; this file only chooses.
 */

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

/** Most bots a room takes, before room capacity. */
export const MAX_BOTS = 99;

/**
 * Bots and difficulty for a new room, from the first client's join options, else the BOTS
 * environment variable. Anything malformed falls back; the count is clamped to `capacity`.
 */
export function botSettings(options: unknown, capacity: number, env = process.env.BOTS): { bots: number; difficulty: Difficulty } {
  const o = (options && typeof options === "object" ? options : {}) as { bots?: unknown; difficulty?: unknown };
  const asked = typeof o.bots === "number" && Number.isFinite(o.bots) ? o.bots : Number(env ?? 0);
  const bots = Math.max(0, Math.min(MAX_BOTS, capacity, Math.floor(Number.isFinite(asked) ? asked : 0)));
  const difficulty = DIFFICULTIES.includes(o.difficulty as Difficulty) ? (o.difficulty as Difficulty) : "normal";
  return { bots, difficulty };
}

/** What a word is good for to a bot, in the order a bot wants them. */
export type Use = "weapon" | "armor" | "mount" | "creature" | "producer" | "claim" | "heal" | "boost" | "field" | "event" | "food";

export interface BotWord {
  word: string;
  use: Use;
  /** Higher is better within its use. */
  score: number;
  /** How many of each letter it costs, a to z. */
  cost: Uint8Array;
  /** Equip slot, for armour. */
  slot: string;
  /** For events: tiles from the speller it can land. */
  reach: number;
  /** For producers: what it needs to work (shared `produce.ts`). */
  needs?: string[];
}

const A = "a".charCodeAt(0);

function costOf(letters: string): Uint8Array {
  const c = new Uint8Array(26);
  for (const ch of letters) c[ch.charCodeAt(0) - A]!++;
  return c;
}

/** Held letters as counts a to z, for `affords`. */
export function held(letters: Letters): Uint8Array {
  const c = new Uint8Array(26);
  for (const [ch, n] of Object.entries(letters)) if (n > 0) c[ch.charCodeAt(0) - A] = Math.min(255, n);
  return c;
}

export function affords(have: Uint8Array, w: BotWord): boolean {
  for (let i = 0; i < 26; i++) if (w.cost[i]! > have[i]!) return false;
  return true;
}

function damage(s: Stats): number {
  let sum = 0;
  for (const [k, v] of s.entries()) if (k.startsWith("dmg_") && typeof v === "number" && v > 0) sum += v;
  return sum;
}

const dps = (s: Stats) => damage(s) * Math.max(0.1, s.num("attack_rate") || 1);

/** Properties whose rise makes a fighter better. */
const GOOD = /^(speed_land|speed_air|armor|accuracy|integrity|attack_rate|evasion|morale|courage|block|dmg_.*)$/;

/** How many of a verb's ops help its caster fight; -1 if any makes it worse. */
function helps(ops: Op[]): number {
  let n = 0;
  for (const [prop, op, v] of ops) {
    if (!GOOD.test(prop) || typeof v !== "number") continue;
    const up = op === "add" ? v > 0 : op === "mul" ? v > 1 : false;
    if (!up) return -1;
    n++;
  }
  return n;
}

let book: { words: BotWord[]; byUse: Map<Use, BotWord[]>; counters: Map<string, BotWord[]> } | null = null;

/**
 * Every single word in the dictionary a bot might spell, by what it is good for, best first;
 * and for each word an area can be (FIRE), the spellable words that counter it (RAIN).
 * Worked out once per process: the dictionary is the same for every room.
 */
export function wordBook(dict: Dictionary) {
  if (book) return book;
  const words: BotWord[] = [];
  const counters = new Map<string, BotWord[]>();
  for (const [word, def] of dict.words) {
    if (def.role !== "noun" && def.role !== "verb") continue;
    let p;
    try { p = parsePhrase(dict, word); } catch { continue; }
    const s = p.stats;
    const add = (use: Use, score: number, extra: Partial<BotWord> = {}) => {
      if (score > 0) words.push({ word, use, score, cost: costOf(p.letters), slot: "", reach: 0, ...extra });
    };
    const against = def.set.counters;
    if (Array.isArray(against) && p.kind !== "object") {
      for (const t of against) {
        const list = counters.get(String(t)) ?? counters.set(String(t), []).get(String(t))!;
        list.push({ word, use: "field", score: 1, cost: costOf(p.letters), slot: "", reach: 0 });
      }
    }
    if (p.kind === "verb") {
      if (s.num("restores") > 0) add("heal", s.num("restores"));
      else if (s.num("duration") > 0 && p.effect) add("boost", helps(p.effect.ops));
      continue;
    }
    if (p.kind === "field") {
      const placement = String(s.get("placement"));
      if (placement === "target") continue;
      const targets = String(s.get("field_targets"));
      const inflicts = s.entries().filter(([k, v]) => k.startsWith("inflict_") && typeof v === "number" && v > 0).length;
      if (targets === "enemies") add("field", def.ops.length + inflicts * 2);
      else if (targets === "owned" || targets === "allies" || targets === "self") add("field", helps(def.ops));
      continue;
    }
    if (p.kind === "event") {
      if (s.get("placement") !== "target") continue;
      const reach = Math.max(1.5, s.num("placement_range") / TILE_METERS);
      if (s.flag("destroys_target")) add("event", 1000, { reach });
      else if (damage(s) > 0) add("event", damage(s), { reach });
      else if (s.num("inflict_stun") > 0 && s.get("event_target") === "character") add("event", 50, { reach });
      continue;
    }
    if (p.kind !== "object" || p.plural) continue;
    // Producers, scored by what they make a minute; letters no action gives count double.
    // Terrain only if it is crop land it tills (HOE, FARM); nothing ridden.
    const spec = producerOf(s);
    const makes = Object.entries(spec.rates);
    const tile = String(s.get("tile_type"));
    if (makes.length && (TILE_TYPES[tile] === undefined || tile === "tilled") && !s.flag("mountable")) {
      add("producer", makes.reduce((n, [ch, rate]) => n + rate * (ACTION_LETTERS.includes(ch) ? 1 : 2), 0) * p.count,
        { needs: [...spec.needs, ...spec.uses, ...(s.num("upkeep_fuel") > 0 ? ["fuel"] : []), ...(s.num("upkeep_power") > 0 ? ["power"] : [])] });
    }
    // Claims: ground that pays L (and S over a city's middle), the cheapest and widest first.
    if (s.num("claim_radius") > 0 && becomes(s) !== "creature" && !s.flag("mountable") && !s.flag("alive")) {
      add("claim", s.num("claim_radius") / Math.max(1, p.letters.length));
    }
    if (s.get("tile_type") !== "none") continue;
    const slot = String(s.get("equip_slot"));
    if (s.flag("mountable")) {
      // A ship cannot leave the water: no use to a bot on land.
      if (Math.max(s.num("speed_land"), s.num("speed_air")) > 0) add("mount", Math.max(s.num("speed_land"), s.num("speed_air")) / 2 + s.num("integrity") / 20 + dps(s) / 10);
    }
    else if (becomes(s) === "creature") add("creature", (dps(s) + s.num("integrity") / 10) * p.count);
    // A weapon thrown once (GRENADE) is worth little next to one that lasts.
    else if (slot === "held" && damage(s) > 0) add("weapon", dps(s) * (s.num("attack_range") > 6 ? 1.5 : 1) * (s.flag("single_use") ? 0.05 : 1), { slot });
    else if (slot !== "held" && slot !== "none" && s.num("armor") > 0) add("armor", s.num("armor") + s.num("integrity") / 20, { slot });
    else if (s.flag("edible") && s.num("nutrition") > 0) add("food", s.num("nutrition"));
  }
  words.sort((a, b) => b.score - a.score);
  const byUse = new Map<Use, BotWord[]>();
  for (const w of words) (byUse.get(w.use) ?? byUse.set(w.use, []).get(w.use)!).push(w);
  book = { words, byUse, counters };
  return book;
}

/**
 * The word a bot spells from a list (best first), or null if it can afford none. Easy bots
 * take any word they can afford, normal bots one of the best three, hard bots the best.
 */
export function chooseWord(list: readonly BotWord[] | undefined, have: Uint8Array, difficulty: Difficulty, rng: () => number,
  ok: (w: BotWord) => boolean = () => true): BotWord | null {
  if (!list) return null;
  if (difficulty === "easy") {
    const can = list.filter((w) => affords(have, w) && ok(w));
    return can.length ? can[Math.floor(rng() * can.length)]! : null;
  }
  const top: BotWord[] = [];
  for (const w of list) {
    if (!affords(have, w) || !ok(w)) continue; // the cheap test first
    if (difficulty === "hard") return w;
    if (top.push(w) === 3) break;
  }
  return top.length ? top[Math.floor(rng() * top.length)]! : null;
}
