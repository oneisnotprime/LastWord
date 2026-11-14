import type { Dictionary } from "./dictionary.js";
import { becomes, countersOf, eventCard, heldText, keyStats, opText, cardOf } from "./inspect.js";
import { missing, parsePhrase, readNoun, type Letters, type Phrase } from "./phrase.js";
import { needsText, producerOf } from "./produce.js";
import type { Rng } from "./rng.js";
import type { Op, Value } from "./types.js";

/**
 * Teaching tips: random words with what each one does in plain numbers (start screen, the idle
 * spell window, the menu's word ideas), and short "did you know" lines about the rules.
 */

/** The kinds of word a set of ideas draws from, one each, so the ideas vary. */
export const TIP_KINDS = ["adjective", "creature", "event", "terrain", "producer", "weapon", "sky", "verb"] as const;
export type TipKind = (typeof TIP_KINDS)[number];

/** One word and what it does: "IRON (adj): integrity ×3, speed ×0.7 · countered by RUST". */
export interface WordTip {
  word: string;
  kind: TipKind;
  /** What it does, a few changes or numbers, comma separated. */
  does: string;
  /** The shortest word that ends or beats it, if one exists. */
  counter?: string;
}

/** Short labels for the kinds, shown in brackets after the word. */
const LABEL: Record<TipKind, string> = {
  adjective: "adj", creature: "creature", event: "event", terrain: "terrain", producer: "producer", weapon: "weapon", sky: "sky", verb: "verb",
};

/** A word tip in one line. */
export function tipText(t: WordTip): string {
  return `${t.word.toUpperCase()} (${LABEL[t.kind]}): ${t.does}${t.counter ? ` · countered by ${t.counter.toUpperCase()}` : ""}`;
}

/** Properties worth reading first in a change list, by prefix; anything else comes after. */
const FIRST = ["integrity", "dmg_", "speed_land", "speed_air", "armor", "attack_rate", "attack_range", "sight_range", "stealth", "evasion", "res_", "inflict_",
  "produce_", "fear_aura", "luminosity", "heals", "morale", "loyalty", "aggression", "mass", "temperature", "visibility", "growth"];
/** Properties too fine to teach with. */
const DULL = /^(footprint|length|height|width|value|beauty|density|loudness|odor|color|shape|buoyancy|food_need|water_need|flight_ceiling|reputation|charm)$/;
const rank = (id: string) => { const i = FIRST.findIndex((p) => id === p || (p.endsWith("_") && id.startsWith(p))); return i < 0 ? FIRST.length : i; };

/** A change in plain words, with letter output as "makes T +0.3/min". */
function change([id, op, amount]: Op): string {
  if (/^produce_[A-Z]$/.test(id) && op === "add") return `makes ${id.slice(8)} +${+amount.toPrecision(2)}/min`;
  return opText([id, op, amount]);
}
function setLine(id: string, v: Value): string | null {
  const name = id.replaceAll("_", " ");
  if (id === "effect_status" && Array.isArray(v)) return v.length ? `cures ${v.join(", ")}` : null;
  if (v === true) return name;
  if (Array.isArray(v)) return v.length ? `${name}: ${v.join(", ").replaceAll("_", " ")}` : null;
  return null;
}

/** The changes an adjective, verb or adverb makes, most telling first. */
function changes(ops: readonly Op[], set: Record<string, Value>, limit = 3): string[] {
  const shown = ops.filter(([id]) => !DULL.test(id)).sort((a, b) => rank(a[0]) - rank(b[0]));
  const out = shown.map(change);
  for (const [id, v] of Object.entries(set)) { const t = setLine(id, v); if (t) out.push(t); }
  return out.slice(0, limit);
}

/** What kind of word a phrase is, for the ideas; null for words that teach little (adverbs, things that do nothing). */
export function tipKind(dict: Dictionary, word: string, p?: Phrase): TipKind | null {
  const def = dict.word(word);
  if (!def) return null;
  if (def.role === "adjective") return def.ops.length ? "adjective" : null;
  if (def.role === "adverb") return null;
  if (def.role === "verb") return def.ops.length ? "verb" : null;
  try { p ??= parsePhrase(dict, word); } catch { return null; }
  if (p.kind === "event") return "event";
  if (p.kind === "sky" || p.kind === "field") return "sky";
  const s = p.stats, to = becomes(s);
  if (to === "creature") return "creature";
  if (to === "terrain") return "terrain";
  if (Object.keys(producerOf(s).rates).length) return "producer";
  if (to === "worn" && s.get("equip_slot") === "held" && keyStats(s).some((k) => k.startsWith("damage"))) return "weapon";
  return null;
}

/** What a word does, in one short line of plain numbers, or null when there is nothing to say. */
export function wordTip(dict: Dictionary, word: string): WordTip | null {
  word = word.toLowerCase();
  const def = dict.word(word);
  if (!def) return null;
  let p: Phrase | undefined;
  if (def.role === "noun") { try { p = parsePhrase(dict, word); } catch { return null; } }
  const kind = tipKind(dict, word, p);
  if (!kind) return null;
  let parts: string[] = [];
  const rates = (count = 1) => {
    const spec = producerOf(p!.stats, count), r = Object.entries(spec.rates);
    return r.length ? [`makes ${r.map(([ch, n]) => `${ch.toUpperCase()} +${+n.toPrecision(2)}/min`).join(", ")}`] : [];
  };
  switch (kind) {
    case "adjective":
    case "verb":
      parts = changes(def.ops, def.set);
      break;
    case "creature": {
      const s = p!.stats;
      parts = [...keyStats(s).filter((k) => k.startsWith("damage")).slice(0, 1), ...(s.num("speed_air") > 0 ? ["flies"] : []), ...rates()];
      if (!parts.length) return null; // "follows you" alone teaches nothing
      parts.unshift("follows you");
      break;
    }
    case "terrain": {
      const s = p!.stats;
      parts = [`turns land to ${String(s.get("tile_type")).replaceAll("_", " ")}${s.num("radius") > 0 ? `, radius ${s.num("radius")}` : ""}`, ...rates()];
      break;
    }
    case "producer": {
      const need = needsText(producerOf(p!.stats)).split(", ")[0];
      parts = [...rates(), ...(need ? [`needs ${need}`] : [])];
      break;
    }
    case "weapon":
      parts = [heldText(dict, word)];
      break;
    case "event":
    case "sky":
      parts = eventCard(dict, word).lines.slice(0, 2).map((l) => l.replace(/^on everyone it reaches: /, "all inside: "));
      if (!parts.length) parts = cardOf(dict, p!).does.filter((d) => !/^cast it|^lands around/.test(d)).slice(0, 2);
      break;
  }
  parts = parts.filter(Boolean);
  if (!parts.length) return null;
  const counter = countersOf(dict, word).find((w) => w !== word && dict.word(w)?.role === "noun");
  return { word, kind, does: parts.join(", "), ...(counter ? { counter } : {}) };
}

/** Every word worth a tip, by kind; worked out once per dictionary. */
const pools = new WeakMap<Dictionary, Map<TipKind, string[]>>();
function poolOf(dict: Dictionary): Map<TipKind, string[]> {
  let pool = pools.get(dict);
  if (pool) return pool;
  pool = new Map(TIP_KINDS.map((k) => [k, []]));
  for (const word of dict.words.keys()) {
    if (!/^[a-z]+$/.test(word) || word.length > 9) continue;
    const kind = tipKind(dict, word);
    if (kind) pool.get(kind)!.push(word);
  }
  pools.set(dict, pool);
  return pool;
}

/**
 * How much a word is worth showing to someone holding `held`: words they could spell now or with
 * two or three more letters come first; with no letters at all (the start screen), short words.
 */
export function tipWeight(held: Letters, word: string): number {
  const short = word.length <= 5 ? 1.5 : word.length <= 7 ? 1 : 0.4;
  if (!Object.values(held).some((n) => n > 0)) return short;
  const m = missing(held, word).length;
  return short * (m === 0 ? 4 : m <= 3 ? 4 - m * 0.6 : 0.15 / m);
}

/** Picks one entry by weight. */
function weighted<T>(items: readonly T[], weight: (t: T) => number, rng: Rng): T | undefined {
  let total = 0;
  for (const t of items) total += weight(t);
  let r = rng() * total;
  for (const t of items) if ((r -= weight(t)) < 0) return t;
  return items.at(-1);
}

/**
 * `n` word ideas of different kinds (an adjective, a creature, an event, terrain, a producer...),
 * leaning toward words the holder of `held` could spell soon.
 */
export function wordIdeas(dict: Dictionary, held: Letters, rng: Rng, n = 4): WordTip[] {
  const pool = poolOf(dict);
  const kinds = [...TIP_KINDS].filter((k) => pool.get(k)!.length);
  for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!]; }
  const out: WordTip[] = [];
  for (const kind of kinds) {
    if (out.length >= n) break;
    // A few tries: a word whose line comes out empty is skipped.
    for (let t = 0; t < 4; t++) {
      const word = weighted(pool.get(kind)!, (w) => tipWeight(held, w), rng);
      const tip = word ? wordTip(dict, word) : null;
      if (tip && !out.some((o) => o.word === tip.word)) { out.push(tip); break; }
    }
  }
  return out;
}

/** A "did you know" line about the rules, and the words and properties it names (test-checked against the data). */
export interface RuleTip { text: string; words: string[]; properties: string[] }

export const RULE_TIPS: readonly RuleTip[] = [
  { text: "Add an S: WOLVES makes three wolves for one more letter.", words: ["wolves"], properties: ["plural_count"] },
  { text: "Spell an adjective alone (HUGE), then click a thing, a creature or yourself.", words: ["huge"], properties: ["adjective_slots"] },
  { text: "BIGGER and BIGGEST are BIG, only stronger.", words: ["bigger", "biggest", "big"], properties: [] },
  { text: "A HEDGE or FARM claims ground: your things there are sheltered.", words: ["hedge", "farm"], properties: ["claim_radius"] },
  { text: "At a city MARKET: Enter, trade eee for o. Each trade pays a T.", words: ["market"], properties: ["trade_rate"] },
  { text: "G gathers: E almost anywhere, O by water, G in hills, U by a MOUNTAIN.", words: ["mountain"], properties: [] },
  { text: "A HOE tills land; crops on tilled land make A.", words: ["hoe"], properties: ["tile_type", "produce_A"] },
  { text: "A MILL makes W only while the wind blows.", words: ["mill"], properties: ["produce_W", "production_needs"] },
  { text: "RAIN puts out FIRE: every word has a counter-word.", words: ["rain", "fire"], properties: ["counters"] },
  { text: "A DOG makes I while it is yours, and fights for you.", words: ["dog"], properties: ["produce_I"] },
  { text: "Hunting pays H and the animal's first letter: a FOX gives H and F.", words: ["fox"], properties: [] },
  { text: "Burn things with FIRE for F; destroy them for D; beat others' things for V.", words: ["fire"], properties: ["flammability"] },
  { text: "FLYING lifts anything into the air: a FLYING WOLF.", words: ["flying", "wolf"], properties: ["speed_air"] },
  { text: "Right-click a WOLF, a RUIN, anything: see what it does, then add an adjective.", words: ["wolf", "ruin"], properties: [] },
  { text: "A BED or a SOFA in your claimed ground lifts your morale and healing there.", words: ["bed", "sofa"], properties: ["comfort"] },
  { text: "A VAULT keeps your letters from thieves and fines.", words: ["vault"], properties: ["storage_letters"] },
  { text: "Carry IRON to your ANVIL and spell SWORD: an IRON SWORD, handmade.", words: ["iron", "anvil", "sword"], properties: ["crafts"] },
  { text: "A CAMERA left on the ground shows its ground on your minimap.", words: ["camera"], properties: ["map_reveal"] },
  { text: "Two HAMSTERS of yours, fed, have young.", words: ["hamsters"], properties: ["reproduction"] },
  { text: "A PRISON holds an ARRESTed enemy in its ground ten times longer.", words: ["prison", "arrest"], properties: ["security"] },
  { text: "Spell WINGS and click your WOLF: a wolf that flies. AMPUTATE cuts it off.", words: ["wings", "wolf", "amputate"], properties: ["severs"] },
  { text: "In a BLIZZARD the cold bites: wear a PARKA or stand by a FIRE.", words: ["blizzard", "parka", "fire"], properties: ["temp_min"] },
  { text: "A COSTUME fools wolves and bots until you strike; a HOUND smells through it.", words: ["costume", "hound"], properties: ["disguise"] },
  { text: "The sick pass it to anyone close; a VACCINE keeps it off, QUARANTINE stops it.", words: ["vaccine", "quarantine"], properties: ["inflict_sick", "contagion"] },
  { text: "RAGE on enemies sends them at whoever is nearest, friend or foe. CALM ends it.", words: ["rage", "calm"], properties: ["inflict_rage"] },
  { text: "A FLUTE charms wild animals around you; charmed long enough, they are yours.", words: ["flute"], properties: ["inflict_charm"] },
  { text: "A DRUM gives you away on others' threat arrows; SILENCE hushes it.", words: ["drum", "silence"], properties: ["loudness"] },
  { text: "A BRIBE buys a CAT for 8 letters; DEBT makes a foe pay you a letter each 10 s.", words: ["bribe", "cat", "debt"], properties: ["pays", "inflict_debt"] },
  { text: "A LANDMINE hides until it springs; a DETECTIVE sees it, DISARM breaks it.", words: ["landmine", "detective", "disarm"], properties: ["trigger_radius"] },
  { text: "WANTED shows a foe on every threat arrow; a HOAX fakes foes on theirs.", words: ["wanted", "hoax"], properties: ["inflict_expose", "decoys"] },
  { text: "A SHRINE gathers faith, a MIRACLE spends 40; deaths by an ALTAR are offerings.", words: ["shrine", "miracle", "altar"], properties: ["faith_output", "faith_cost", "sacrifice"] },
  { text: "A BLIZZARD snows over grass and freezes lakes to walk on; a THAW melts it.", words: ["blizzard", "thaw"], properties: ["tile_type"] },
  { text: "HASTE doubles your side's time; TIMEOUT stops a foe's, but they are unhurt.", words: ["haste", "timeout"], properties: ["inflict_haste", "inflict_stasis"] },
  { text: "REWIND undoes the last 20 s of harm; CENTURY ages a thing for lots of Y.", words: ["rewind", "century"], properties: ["rewinds", "ages"] },
  { text: "LEVITATION floats your side over water and walls; GRAVITY brings flyers down.", words: ["levitation", "gravity"], properties: ["gravity"] },
  { text: "A BOAT launches on near water: E on the shore boards it, R puts you ashore.", words: ["boat"], properties: ["speed_water"] },
  { text: "Fish by water with a ROD or NET: a catch gives its fish's first letter.", words: ["rod", "net"], properties: ["harvest_sources"] },
  { text: "A DUEL stakes 10 letters each in a ring where nobody dies; winner takes all.", words: ["duel"], properties: ["stakes"] },
  { text: "A GAVEL: a truce, untouchable but harmless. PROVOCATION ends it.", words: ["gavel", "provocation"], properties: ["peace"] },
  { text: "NOTHING voids a foe's gear; FATE dooms them unless KARMA or a REPRIEVE.", words: ["nothing", "fate", "karma", "reprieve"], properties: ["inflict_void", "inflict_doom"] },
  { text: "LUCKY adds 12% to every roll you make: gathering, hitting, dodging.", words: ["lucky"], properties: ["luck"] },
];

/** One tip for the idle spell window: a word idea or a rule, alternating at random. */
export function tipOfTheMoment(dict: Dictionary, held: Letters, rng: Rng): string {
  if (rng() < 0.4) return RULE_TIPS[Math.floor(rng() * RULE_TIPS.length)]!.text;
  const idea = wordIdeas(dict, held, rng, 1)[0];
  return idea ? tipText(idea) : RULE_TIPS[0]!.text;
}

/** Whether a rule tip's word is one the dictionary knows (as itself, an inflection or a plural). */
export const knowsWord = (dict: Dictionary, word: string): boolean => !!(dict.lookup(word) ?? readNoun(dict, word));
