import type { Rng } from "./rng.js";
import type { Stats } from "./stats.js";
import { Tile, TILE_TYPES, tileAt, type Stamp, type WorldMap } from "./world.js";

/**
 * Weather, climate and seasons (dictionary theme 20). Weather words are map-wide: their `produce_*`
 * operations move letter yields (place.ts), `growth` how fast things grow, `temperature_delta`
 * the air (wear.ts: cold below a body's temp_min), and damage strikes everywhere. Weather's own
 * rule is the ground: a weather word (or a sky word's field) with a `tile_type` lays it in patches
 * while it lasts, PATCHES every PATCH_SECONDS near people, over the ground it can change
 * (`PATCH_FROM`):
 *
 * - snow (SNOW, FROST, BLIZZARD, WINTER): covers grass, meadow, fields and plains, and freezes
 *   shallow water into walkable snow;
 * - water (MONSOON, DELUGE, FLOOD): spills over low ground, only beside water already there;
 * - sand (DROUGHT, HEATWAVE): dries shallow water, marsh and swamp to sand: wells and fish go;
 * - meadow (THAW, SUMMER): melts snow;
 * - desert: turns grass and plains to desert.
 *
 * Counters: the weather words that end each other (`counters`, `clears_weather`).
 */

/** Seconds between rounds of patches. */
export const PATCH_SECONDS = 10;
/** Patches laid each round, near random people. */
export const PATCHES = 2;
/** Tiles from a person within which a patch is laid. */
export const PATCH_RANGE = 30;
/** Radius of a patch, in tiles. */
export const PATCH_RADIUS = [3, 6] as const;

const mask = (...tiles: Tile[]) => tiles.reduce((m, t) => m | (1 << t), 0);
const PLAINS = [Tile.Grass, Tile.Meadow, Tile.Savanna, Tile.Field, Tile.Tundra, Tile.Badlands, Tile.Taiga];

/** What each laid tile may change. A tile with no entry is not laid by weather. */
export const PATCH_FROM: Partial<Record<Tile, number>> = {
  [Tile.Snow]: mask(...PLAINS, Tile.Water, Tile.Marsh, Tile.Swamp),
  [Tile.Water]: mask(Tile.Grass, Tile.Meadow, Tile.Field, Tile.Sand, Tile.Marsh, Tile.Swamp, Tile.Savanna, Tile.Jungle),
  [Tile.Sand]: mask(Tile.Water, Tile.Marsh, Tile.Swamp),
  [Tile.Meadow]: mask(Tile.Snow),
  [Tile.Desert]: mask(Tile.Grass, Tile.Meadow, Tile.Savanna, Tile.Field),
  [Tile.Marsh]: mask(Tile.Grass, Tile.Meadow, Tile.Field),
};

/** The tile a weather word lays in patches, or null. */
export function weatherTile(s: Stats): Tile | null {
  const tile = TILE_TYPES[String(s.get("tile_type"))];
  return tile !== undefined && PATCH_FROM[tile] !== undefined ? tile : null;
}

/** True if a tile within `r` of a point is water (floods spill only beside water). */
function waterNear(map: WorldMap, x: number, y: number, r: number): boolean {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const t = tileAt(map, x + dx, y + dy);
      if ((t === Tile.Water || t === Tile.DeepWater) && x + dx >= 0 && y + dy >= 0 && x + dx < map.size && y + dy < map.size) return true;
    }
  }
  return false;
}

/**
 * One patch of `tile` near a point (a person): a stamp that changes only what the tile may
 * change, somewhere it would change something, or null after a few tries.
 */
export function patchNear(map: WorldMap, tile: Tile, at: { x: number; y: number }, rng: Rng): Stamp | null {
  const only = PATCH_FROM[tile];
  if (only === undefined) return null;
  for (let tries = 0; tries < 6; tries++) {
    const a = rng() * Math.PI * 2, d = rng() * PATCH_RANGE;
    const x = Math.floor(at.x + Math.cos(a) * d) + 0.5, y = Math.floor(at.y + Math.sin(a) * d) + 0.5;
    if (x < 0 || y < 0 || x >= map.size || y >= map.size) continue;
    if (!(only & (1 << tileAt(map, x, y)))) continue;
    if (tile === Tile.Water && !waterNear(map, x, y, 3)) continue;
    const radius = PATCH_RADIUS[0] + Math.floor(rng() * (PATCH_RADIUS[1] - PATCH_RADIUS[0] + 1));
    return { x, y, radius, tile, only };
  }
  return null;
}

const TILE_NAMES: Partial<Record<Tile, string>> = {
  [Tile.Snow]: "covers grass in snow and freezes shallow water", [Tile.Water]: "floods low ground beside water",
  [Tile.Sand]: "dries shallow water and marsh to sand", [Tile.Meadow]: "melts snow", [Tile.Desert]: "turns grassland to desert",
  [Tile.Marsh]: "turns low grassland to marsh",
};

/** Weather's lines for a card. */
export function weatherText(s: Stats): string[] {
  const tile = weatherTile(s);
  if (tile === null || (s.get("sets_weather") === "" && s.get("placement") !== "map" && s.get("placement") !== "region")) return [];
  return [`while it lasts it ${TILE_NAMES[tile]}, in patches near people`];
}
