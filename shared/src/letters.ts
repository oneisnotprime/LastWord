import type { Rng } from "./rng.js";
import type { Stats } from "./stats.js";
import type { Letters } from "./phrase.js";
import { Tile, tileAt, type WorldMap } from "./world.js";

/** Seconds one gathering action takes. */
export const GATHER_SECONDS = 2;
/** How close, in tiles, two players must be to hand letters over. */
export const GIVE_RANGE = 3;

/**
 * What gathering by hand yields on each kind of ground. A first pass at the letter sources:
 * vowels from living land, core consonants from cities and roads, G from digging in hills.
 * Letters listed more than once are more likely.
 */
const GROUND: Record<Tile, string> = {
  [Tile.DeepWater]: "",
  [Tile.Water]: "",
  [Tile.Grass]: "eeeeai",
  [Tile.Forest]: "eepph",
  [Tile.Sand]: "eeo",
  [Tile.Hill]: "ggeu",
  [Tile.Mountain]: "",
  [Tile.Road]: "rrrt",
  [Tile.City]: "ssttnnl",
  [Tile.Pit]: "",
  [Tile.Snow]: "ee",
  [Tile.Swamp]: "uuoe",
  [Tile.Lava]: "",
  [Tile.Wall]: "",
};

/** True if any of the eight tiles around a point is of the given kind. */
function beside(map: WorldMap, x: number, y: number, kind: Tile): boolean {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if ((dx || dy) && tileAt(map, x + dx, y + dy) === kind) return true;
    }
  }
  return false;
}

/** The letter one gathering action yields where the player stands. */
export function gatherLetter(map: WorldMap, x: number, y: number, rng: Rng): string {
  let pool = GROUND[tileAt(map, x, y)];
  if (!pool) return ""; // nothing where nobody can stand
  if (beside(map, x, y, Tile.Water) || beside(map, x, y, Tile.DeepWater)) pool += "ooo"; // fishing
  if (beside(map, x, y, Tile.Mountain)) pool += "uug"; // caves
  if (beside(map, x, y, Tile.Lava)) pool += "fff"; // fire
  return pool[Math.floor(rng() * pool.length)]!;
}

/** Letters an object generates each minute, from its produce_* properties. */
export function production(stats: Stats): Letters {
  const out: Letters = {};
  for (const [id] of stats.entries()) {
    if (id.startsWith("produce_")) {
      const rate = stats.num(id);
      if (rate > 0) out[id.slice(8).toLowerCase()] = rate;
    }
  }
  return out;
}

export function addLetters(held: Letters, letters: string): void {
  for (const ch of letters) held[ch] = (held[ch] ?? 0) + 1;
}
