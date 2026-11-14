import type { Stats } from "./stats.js";
import { Tile } from "./world.js";

/**
 * Upkeep: food, fuel and power. Each player has a store of each. What they own that has a need
 * (`food_need`, `upkeep_food`, `upkeep_fuel`, `upkeep_power`) draws on it every minute; what
 * they own that supplies (`food_output`, `fuel_output`, `power_output`) fills it. Eating
 * something edible adds its `nutrition`, and gathering on fertile ground finds a little food.
 * Power is counted the same way as the others: `upkeep_power` drawn a minute against
 * `power_output` supplied a minute.
 */
export const SUPPLIES = ["food", "fuel", "power"] as const;
export type Supply = (typeof SUPPLIES)[number];
export type Stores = Record<Supply, number>;

export const noStores = (): Stores => ({ food: 0, fuel: 0, power: 0 });

/** What a person starts with: a little food, nothing else. */
export const STARTING_STORES: Stores = { food: 2, fuel: 0, power: 0 };

/** Minutes of running a newly made machine comes with: a car arrives with a full tank. */
export const STARTING_SUPPLY_MINUTES = 30;

/**
 * What a newly made thing brings into its owner's stores: STARTING_SUPPLY_MINUTES of whatever it
 * draws (fuel, power, food), so a CAR can drive and a RADAR can sweep the moment they are spelled.
 * Living things bring nothing: their master feeds them, and a hungry one turns wild.
 */
export function startingSupply(stats: Stats, count = 1): Stores {
  if (stats.flag("alive")) return noStores();
  const n = needs(stats, count);
  return { food: n.food * STARTING_SUPPLY_MINUTES, fuel: n.fuel * STARTING_SUPPLY_MINUTES, power: n.power * STARTING_SUPPLY_MINUTES };
}

/** Loyalty a creature loses for each minute it goes hungry, and regains for each minute fed. */
export const HUNGER_LOYALTY = 1;
/** Fraction of their integrity a starving person loses each minute. */
export const STARVING = 0.05;

/** What one thing (or `count` of it) needs a minute. */
export function needs(stats: Stats, count = 1): Stores {
  return {
    food: (Math.max(0, stats.num("food_need")) + Math.max(0, stats.num("upkeep_food"))) * count,
    fuel: Math.max(0, stats.num("upkeep_fuel")) * count,
    power: Math.max(0, stats.num("upkeep_power")) * count,
  };
}

/** What one thing (or `count` of it) supplies a minute. */
export function outputs(stats: Stats, count = 1): Stores {
  return {
    food: Math.max(0, stats.num("food_output")) * count,
    fuel: Math.max(0, stats.num("fuel_output")) * count,
    power: Math.max(0, stats.num("power_output")) * count,
  };
}

export const hasAny = (s: Stores): boolean => s.food > 0 || s.fuel > 0 || s.power > 0;

/**
 * Draws `seconds` worth of a need from the stores. Returns the supplies that fell short; what
 * there was is still taken.
 */
export function draw(stores: Stores, need: Stores, seconds: number): Supply[] {
  const short: Supply[] = [];
  for (const k of SUPPLIES) {
    const want = (need[k] * seconds) / 60;
    if (!(want > 0)) continue;
    if (stores[k] + 1e-9 >= want) stores[k] -= want;
    else { stores[k] = 0; short.push(k); }
  }
  return short;
}

/** Adds `seconds` worth of a supply to the stores. */
export function supply(stores: Stores, out: Stores, seconds: number): void {
  for (const k of SUPPLIES) if (out[k] > 0) stores[k] += (out[k] * seconds) / 60;
}

/** Food one gathering action finds on each kind of ground: foraging where things grow. */
const GROUND_FOOD: Partial<Record<Tile, number>> = {
  [Tile.Grass]: 0.1, [Tile.Forest]: 0.15, [Tile.Swamp]: 0.05, [Tile.Field]: 0.2,
};

/** Food a gathering action finds where the player stands. */
export const groundFood = (tile: Tile): number => GROUND_FOOD[tile] ?? 0;

/** Meat a hunted body gives, for each kilogram of its mass raised to MEAT_POWER. */
export const MEAT_PER_KG = 0.3;
/** Bigger bodies give more, but less than in proportion: a cow gives about thirty times a chicken, not three hundred. */
export const MEAT_POWER = 0.6;

/**
 * Food a hunted creature gives the hunter's food store: from its `mass`, so a COW feeds far more
 * than a CHICKEN, times how many it was. Nothing from things that are not alive. Rounded to tenths.
 */
export function carcassFood(stats: Stats, count = 1): number {
  if (!stats.flag("alive")) return 0;
  const mass = Math.max(0, stats.num("mass"));
  return Math.round(MEAT_PER_KG * mass ** MEAT_POWER * Math.max(1, count) * 10) / 10;
}
