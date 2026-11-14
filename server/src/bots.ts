import { ACTION_LETTERS, becomes, cooks, parsePhrase, placeRules, pluralize, producerOf, TILE_METERS, TILE_TYPES, type Dictionary, type Letters, type Op, type Stats } from "@lastword/shared";

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

/**
 * How well each difficulty plays (`thinkBot` and its parts): the chance a bot considers each of
 * the systems beyond gathering, fighting and building at one thought, whether it puts adjectives
 * on what it spells (GLASS SWORD) and plurals (WOLVES), aims fields and adjectives at its foes,
 * counters words used against it, and how hurt it must be to run (0: never).
 */
export interface Skill { systems: number; phrases: number; aims: boolean; counters: number; flee: number; offers: number }
export const SKILL: Readonly<Record<Difficulty, Skill>> = {
  easy: { systems: 0.25, phrases: 0, aims: false, counters: 0, flee: 0, offers: 0 },
  normal: { systems: 0.6, phrases: 0.5, aims: true, counters: 0.6, flee: 0.25, offers: 0.3 },
  hard: { systems: 1, phrases: 1, aims: true, counters: 1, flee: 0.35, offers: 0.6 },
};

/**
 * What a word is good for to a bot, in the order a bot wants them. Beyond fighting and building:
 * `buff`/`debuff` adjectives (for its own things, or put on a foe), `aimed` fields dropped on
 * foes, area words whose place rules help it (`boon`: yields, lodes, plenty; `levy`: taxes;
 * `hinder`: laws and dearth for its enemies; `refuge`: a law against fighting; `war`: hostility
 * and soldiers), `route` (roads, R), `city` (takes the city it is spelled in), `tiller` (crop
 * land), `cook` (heat that cooks raw food).
 */
export type Use = "weapon" | "armor" | "mount" | "creature" | "producer" | "claim" | "heal" | "boost" | "field" | "event" | "food"
  | "buff" | "debuff" | "aimed" | "boon" | "levy" | "hinder" | "refuge" | "war" | "route" | "city" | "tiller" | "cook";

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
  /** For food: eaten raw it is worse than cooked (shared `food.ts`). */
  raw?: boolean;
  /** For area words: a field that follows its maker (placement self) or one dropped at a spot. */
  placement?: string;
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

/**
 * What an adjective does to a fighter: how many of its operations make one better (a buff, put
 * on your own sword or body), or, negated, how many make one worse and none better (a debuff,
 * put on a foe). 0 if mixed or neither.
 */
export function adjectiveEffect(ops: readonly Op[]): number {
  let up = 0, down = 0;
  for (const [prop, op, v] of ops) {
    if (!GOOD.test(prop) || typeof v !== "number") continue;
    const better = op === "add" ? v > 0 : op === "mul" ? v > 1 : false;
    const worse = op === "add" ? v < 0 : op === "mul" ? v < 1 : false;
    if (better) up++; else if (worse) down++;
  }
  return up && !down ? up : down && !up ? -down : 0;
}

/** How much an area's place rules (shared `placeRules`) raise what is earned inside: yields, lodes, deposits, growth. */
function boonOf(rules: NonNullable<ReturnType<typeof placeRules>>): number {
  let n = 0;
  for (const y of Object.values(rules.yields)) n += (y.mul - 1) + y.add;
  if (rules.lode.length) n += rules.lodeShare * 5;
  if (rules.deposits > 1 && Number.isFinite(rules.deposits)) n += rules.deposits - 1;
  if (rules.growth > 1 && Number.isFinite(rules.growth)) n += (rules.growth - 1) / 2;
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
    if (def.role === "adjective") {
      // Adjectives: put on your own things or body (buff), or on a foe (debuff), or spelled before a noun.
      const e = adjectiveEffect(def.ops);
      if (e > 0) words.push({ word, use: "buff", score: e, cost: costOf(word), slot: "", reach: 0 });
      else if (e < 0) words.push({ word, use: "debuff", score: -e, cost: costOf(word), slot: "", reach: 0 });
      continue;
    }
    if (def.role !== "noun" && def.role !== "verb") continue;
    let p;
    try { p = parsePhrase(dict, word); } catch { continue; }
    const s = p.stats;
    const add = (use: Use, score: number, extra: Partial<BotWord> = {}) => {
      if (score > 0) words.push({ word, use, score, cost: costOf(p.letters), slot: "", reach: 0, ...extra });
    };
    const against = def.set.counters;
    // Anything that ends what it counters (RAIN a FIRE, VETO a LAW, PESTICIDE locusts) is a counter-word.
    if (Array.isArray(against)) {
      for (const t of against) {
        const list = counters.get(String(t)) ?? counters.set(String(t), []).get(String(t))!;
        list.push({ word, use: "field", score: 1, cost: costOf(p.letters), slot: "", reach: 0 });
      }
    }
    const placement = String(s.get("placement"));
    const targets = String(s.get("field_targets"));
    // Area words: what their place rules do (shared place.ts), for whom.
    const areaUses = () => {
      const rules = placeRules(def, s);
      const forMe = targets !== "enemies";
      if (rules && placement !== "target") {
        const boon = boonOf(rules);
        if (forMe && boon > 0 && !rules.law.length) add("boon", boon, { placement });
        if (rules.tax > 0 && targets !== "owned" && targets !== "self") add("levy", rules.tax * 10, { placement });
        if (rules.law.includes("attack") && forMe) add("refuge", 1 + (s.num("heals") > 0 ? 1 : 0), { placement });
        if (!forMe && (rules.law.some((l) => l !== "attack") || boon < 0)) add("hinder", rules.law.length + Math.max(0, -boon), { placement });
      }
      if (s.flag("sets_hostile") && placement !== "target") add("war", 1 + s.num("summon_count") / 2, { placement });
    };
    if (p.kind === "verb") {
      if (s.num("restores") > 0) add("heal", s.num("restores"));
      else if (s.num("duration") > 0 && p.effect) add("boost", helps(p.effect.ops));
      continue;
    }
    if (p.kind === "sky") { areaUses(); continue; }
    if (p.kind === "field") {
      const inflicts = s.entries().filter(([k, v]) => k.startsWith("inflict_") && typeof v === "number" && v > 0).length;
      if (placement === "target") {
        // Dropped on a spot: worth it if it hurts or hinders whoever it is aimed at.
        if (targets === "enemies" || targets === "all" || targets === "living") {
          const hurts = damage(s) > 0 || inflicts > 0 || adjectiveEffect(def.ops) < 0;
          if (hurts) add("aimed", def.ops.length + inflicts * 2 + damage(s) / 20, { reach: Math.max(1.5, s.num("placement_range") / TILE_METERS) });
        }
        continue;
      }
      if (targets === "enemies") add("field", def.ops.length + inflicts * 2);
      else if (targets === "owned" || targets === "allies" || targets === "self") add("field", helps(def.ops));
      areaUses();
      continue;
    }
    if (p.kind === "event") {
      if (s.flag("takes_city")) { add("city", 10 / p.letters.length); continue; }
      if (s.get("placement") !== "target") { areaUses(); continue; }
      const reach = Math.max(1.5, s.num("placement_range") / TILE_METERS);
      if (s.flag("destroys_target")) add("event", 1000, { reach });
      else if (damage(s) > 0) add("event", damage(s), { reach });
      else if (s.num("inflict_stun") > 0 && s.get("event_target") === "character") add("event", 50, { reach });
      continue;
    }
    if (p.kind !== "object" || p.plural) continue;
    const tileType = String(s.get("tile_type"));
    // Roads (R): a route word lays a run of road the way its speller faces.
    if (def.archetype === "route" && tileType === "road") add("route", s.num("radius") / p.letters.length);
    // Crop land: tilled ground that crops (A) are planted on.
    if (tileType === "tilled" && !Object.keys(producerOf(s).rates).length) add("tiller", s.num("radius") / p.letters.length);
    // Heat that cooks raw food laid beside it (shared food.ts), and is safe to stand by.
    if (cooks(s) && becomes(s) === "ground" && damage(s) === 0) add("cook", 10 / p.letters.length);
    // A thing whose own field holds a law against fighting (a SANCTUARY): a refuge where it stands.
    // Nothing else for such a thing: carried, ridden or following, it would keep its owner from fighting too.
    if (s.num("field_radius") > 0 && placeRules(def, s)?.law.includes("attack")) { add("refuge", 1, { placement: "object" }); continue; }
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
    else if (s.flag("edible") && s.num("nutrition") > 0) add("food", s.num("nutrition"), { raw: s.flag("raw") });
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
    const can = list.filter((w) => ok(w) && affords(have, w));
    return can.length ? can[Math.floor(rng() * can.length)]! : null;
  }
  const top: BotWord[] = [];
  for (const w of list) {
    if (!ok(w) || !affords(have, w)) continue;
    if (difficulty === "hard") return w;
    if (top.push(w) === 3) break;
  }
  return top.length ? top[Math.floor(rng() * top.length)]! : null;
}

/** Adds two costs, a to z. */
export function plus(a: Uint8Array, b: Uint8Array): Uint8Array {
  const c = new Uint8Array(26);
  for (let i = 0; i < 26; i++) c[i] = a[i]! + b[i]!;
  return c;
}

const covers = (have: Uint8Array, cost: Uint8Array) => cost.every((n, i) => n <= have[i]!);

/** How good a spelled object is for what a bot wants it for, to compare phrases of one noun. */
function worth(use: Use, s: Stats, count: number): number {
  switch (use) {
    case "weapon": return dps(s);
    case "armor": return s.num("armor") + s.num("integrity") / 20;
    case "mount": return Math.max(s.num("speed_land"), s.num("speed_air")) / 2 + s.num("integrity") / 20 + dps(s) / 10;
    case "creature": return (dps(s) + s.num("integrity") / 10) * count;
    default: return 0;
  }
}

/**
 * What a bot spells for a word it chose: the word itself, or (as its skill allows) the plural of
 * a creature (WOLVES: three) and the adjective it can also afford that most improves the thing
 * (FIERCE WOLVES, GLASS SWORD), checked through shared `parsePhrase`. Nothing word-specific: any
 * noun, any adjective whose operations make it better.
 */
export function phraseFor(dict: Dictionary, w: BotWord, have: Uint8Array, skill: Skill, rng: () => number): { text: string; cost: Uint8Array; plural: boolean; adjective: string } {
  let best = { text: w.word, cost: w.cost, plural: false, adjective: "" };
  if (!["weapon", "armor", "mount", "creature"].includes(w.use) || rng() >= skill.phrases) return best;
  const parse = (text: string) => { try { return parsePhrase(dict, text); } catch { return null; } };
  const base = parse(w.word);
  if (!base) return best;
  let bestWorth = worth(w.use, base.stats, base.count);
  if (w.use === "creature") {
    const many = parse(pluralize(w.word));
    if (many && many.noun === w.word) {
      const cost = costOf(many.letters);
      const value = worth(w.use, many.stats, many.count);
      if (covers(have, cost) && value > bestWorth) { best = { text: pluralize(w.word), cost, plural: true, adjective: "" }; bestWorth = value; }
    }
  }
  const adjectives = wordBook(dict).byUse.get("buff") ?? [];
  let tried = 0;
  for (const a of adjectives) {
    const cost = plus(best.cost, a.cost);
    if (!covers(have, cost)) continue;
    if (++tried > 12) break;
    const p = parse(`${a.word} ${best.text}`);
    if (!p) continue;
    const value = worth(w.use, p.stats, p.count);
    if (value > bestWorth * 1.05) { best = { text: `${a.word} ${best.text}`, cost: costOf(p.letters), plural: best.plural, adjective: a.word }; bestWorth = value; }
  }
  return best;
}

/**
 * Where letters came from, from the reason the room gives with them (`award`'s `why`), for the
 * bot tournament's letter shares: gathering, caches and the temple, hunting, breaking things,
 * markets and offers, kills (K) and the letters of the knocked out (loot), bosses, exploring, taxes and events, transmuting, or producers
 * (land, roads and cities are territory).
 */
export function sourceOf(why: string): string {
  if (/^(forage|fishing|digging|cave|gathered)$/.test(why)) return "gather";
  if (why === "cache" || why === "cache prize") return "cache";
  if (why === "temple") return "temple";
  if (why.startsWith("hunted ")) return "hunt";
  if (/^(broke|beat|burned) /.test(why)) return "destroy";
  if (why === "trade") return "trade";
  if (why.startsWith("from ")) return "offer";
  if (why.endsWith("'s letters")) return "loot";
  if (why.startsWith("kill ")) return "kill";
  if (why.startsWith("slew ") || why.endsWith("'s hoard")) return "boss";
  if (why === "transmuted") return "transmute";
  if (why.includes("new ground") || why.includes("scouted")) return "explore";
  if (why === "LAND" || why === "ROADS" || why === "CITY") return "territory";
  if (/ on /.test(why)) return "levy";
  if (/^[A-Z][A-Z ]*$/.test(why)) return "producer";
  return "other";
}
