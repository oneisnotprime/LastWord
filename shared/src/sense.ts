import type { Dictionary } from "./dictionary.js";
import type { Stats } from "./stats.js";
import { TILE_METERS } from "./world.js";
import { holdFactor } from "./home.js";

/**
 * Senses: what a word tells its owner and nothing more. A MAP, a COMPASS or a CHART only shows
 * things (`map_reveal`, `detect_letters`, `detect_life`); spelled, it becomes part of its owner's
 * screen, a minimap, instead of an object on the ground. The rule is general: a noun whose own
 * properties are all physical make-up (mass, material, integrity...), where it is carried, and
 * readings that change nothing but what you know is purely informational.
 */
export interface Sense {
  word: string;
  /** Tiles of land shown around you. */
  reveal: number;
  /** Tiles within which letter sources are shown. */
  letters: number;
  /** Tiles within which living things are shown. */
  life: number;
}

/** What a sense shows. */
const READINGS = new Set(["map_reveal", "detect_letters", "detect_life"]);
/** Properties that make a thing do something even if it also shows things: it lights, feeds, poisons, burns. */
const ACTIVE = new Set(["luminosity", "edible", "nutrition", "radioactivity", "toxicity", "corrosiveness", "temperature", "potency", "decay_rate"]);
/** Readings that show more but change nothing (sight itself does: it widens what you are sent). */
const QUIET = new Set(["read_properties", "read_inventory", "detect_stealth", "detect_underground", "tracking", "alarm", "hearing_range", "smell_range"]);
/** Where and how it is carried: no effect of its own. */
const CARRIED = new Set(["equip_slot", "hands_required", "portable", "placement", "placement_range"]);

/**
 * The sense a noun gives as part of its owner's screen, or null if it does anything besides show
 * things. Ranges come from `stats` (the phrase as spelled, adjectives included), its kind from
 * the noun's own properties.
 */
export function senseOf(dict: Dictionary, noun: string, stats: Stats): Sense | null {
  const def = dict.word(noun);
  if (!def || def.role !== "noun") return null;
  const ids = [...Object.keys(def.set), ...def.ops.map((o) => o[0])];
  if (!ids.some((id) => READINGS.has(id))) return null;
  for (const id of ids) {
    if (READINGS.has(id) || QUIET.has(id) || CARRIED.has(id)) continue;
    if (dict.properties.get(id)?.group !== "physical" || ACTIVE.has(id)) return null;
  }
  const tiles = (id: string, unit: number) => {
    const n = stats.num(id);
    return n > 0 ? (Number.isFinite(n) ? n / unit : Infinity) : 0;
  };
  // map_reveal is in tiles; the detect_ ranges are in metres.
  const sense = { word: noun, reveal: tiles("map_reveal", 1), letters: tiles("detect_letters", TILE_METERS), life: tiles("detect_life", TILE_METERS) };
  return sense.reveal || sense.letters || sense.life ? sense : null;
}

/** Several senses as one: the farthest reach of each reading. */
export function combineSenses(senses: readonly Sense[]): Omit<Sense, "word"> {
  return {
    reveal: Math.max(0, ...senses.map((s) => s.reveal)),
    letters: Math.max(0, ...senses.map((s) => s.letters)),
    life: Math.max(0, ...senses.map((s) => s.life)),
  };
}

/**
 * Claimed ground: something with a `claim_radius` (HOME, HOUSE, BASE, FORT, CASTLE, a FLAG, a
 * KING) shelters its owner's side within CLAIM_REACH times that many tiles. Everything of the owner's inside (the
 * owner, their creatures, their things on the ground; not the claim itself, whose walls take the
 * blows) takes `shelter` less damage, and is that much harder to steal (`security`).
 * Shelter is the best of the claim's `cover` and a tenth of its `security`, and at least
 * HOME_GROUND: your own ground always counts for something. Counter it by breaking or stealing
 * what claims it.
 */
export interface Claim {
  /** Tiles. */
  radius: number;
  /** Fraction of damage taken away, 0 to 1. */
  shelter: number;
  /** Added to the security of what lies inside against theft. */
  security: number;
  /** How many times slower enemies' root and silence wear off inside (shared home.ts `holdFactor`); 1 for none. */
  holds: number;
}

/** The least a claim shelters. */
export const HOME_GROUND = 0.25;
/** Claimed ground reaches this many times a word's `claim_radius`: a HOME holds the land around it, not just its own yard. */
export const CLAIM_REACH = 2;

export function claimOf(stats: Stats): Claim | null {
  const radius = stats.num("claim_radius");
  if (!(radius > 0)) return null;
  const security = Math.max(0, stats.num("security"));
  const shelter = Math.min(1, Math.max(HOME_GROUND, stats.num("cover"), security / 10));
  return { radius: radius * CLAIM_REACH, shelter, security: Math.max(security, shelter * 10), holds: holdFactor(stats) };
}
