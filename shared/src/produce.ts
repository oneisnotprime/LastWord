import type { Letters } from "./phrase.js";
import type { Stats } from "./stats.js";
import { Tile, tileAt, type WorldMap } from "./world.js";

/**
 * Things you own that make letters (PLAN.md "Letter economy", "Rules that follow"): what a
 * producer makes comes from its `produce_*` values (tools/producers.txt), and how much of it
 * depends on world quantities read the same way for every word, through its `production_needs`:
 *
 * - `tilled`: stands on tilled land (a word with `tile_type=tilled` tills its own).
 * - `water`: yield follows the moisture of the ground (water near, wells, rain).
 * - `labor`: someone of its owner's side who works (`labor`) stands within LABOUR_RANGE.
 * - `wind`: yield follows the wind, which rises and falls over the round (`windAt`).
 * - `flow`: beside running water.
 * - `claim`: inside its owner's claimed ground.
 * - `harvest`: pays once a CYCLE_SECONDS, to its owner's side standing within LABOUR_RANGE.
 * - `extract`: runs down, halving every EXTRACT_HALF letters it gives.
 * - `vowel` or a letter: one used up from its owner for each letter made (a PRESS turns two
 *   vowels into an M; a KILN fires a G into a C).
 *
 * Every producer also needs peace (no blow struck within PEACE_RADIUS for PEACE_SECONDS), a living
 * one needs feeding, a machine its fuel or power, and the soil it grows from runs out (`Soil`).
 * Workers nearby raise what fields, stations, mills and machines make (`labourBoost`).
 * Everything you own on the ground also yields Y as it ages (`ageRate`).
 */
export const NEEDS = ["tilled", "water", "labor", "wind", "flow", "claim", "harvest", "extract"] as const;

/** Tiles from a producer that workers and harvesters reach it. */
export const LABOUR_RANGE = 6;
/** How much workers nearby raise output: 1 + this × √(their labour). */
export const LABOUR_BOOST = 0.25;
/** Seconds between harvests of planted flora and fungus. */
export const CYCLE_SECONDS = 120;
/** Letters an extracting producer (a WELL, a MINE) gives before its yield halves. */
export const EXTRACT_HALF = 24;
/** A blow struck this close, this recently, stops every producer there. */
export const PEACE_RADIUS = 8;
export const PEACE_SECONDS = 20;
/** Y a minute from anything you own on the ground, times the square root of its age in minutes. */
export const AGE_Y = 0.01;
/** Letters used up for each M a machine makes, when it needs vowels. */
export const VOWELS = "aeiou";

/** What a thing produces and what it needs to, read from its properties. */
export interface ProducerSpec {
  /** Letters a minute (Y apart: that is `age`). */
  rates: Letters;
  needs: string[];
  /** Letters used up per letter made: "vowel" or a letter, one each. */
  uses: string[];
  /** Its own `produce_Y`: how much faster than usual it ages into Y. */
  age: number;
  /** Alive: it must be fed. */
  alive: boolean;
  /**
   * Minutes a planted thing takes to grow to full yield (`growth_time` of a rooted living thing:
   * crops, trees, herbs, fungi); 0 for anything already grown. While it grows it yields that
   * share of its letters, and how fast it grows follows the place's `growth` (RAIN, SUMMER,
   * DROUGHT, WINTER) and the soil (shared `grow`).
   */
  grows: number;
}

export function producerOf(stats: Stats, count = 1): ProducerSpec {
  const rates: Letters = {};
  for (const [id] of stats.entries()) {
    if (!/^produce_[A-Z]$/.test(id) || id === "produce_Y") continue;
    const r = stats.num(id);
    if (r > 0) rates[id.slice(8).toLowerCase()] = r * count;
  }
  const tags = stats.tags("production_needs").map((t) => t.toLowerCase());
  return {
    rates,
    needs: tags.filter((t) => (NEEDS as readonly string[]).includes(t)),
    uses: tags.filter((t) => t === "vowel" || /^[a-z]$/.test(t)),
    age: Math.max(0, stats.num("produce_Y")),
    alive: stats.flag("alive"),
    grows: rooted(stats) ? Math.max(0, stats.num("growth_time")) : 0,
  };
}

/** A living thing that does not move: it is planted where it is made. */
const rooted = (s: Stats) => s.flag("alive") && !(Math.max(s.num("speed_land"), s.num("speed_air"), s.num("speed_water")) > 0);

/** Share of full growth a planted thing starts at. */
export const SEEDLING = 0.25;
/** Game minutes of growth per minute of `growth_time`: an OAK (60) is grown in six minutes, WHEAT (5) in thirty seconds. */
export const GROW_PACE = 0.1;

/**
 * How grown a planted thing is after `seconds` more, from `grown` (SEEDLING to 1): full growth
 * takes `minutes` × GROW_PACE at a growth of 1; `growth` is the place's (shared `growthOf`) times the soil's.
 */
export function grow(grown: number, seconds: number, minutes: number, growth: number): number {
  if (!(minutes > 0)) return 1;
  return Math.min(1, grown + (Math.max(0, growth) * seconds) / (60 * minutes * GROW_PACE));
}

/** True if a spec makes any letter by itself (not counting age). */
export const makesLetters = (spec: ProducerSpec): boolean => Object.keys(spec.rates).length > 0;

/** The world around a producer, as the room measures it each second. */
export interface Conditions {
  tilled: boolean;
  /** 0 (desert) to 1.5 (swamp in the rain). */
  moisture: number;
  /** The soil's fertility where it stands, 0 to about 2 (`Soil`). */
  fertility: number;
  /** Labour of its owner's side within LABOUR_RANGE, its owner's own included. */
  labour: number;
  /** 0 to about 1 (`windAt`). */
  wind: number;
  flow: boolean;
  claimed: boolean;
  fed: boolean;
  peace: boolean;
  /** False for a machine out of fuel or power. */
  powered: boolean;
  /** Letters it has given so far, for `extract`. */
  made: number;
  /** For something planted: how grown it is, SEEDLING to 1 (1 if left out). */
  grown?: number;
}

export const IDEAL: Conditions = {
  tilled: true, moisture: 1, fertility: 1, labour: 1, wind: 1, flow: true, claimed: true, fed: true, peace: true, powered: true, made: 0,
};

/** Workers' boost to output: 1 + LABOUR_BOOST × √labour. */
export const labourBoost = (labour: number): number => 1 + LABOUR_BOOST * Math.sqrt(Math.max(0, labour));

/**
 * Letters a minute a producer makes in these conditions, and why it makes nothing if it does not
 * ("needs tilled land", "no wind"). The first reason found is given; output is multiplied by
 * moisture, wind, soil, workers and running down as its needs say.
 */
export function outputOf(spec: ProducerSpec, c: Conditions): { rates: Letters; idle: string | null } {
  const zero = (why: string) => ({ rates: {}, idle: why });
  if (!c.peace) return zero("fighting nearby");
  if (spec.alive && !c.fed) return zero("hungry");
  if (!c.powered) return zero("out of fuel or power");
  const has = (n: string) => spec.needs.includes(n);
  if (has("tilled") && !c.tilled) return zero("needs tilled land");
  if (has("claim") && !c.claimed) return zero("outside your claimed ground");
  if (has("labor") && !(c.labour > 0)) return zero("nobody working it");
  if (has("flow") && !c.flow) return zero("needs running water beside it");
  let mul = 1;
  if (has("water")) mul *= Math.max(0, c.moisture);
  if (has("wind")) mul *= Math.max(0, c.wind);
  if (has("tilled") || has("harvest")) mul *= Math.max(0, c.fertility);
  if (has("extract")) mul *= 0.5 ** (c.made / EXTRACT_HALF);
  if (spec.grows > 0) mul *= Math.max(0, Math.min(1, c.grown ?? 1));
  if (has("tilled") || has("harvest") || has("labor") || has("wind") || has("flow") || spec.uses.length) mul *= labourBoost(c.labour);
  if (!(mul > 0.001)) {
    return zero(spec.grows > 0 && !((c.grown ?? 1) > 0.001) ? "still growing" : has("water") && c.moisture <= 0 ? "too dry" : has("wind") && c.wind <= 0.001 ? "no wind" : has("extract") ? "worked out" : "barren soil");
  }
  const rates: Letters = {};
  for (const [ch, r] of Object.entries(spec.rates)) rates[ch] = r * mul;
  return { rates, idle: null };
}

/** Y a minute from something its owner has had on the ground for `minutes`. */
export function ageRate(produceY: number, minutes: number): number {
  return (AGE_Y + Math.max(0, produceY)) * Math.sqrt(Math.max(0, minutes));
}

/**
 * The wind over the map, 0.05 to about 1.05, rising and falling over a few minutes: two slow
 * waves with phases from the map's seed. Storms and calms act on W through their areas' rules.
 */
export function windAt(seed: number, seconds: number): number {
  const a = (seed % 997) / 997 * Math.PI * 2, b = (seed % 433) / 433 * Math.PI * 2;
  const w = 0.55 + 0.35 * Math.sin((2 * Math.PI * seconds) / 300 + a) + 0.15 * Math.sin((2 * Math.PI * seconds) / 71 + b);
  return Math.max(0.05, w);
}

/** How wet each kind of ground is by itself. */
const DAMP: Partial<Record<Tile, number>> = {
  [Tile.Grass]: 0.6, [Tile.Field]: 0.7, [Tile.Forest]: 0.7, [Tile.Swamp]: 1.2, [Tile.Sand]: 0.15,
  [Tile.Snow]: 0.4, [Tile.Hill]: 0.5, [Tile.City]: 0.3, [Tile.Road]: 0.2,
};
/** Moisture added by open water within WATER_REACH tiles, by a watering thing in reach, and by rain. */
export const WATER_REACH = 3;
export const WATERED = 0.6;
export const RAIN = 0.5;

const isWater = (t: Tile) => t === Tile.Water || t === Tile.DeepWater;

/** True if open water lies within `reach` tiles of a point. */
export function waterNear(map: WorldMap, x: number, y: number, reach = WATER_REACH): boolean {
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    if (dx * dx + dy * dy <= reach * reach && isWater(tileAt(map, x + dx, y + dy))) return true;
  }
  return false;
}

/**
 * Moisture of the ground at a point: the ground's own, more by open water, by a watering thing
 * (a WELL, a PUMP: `water_output`) whose reach covers it, and in the rain.
 */
export function moistureAt(map: WorldMap, x: number, y: number, watered: boolean, raining: boolean): number {
  const own = DAMP[tileAt(map, x, y)] ?? 0;
  return Math.min(1.5, own + (waterNear(map, x, y) ? WATERED : 0) + (watered ? WATERED : 0) + (raining ? RAIN : 0));
}

/** Tiles a watering thing reaches: from its `water_output` in litres a minute. */
export const wateringReach = (waterOutput: number): number => (waterOutput > 0 ? 1 + Math.sqrt(waterOutput) / 2 : 0);

/** True for weather that wets the ground. */
export const wetWeather = (weather: string): boolean => /rain|storm|snow|hail|drizzle|monsoon|deluge|flood|shower/.test(weather);

/** How fertile each kind of ground is before anything is grown on it. */
export const FERTILE: Partial<Record<Tile, number>> = {
  [Tile.Grass]: 1, [Tile.Field]: 1.2, [Tile.Forest]: 1, [Tile.Swamp]: 0.9, [Tile.Sand]: 0.3,
  [Tile.Snow]: 0.2, [Tile.Hill]: 0.6, [Tile.City]: 0.3,
};
/** Fertility one letter grown takes from the soil of its patch, and what grows back a minute. */
export const SOIL_DRAIN = 0.02;
export const SOIL_REGROW = 0.01;
/** Width in tiles of the square patches soil is counted in. */
export const SOIL_TILES = 8;

/**
 * The soil: fertility per SOIL_TILES patch, worn down by every letter crops and flora take
 * from it (SOIL_DRAIN), growing back slowly (SOIL_REGROW a minute), raised by anything with
 * `fertility` put on it (COMPOST, MANURE, a FARM). Worn-out fields are how the map starves.
 */
export class Soil {
  private worn = new Map<number, { worn: number; at: number }>();
  constructor(readonly map: WorldMap) {}

  private key = (x: number, y: number) => Math.floor(y / SOIL_TILES) * 4096 + Math.floor(x / SOIL_TILES);

  private patch(x: number, y: number, now: number) {
    const k = this.key(x, y);
    let p = this.worn.get(k);
    if (!p) this.worn.set(k, (p = { worn: 0, at: now }));
    if (now > p.at) {
      if (p.worn > 0) p.worn = Math.max(0, p.worn - ((now - p.at) / 60) * SOIL_REGROW);
      p.at = now;
    }
    return p;
  }

  /** Fertility at a point now: the ground's own, less what has been taken (more if enriched). */
  fertility(x: number, y: number, now: number): number {
    return Math.max(0, (FERTILE[tileAt(this.map, x, y)] ?? 0) * (1 - this.patch(x, y, now).worn));
  }

  /** Takes `letters` grown at a point out of its patch. */
  drain(x: number, y: number, now: number, letters: number): void {
    const p = this.patch(x, y, now);
    p.worn = Math.min(1, p.worn + letters * SOIL_DRAIN);
  }

  /** Enriches a patch by something with `fertility` (0 to 10) put on it: a tenth of it, as fertility above the ground's own. */
  enrich(x: number, y: number, now: number, fertility: number): void {
    const p = this.patch(x, y, now);
    p.worn -= Math.max(0, fertility) / 10;
  }
}

const NEED_TEXT: Record<string, string> = {
  tilled: "on tilled land", water: "more where it is wet", labor: "while someone works it", wind: "with the wind",
  flow: "beside running water", claim: "inside your claim", harvest: "harvested by you or a worker close by", extract: "running down as it gives",
};

/** What a producer needs, in a few words: "on tilled land, more where it is wet; uses 2 vowels a letter". */
export function needsText(spec: ProducerSpec): string {
  const parts = spec.needs.map((n) => NEED_TEXT[n] ?? n);
  if (spec.uses.length) {
    const counts = new Map<string, number>();
    for (const u of spec.uses) counts.set(u, (counts.get(u) ?? 0) + 1);
    parts.push(`uses ${[...counts].map(([u, n]) => `${n} ${u === "vowel" ? `vowel${n > 1 ? "s" : ""}` : u.toUpperCase()}`).join(" and ")} a letter`);
  }
  if (spec.alive) parts.push("fed");
  return parts.join(", ");
}

/** One line of what a producer is doing, for the loadout: "FARM: A 1.2/min", "MILL: no wind". */
export function producingLine(what: string, rates: Letters, idle: string | null): string {
  if (idle) return `${what}: ${idle}`;
  const parts = Object.entries(rates).filter(([, r]) => r > 0).map(([ch, r]) => `${ch.toUpperCase()} ${+r.toFixed(2)}/min`);
  return `${what}: ${parts.join(", ") || "nothing yet"}`;
}
