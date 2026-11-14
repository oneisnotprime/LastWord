import { ACTION_LETTERS, becomes, cooks, GRAFT_CAPABILITIES, GROUNDED_FROM, isBoon, isGraft, isTrap, parsePhrase, placeRules, pluralize, producerOf, sails, STATUSES, TILE_METERS, TILE_TYPES, WORN_SLOTS, type Dictionary, type Letters, type Op, type Stats, type Status } from "@lastword/shared";

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
export interface Skill { systems: number; phrases: number; aims: boolean; counters: number; flee: number; offers: number; themes: number; cures: number }
/**
 * `themes`: the chance a bot considers the dictionary themes' systems at a thought (`botThemes`:
 * dress, disguise, grafts, traps, lies, jamming, faith, music, money, time, gravity, boats, duels,
 * luck, statuses on its foes); `cures`: the chance it ends a status on itself that a word it can
 * afford ends (sickness, rage, fear, doom, curses, debts...). Easy bots only treat sickness and cold.
 */
export const SKILL: Readonly<Record<Difficulty, Skill>> = {
  easy: { systems: 0.25, phrases: 0, aims: false, counters: 0, flee: 0, offers: 0, themes: 0.15, cures: 0.3 },
  normal: { systems: 0.6, phrases: 0.5, aims: true, counters: 0.6, flee: 0.25, offers: 0.3, themes: 0.5, cures: 0.7 },
  hard: { systems: 1, phrases: 1, aims: true, counters: 1, flee: 0.35, offers: 0.6, themes: 0.9, cures: 1 },
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
  | "buff" | "debuff" | "aimed" | "boon" | "levy" | "hinder" | "refuge" | "war" | "route" | "city" | "tiller" | "cook"
  | ThemeUse;

/**
 * Uses from the dictionary themes (batches 3 to 5), each read from shared properties: `warm`
 * (worn things that lower `temp_min`), `disguise` (worn `disguise`), `graft` (a body part that makes
 * a fighter better), `cure` (ends statuses on its speller's side: `effect_status`), `hex` (passes
 * statuses on a foe: doom, curse, chaos, rage, expose, debt, stasis...), `duel` (`stakes`), `gift`
 * (`pays` with charm), `loan` (`pays` and a debt), `bribe` (buys a creature), `trap` (`trigger_radius`),
 * `lie` (`decoys`), `jam` (`jams`), `shrine` (gathers faith or takes sacrifices), `miracle` (spends
 * faith to heal), `morale` (lifts its side's morale or courage; music when it is loud), `haste`
 * (time runs faster for it), `rewind` (`rewinds`), `gravity` (grounds flyers), `vessel` (sails),
 * `fishing` (a tool that fishes), `luck` (luck for itself).
 */
export type ThemeUse = "warm" | "disguise" | "graft" | "cure" | "hex" | "duel" | "gift" | "loan" | "bribe" | "trap" | "lie" | "jam"
  | "shrine" | "miracle" | "morale" | "haste" | "rewind" | "gravity" | "vessel" | "fishing" | "luck";

/** What the bot tournament lists as the themes' systems (`botUsed` names), in order. */
export const THEME_SYSTEMS = [
  "warm", "disguise", "graft self", "graft creature", "cure", "calm", "avoid sick", "hex", "hex rage", "hex doom", "hex curse",
  "hex chaos", "hex expose", "hex debt", "hex stasis", "hex void", "hex sick", "morale", "music", "gift", "bribe", "loan", "trap", "lie", "jam",
  "shrine", "sacrifice", "miracle", "weather", "haste", "rewind", "gravity", "vessel", "sail", "fishing", "catch", "duel", "luck", "sell",
] as const;

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
  /** For hexes the statuses it passes on; for cures the statuses it ends. */
  statuses?: string[];
  /** How it is aimed: at a person or creature clicked (`walker`), at a spot (`spot`), or at its speller's side (`self`). */
  aim?: "walker" | "spot" | "self";
  /** Faith it spends (shared faith.ts), checked before spelling. */
  faith?: number;
  /** A sky word (weather, the season): counted as weather. */
  sky?: boolean;
  /** Loud (an instrument, a song): counted as music. */
  loud?: boolean;
  /** An adjective, put on its speller's own body (`describe`). */
  adjective?: boolean;
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
const GOOD = /^(speed_land|speed_air|armor|accuracy|integrity|attack_rate|evasion|morale|courage|block|luck|critical|dmg_.*)$/;

/** How much a bot wants each status on a foe: a sealed fate, stopped time and nothing at all most. */
const HEX_WEIGHT: Partial<Record<Status, number>> = { doom: 5, stasis: 4, void: 4, chaos: 3, curse: 3, rage: 3, sick: 3, debt: 2, expose: 2, fear: 2, sleep: 2, root: 2, confuse: 2, silence: 2 };

/** Statuses a stats sheet passes on (`inflict_*`), boons and charm left out. */
function harms(s: Stats): Status[] {
  return STATUSES.filter((st) => s.num(`inflict_${st}`) > 0 && !isBoon(st) && st !== "charm");
}

/** The sum an operation list adds to a property (its `add` operations). */
function added(ops: readonly Op[], prop: string): number {
  let n = 0;
  for (const [p, op, v] of ops) if (p === prop && op === "add" && typeof v === "number") n += v;
  return n;
}

/** The product an operation list multiplies a property by (its `mul` operations). */
function multiplied(ops: readonly Op[], prop: string): number {
  let n = 1;
  for (const [p, op, v] of ops) if (p === prop && op === "mul" && typeof v === "number") n *= v;
  return n;
}

/** How many of a verb's ops help its caster fight; -1 if any makes it worse. */
function helps(ops: readonly Op[]): number {
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
      // An adjective that keeps a status off whatever it describes (CALM: no rage, no fear), put on the bot itself.
      const immune = STATUSES.filter((st) => def.set[`immune_${st}`] === true && !isBoon(st));
      if (immune.length && e >= 0) words.push({ word, use: "cure", score: immune.length / word.length, cost: costOf(word), slot: "", reach: 0, statuses: immune, aim: "self", adjective: true });
      if (e > 0) words.push({ word, use: "buff", score: e, cost: costOf(word), slot: "", reach: 0 });
      else if (e < 0) words.push({ word, use: "debuff", score: -e, cost: costOf(word), slot: "", reach: 0 });
      continue;
    }
    if (def.role !== "noun" && def.role !== "verb") continue;
    let p;
    try { p = parsePhrase(dict, word); } catch { continue; }
    const s = p.stats;
    const add = (use: Use, score: number, extra: Partial<BotWord> = {}) => {
      if (score > 0) words.push({ word, use, score, cost: costOf(p.letters), slot: "", reach: 0, ...(p.kind === "sky" ? { sky: true } : {}), ...extra });
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
    themeUses(word, def.archetype, def.ops, p, s, placement, targets, add);
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
 * The dictionary themes' uses of one word (`ThemeUse`), from its shared properties only: how it
 * is aimed (at someone clicked, a spot, or its speller's side) and what it does there.
 */
function themeUses(word: string, archetype: string, ops: readonly Op[], p: ReturnType<typeof parsePhrase>, s: Stats, placement: string, targets: string,
  add: (use: Use, score: number, extra?: Partial<BotWord>) => void) {
  const touched = p.kind === "verb" && s.get("effect_target") === "touched";
  const atWalker = (p.kind === "event" && placement === "target" && (s.get("event_target") === "character" || s.get("event_target") === "creature")) || touched;
  const atSpot = p.kind === "field" && placement === "target";
  const ownSide = targets === "self" || targets === "owned" || targets === "allies" || targets === "all" || targets === "living" || targets === "undefined" || targets === "";
  const atSelf = (p.kind === "verb" && !touched) || ((p.kind === "field" || p.kind === "event" || p.kind === "sky") && placement !== "target" && ownSide);
  const bad = harms(s);
  const faith = s.num("faith_cost") > 0 ? s.num("faith_cost") : undefined;
  const damaging = s.entries().some(([k, v]) => k.startsWith("dmg_") && typeof v === "number" && v > 0);
  const loud = s.num("loudness") > 0 || /instrument|music/.test(archetype);
  // Ends statuses on its speller's side (CURE, CALM, REPRIEVE, EXORCISM, BANKRUPTCY, ORDER): passed on itself or spread over its side.
  const ends = s.tags("effect_status").filter((st) => (STATUSES as readonly string[]).includes(st) && !isBoon(st as Status));
  if (ends.length && !bad.length && !damaging && (atSelf || (p.kind === "event" && s.get("event_target") === "character") || (p.kind === "object" && s.flag("edible")))) {
    add("cure", ends.length / p.letters.length, { statuses: ends, aim: atSelf || p.kind === "object" ? "self" : "walker", faith });
  }
  if (p.kind === "object") {
    const slot = String(s.get("equip_slot"));
    const worn = WORN_SLOTS.includes(slot) && slot !== "graft";
    if (worn && added(ops, "temp_min") < 0) add("warm", -added(ops, "temp_min") / p.letters.length);
    if (worn && s.num("disguise") > 0) add("disguise", s.num("disguise"));
    if (isGraft(s)) {
      const can = GRAFT_CAPABILITIES.filter((c) => s.flag(c)).length;
      const dmg = s.entries().reduce((n, [k, v]) => n + (k.startsWith("dmg_") && typeof v === "number" ? Math.max(0, v) : 0), 0);
      const score = Math.max(0, adjectiveEffect(ops)) + can + dmg / 20;
      if (score > 0 && adjectiveEffect(ops) >= 0) add("graft", score, { aim: "walker" });
    }
    if (isTrap(s) && !s.flag("mountable")) add("trap", (damaging ? 2 : 0) + bad.length + s.num("stealth") / 5);
    if (s.flag("jams") && s.get("portable") === false) add("jam", 1);
    if (s.get("portable") === false && (s.num("faith_output") > 0 || s.num("sacrifice") > 0)) add("shrine", s.num("faith_output") + s.num("sacrifice"));
    if (s.flag("mountable") && sails(s)) add("vessel", s.num("speed_water") + s.num("integrity") / 1000);
    if (!s.flag("mountable") && String(s.get("harvest_sources")).split(",").includes("fishing") && slot === "held") add("fishing", s.num("harvest_bonus"));
    return;
  }
  // Statuses passed on a foe, at them or at their spot (FATE, CURSE, CHAOS, PROVOCATION, WANTED, DEBT, STASIS).
  if (bad.length && (atWalker || (atSpot && targets !== "owned" && targets !== "self")) && !s.num("stakes") && !s.flag("transfers_ownership") && !(s.num("pays") > 0)) {
    add("hex", bad.reduce((n, st) => n + (HEX_WEIGHT[st] ?? 1), 0), { statuses: bad, aim: atWalker ? "walker" : "spot", faith, reach: Math.max(1.5, s.num("placement_range") / TILE_METERS) });
  }
  if (atWalker && s.num("stakes") > 0 && !s.num("race_to")) add("duel", s.num("stakes"), { aim: "walker", reach: Math.max(1.5, s.num("placement_range") / TILE_METERS) });
  if (atWalker && s.num("pays") > 0) {
    const reach = Math.max(1.5, s.num("placement_range") / TILE_METERS);
    if (s.flag("transfers_ownership") && s.get("event_target") === "creature") add("bribe", s.num("pays"), { aim: "walker", reach });
    else if (s.num("inflict_debt") > 0) add("loan", s.num("inflict_debt") / Math.max(1, s.num("pays")), { aim: "walker", reach });
    else if (s.num("inflict_charm") > 0) add("gift", s.num("inflict_charm") / Math.max(1, s.num("pays")), { aim: "walker", reach });
  }
  if (s.num("decoys") > 0 && (p.kind === "field" || p.kind === "event")) add("lie", s.num("decoys"), { aim: atSpot ? "spot" : "self", reach: Math.max(1.5, s.num("placement_range") / TILE_METERS) });
  if (s.flag("jams") && p.kind === "field") add("jam", 1, { aim: atSpot ? "spot" : "self", reach: Math.max(1.5, s.num("placement_range") / TILE_METERS) });
  if (atSelf && !bad.length && !damaging) {
    const heals = s.num("heals") + s.num("restores") + Math.max(0, added(ops, "regeneration")) * 5;
    if (faith && heals > 0) add("miracle", heals / faith, { aim: "self", faith });
    const lift = Math.max(0, added(ops, "morale")) + Math.max(0, added(ops, "courage"));
    if (lift > 0 && p.kind !== "verb" && targets !== "self" && helps(ops) >= 0) add("morale", lift, { aim: "self", loud });
    const faster = Math.max(multiplied(ops, "time_scale"), s.num("inflict_haste") > 0 ? 2 : 1);
    if (faster > 1 && targets !== "all") add("haste", faster, { aim: "self" });
    if (s.num("rewinds") > 0) add("rewind", s.num("rewinds"), { aim: "self" });
    const luck = added(ops, "luck");
    if (luck > 0 && targets !== "all" && !faith) add("luck", luck, { aim: "self" });
  }
  if (atSpot && multiplied(ops, "gravity") >= GROUNDED_FROM) add("gravity", multiplied(ops, "gravity"), { aim: "spot", reach: Math.max(1.5, s.num("placement_range") / TILE_METERS) });
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
 * markets and offers, kills (K) and the letters of the knocked out (loot), bosses, exploring, taxes and events, transmuting, fishing catches,
 * money (gifts, loans and debts paid), or producers
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
  if (why.startsWith("caught ")) return "fish";
  if (/ from /.test(why)) return "money";
  if (why.includes("new ground") || why.includes("scouted")) return "explore";
  if (why === "LAND" || why === "ROADS" || why === "CITY") return "territory";
  if (/ on /.test(why)) return "levy";
  if (/^[A-Z][A-Z ]*$/.test(why)) return "producer";
  return "other";
}
