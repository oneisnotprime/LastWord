import { seeded } from "./rng.js";

/** Metres across one map tile. Word properties are in metres; the map is in tiles. */
export const TILE_METERS = 4;

/**
 * Kinds of ground. Numbers are sent and stamped by both sides, so new kinds go at the end. Field
 * is tilled land; the kinds after it are biomes laid by `generateMap` (and by terrain words): see
 * shared `biome.ts`.
 */
export enum Tile {
  DeepWater, Water, Sand, Grass, Forest, Hill, Mountain, Road, City, Pit, Snow, Swamp, Lava, Wall, Field,
  Jungle, Desert, Tundra, Savanna, Badlands, Ash, Meadow, Taiga, Marsh,
}

/** Slowdown for walking across a tile; Infinity cannot be walked. */
export const WALK_COST: Record<Tile, number> = {
  [Tile.DeepWater]: Infinity,
  [Tile.Water]: Infinity,
  [Tile.Sand]: 1.3,
  [Tile.Grass]: 1,
  [Tile.Forest]: 2,
  [Tile.Hill]: 2,
  [Tile.Mountain]: Infinity,
  [Tile.Road]: 0.5,
  [Tile.City]: 0.7,
  [Tile.Pit]: Infinity,
  [Tile.Snow]: 2,
  [Tile.Swamp]: 4,
  [Tile.Lava]: Infinity,
  [Tile.Wall]: Infinity,
  [Tile.Field]: 1.2,
  [Tile.Jungle]: 2.2,
  [Tile.Desert]: 1.4,
  [Tile.Tundra]: 1.4,
  [Tile.Savanna]: 1,
  [Tile.Badlands]: 1.5,
  [Tile.Ash]: 1.6,
  [Tile.Meadow]: 1,
  [Tile.Taiga]: 2,
  [Tile.Marsh]: 2.2,
};

/** The `tile_type` property's values, as map tiles. */
export const TILE_TYPES: Record<string, Tile> = {
  water: Tile.Water, deep_water: Tile.DeepWater, hill: Tile.Hill, mountain: Tile.Mountain, pit: Tile.Pit,
  forest: Tile.Forest, field: Tile.Grass, tilled: Tile.Field, sand: Tile.Sand, snow: Tile.Snow, swamp: Tile.Swamp,
  lava: Tile.Lava, road: Tile.Road, floor: Tile.City, wall: Tile.Wall,
  jungle: Tile.Jungle, desert: Tile.Desert, tundra: Tile.Tundra, savanna: Tile.Savanna, badlands: Tile.Badlands,
  ash: Tile.Ash, meadow: Tile.Meadow, taiga: Tile.Taiga, marsh: Tile.Marsh,
};

/** A change a word made to the map: a disc of one kind of tile. */
export interface Stamp { x: number; y: number; radius: number; tile: Tile; soil?: boolean }

/** Ground that can be tilled into crop land: a `soil` stamp changes only these. */
export const SOIL: readonly Tile[] = [
  Tile.Grass, Tile.Forest, Tile.Sand, Tile.Snow, Tile.Swamp, Tile.Hill, Tile.Field,
  Tile.Jungle, Tile.Desert, Tile.Tundra, Tile.Savanna, Tile.Badlands, Tile.Ash, Tile.Meadow, Tile.Taiga, Tile.Marsh,
];

/** Applies a stamp. Server and client both do this, in the same order, so their maps agree. */
export function stampTerrain(map: WorldMap, s: Stamp): void {
  const r = Math.max(0, s.radius);
  // Only tiles on the map are visited, so a stamp far larger than the map costs no more than the map.
  for (let y = Math.max(0, Math.floor(s.y - r)); y <= Math.min(map.size - 1, Math.floor(s.y + r)); y++) {
    for (let x = Math.max(0, Math.floor(s.x - r)); x <= Math.min(map.size - 1, Math.floor(s.x + r)); x++) {
      if (Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) > r + 0.5) continue;
      if (s.soil && !SOIL.includes(map.tiles[y * map.size + x]! as Tile)) continue;
      map.tiles[y * map.size + x] = s.tile;
    }
  }
}

/** The nearest point a walker can stand on, searching outward in rings. */
export function nearestWalkable(map: WorldMap, p: Point): Point {
  if (walkable(map, p.x, p.y)) return p;
  for (let ring = 1; ring < map.size; ring++) {
    let best: Point | null = null, bestDistance = Infinity;
    for (let dy = -ring; dy <= ring; dy++) {
      // Only the ring's edge: whole rows at the top and bottom, two cells on the rows between.
      const edge = dy === -ring || dy === ring;
      for (let dx = -ring; dx <= ring; dx += edge ? 1 : 2 * ring) {
        const q = { x: Math.floor(p.x) + dx + 0.5, y: Math.floor(p.y) + dy + 0.5 };
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bestDistance && walkable(map, q.x, q.y)) { best = q; bestDistance = d; }
      }
    }
    if (best) return best;
  }
  return p;
}

export interface WorldMap {
  seed: number;
  size: number;
  tiles: Uint8Array;
  cities: { x: number; y: number; radius: number }[];
}

export interface Point { x: number; y: number }

/** Tiles of ground a walker must be able to reach from where it is put, or it is boxed in. */
export const OPEN_GROUND = 24;

/** How many tiles can be walked to from `p` (side to side, as routes go), counted up to `need`. */
export function roomAround(map: WorldMap, p: Point, need = OPEN_GROUND): number {
  if (!walkable(map, p.x, p.y)) return 0;
  const seen = new Set<number>(), stack = [Math.floor(p.y) * map.size + Math.floor(p.x)];
  while (stack.length && seen.size < need) {
    const i = stack.pop()!;
    if (seen.has(i)) continue;
    const x = i % map.size, y = (i - x) / map.size;
    if (!walkable(map, x + 0.5, y + 0.5)) continue;
    seen.add(i);
    if (x > 0) stack.push(i - 1);
    if (x < map.size - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - map.size);
    if (y < map.size - 1) stack.push(i + map.size);
  }
  return seen.size;
}

/**
 * The nearest ground with room to move (`roomAround` at least `need`): where someone goes when the
 * land changes under or around them. Plain `nearestWalkable` could leave them in a one-tile pocket
 * between new pits and walls, unable to take a step.
 */
export function openGround(map: WorldMap, p: Point, need = OPEN_GROUND): Point {
  if (roomAround(map, p, need) >= need) return p;
  for (let ring = 1; ring < map.size; ring++) {
    let best: Point | null = null, bestDistance = Infinity;
    for (let dy = -ring; dy <= ring; dy++) {
      const edge = dy === -ring || dy === ring;
      for (let dx = -ring; dx <= ring; dx += edge ? 1 : 2 * ring) {
        const q = { x: Math.floor(p.x) + dx + 0.5, y: Math.floor(p.y) + dy + 0.5 };
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bestDistance && roomAround(map, q, need) >= need) { best = q; bestDistance = d; }
      }
    }
    if (best) return best;
  }
  return nearestWalkable(map, p);
}

export function tileAt(map: WorldMap, x: number, y: number): Tile {
  const tx = Math.floor(x), ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= map.size || ty >= map.size) return Tile.DeepWater;
  return map.tiles[ty * map.size + tx] as Tile;
}

export const walkable = (map: WorldMap, x: number, y: number): boolean =>
  WALK_COST[tileAt(map, x, y)] !== Infinity;

/** Smooth noise in [0, 1) built from a lattice of seeded values. */
function noise(seed: number, size: number, cell: number): (x: number, y: number) => number {
  const rng = seeded(seed);
  const n = Math.ceil(size / cell) + 2;
  const lattice = Float32Array.from({ length: n * n }, () => rng());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const gx = x / cell, gy = y / cell;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = smooth(gx - x0), fy = smooth(gy - y0);
    const at = (i: number, j: number) => lattice[j * n + i]!;
    const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
    const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
    return top * (1 - fy) + bottom * fy;
  };
}

/** Builds a map from a seed. The same seed always gives the same map, on server and client. */
export function generateMap(seed: number, size = 256, cityCount = 5): WorldMap {
  const big = noise(seed, size, 48), small = noise(seed + 1, size, 12), wet = noise(seed + 2, size, 32);
  // Biomes: large, coherent regions from temperature (colder to the north) and moisture, and a
  // few volcanic patches among the high ground.
  const warm = noise(seed + 5, size, 96), damp = noise(seed + 6, size, 72), fire = noise(seed + 7, size, 40);
  const tiles = new Uint8Array(size * size);
  const height = new Float32Array(size * size), heat = new Float32Array(size * size), moist = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Land falls away toward the edges so the map is an island.
      const dx = (x / size) * 2 - 1, dy = (y / size) * 2 - 1;
      const edge = Math.max(Math.abs(dx), Math.abs(dy)) ** 4;
      const i = y * size + x;
      height[i] = big(x, y) * 0.7 + small(x, y) * 0.3 - edge * 0.6;
      heat[i] = warm(x, y) * 0.7 + (y / size) * 0.5; // colder to the north
      moist[i] = wet(x, y) * 0.35 + damp(x, y) * 0.65;
    }
  }
  // Temperature and moisture as ranks over the land, so every map has its share of each biome.
  const land = [...height.keys()].filter((i) => height[i]! >= 0.3);
  const rank = (v: Float32Array) => {
    const out = new Float32Array(size * size);
    const order = land.slice().sort((a, b) => v[a]! - v[b]!);
    order.forEach((i, k) => { out[i] = k / Math.max(1, order.length - 1); });
    return out;
  };
  const heatRank = rank(heat), moistRank = rank(moist);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x, h = height[i]!, t = heatRank[i]!, m = moistRank[i]!;
      const volcanic = fire(x, y) > 0.74 && h > 0.5;
      tiles[y * size + x] =
        h < 0.22 ? Tile.DeepWater : h < 0.3 ? Tile.Water : h < 0.34 ? (t < 0.2 ? Tile.Tundra : Tile.Sand)
        : volcanic ? (h > 0.74 ? Tile.Lava : h > 0.62 ? Tile.Mountain : Tile.Ash)
        : h > 0.72 ? Tile.Mountain : h > 0.62 ? (t < 0.2 ? Tile.Snow : t > 0.6 && m < 0.38 ? Tile.Badlands : Tile.Hill)
        : biomeTile(t, m, h);
    }
  }
  const map: WorldMap = { seed, size, tiles, cities: [] };

  const rng = seeded(seed + 3);
  for (let tries = 0; map.cities.length < cityCount && tries < 2000; tries++) {
    const x = Math.floor(rng() * size), y = Math.floor(rng() * size);
    const t = tileAt(map, x, y);
    const apart = map.cities.every((c) => Math.hypot(c.x - x, c.y - y) > size / 5);
    if (CITY_GROUND.has(t) && apart) map.cities.push({ x, y, radius: 5 + Math.floor(rng() * 4) });
  }
  // Roads first, then cities on top, so a road ends at the city edge.
  for (let i = 1; i < map.cities.length; i++) {
    const a = map.cities[i - 1]!, b = map.cities[i]!;
    const lay = (x: number, y: number) => {
      const t = tileAt(map, x, y);
      if (t !== Tile.DeepWater && t !== Tile.Water) tiles[y * size + x] = Tile.Road; // bridges come later
    };
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) lay(x, a.y);
    for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) lay(b.x, y);
  }
  for (const c of map.cities) {
    for (let y = c.y - c.radius; y <= c.y + c.radius; y++) {
      for (let x = c.x - c.radius; x <= c.x + c.radius; x++) {
        if (x >= 0 && y >= 0 && x < size && y < size && Math.hypot(x - c.x, y - c.y) <= c.radius) {
          tiles[y * size + x] = Tile.City;
        }
      }
    }
  }
  return map;
}

/** Ground a city may be founded on: open, walkable, not too harsh. */
const CITY_GROUND = new Set([Tile.Grass, Tile.Forest, Tile.Meadow, Tile.Savanna, Tile.Taiga, Tile.Desert, Tile.Tundra]);

/**
 * The lowland biome for a temperature, a moisture (both 0 to 1) and a height: cold tundra and
 * taiga, temperate grass, meadow, forest and marsh, hot desert, badlands, savanna and jungle.
 */
export function biomeTile(t: number, m: number, h: number): Tile {
  if (t < 0.2) return m < 0.5 ? Tile.Tundra : Tile.Taiga;
  if (t < 0.6) {
    if (m > 0.78) return h < 0.46 ? Tile.Marsh : Tile.Forest;
    if (m > 0.5) return Tile.Forest;
    return m < 0.25 ? Tile.Grass : Tile.Meadow;
  }
  if (m < 0.38) return h > 0.5 ? Tile.Badlands : Tile.Desert;
  if (m < 0.66) return Tile.Savanna;
  return h < 0.36 ? Tile.Swamp : Tile.Jungle;
}

/** A random walkable point, for spawning. */
export function randomWalkable(map: WorldMap, rng: () => number): Point {
  for (;;) {
    const p = { x: rng() * map.size, y: rng() * map.size };
    if (walkable(map, p.x, p.y)) return p;
  }
}

/**
 * Moves a walker toward its target for `seconds` at `speed` metres a second. Terrain slows it,
 * and it stops at the edge of anything it cannot walk on. Returns true when it has arrived.
 */
export function stepToward(map: WorldMap, pos: Point, target: Point, speed: number, seconds: number, flying = false): boolean {
  const dx = target.x - pos.x, dy = target.y - pos.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1e-6) return true;
  // Somehow standing where nobody can (land laid under you): out to the nearest ground first.
  if (!flying && !walkable(map, pos.x, pos.y)) {
    const ground = nearestWalkable(map, pos);
    pos.x = ground.x;
    pos.y = ground.y;
    return false;
  }
  // In the air the ground below does not matter, but the map still has edges.
  const cost = flying ? 1 : WALK_COST[tileAt(map, pos.x, pos.y)];
  const reach = (speed / TILE_METERS / cost) * seconds;
  const step = Math.min(distance, reach);
  const ux = dx / distance, uy = dy / distance;
  const nx = pos.x + ux * step, ny = pos.y + uy * step;
  const inside = nx >= 0 && ny >= 0 && nx < map.size && ny < map.size;
  if (flying) {
    if (!inside) {
      // Along the map's edge rather than stopped by it.
      const edge = (v: number) => Math.min(map.size - 1e-3, Math.max(0, v));
      const x0 = pos.x, y0 = pos.y;
      pos.x = edge(nx);
      pos.y = edge(ny);
      return Math.hypot(pos.x - x0, pos.y - y0) < 1e-4;
    }
  } else if (!walkable(map, nx, ny)) {
    // Blocked: walk up to the edge, then slide along it on whichever axis is open. Stopping dead
    // at the first corner left a player holding a key going nowhere.
    const x0 = pos.x, y0 = pos.y;
    let left = step;
    for (const cut = Math.min(0.05, step); left >= cut && walkable(map, pos.x + ux * cut, pos.y + uy * cut); left -= cut) {
      pos.x += ux * cut;
      pos.y += uy * cut;
    }
    if (left > 1e-6) {
      if (Math.abs(ux) > 1e-6 && walkable(map, pos.x + ux * left, pos.y)) pos.x += ux * left;
      else if (Math.abs(uy) > 1e-6 && walkable(map, pos.x, pos.y + uy * left)) pos.y += uy * left;
    }
    return Math.hypot(pos.x - x0, pos.y - y0) < 1e-4;
  }
  pos.x = nx;
  pos.y = ny;
  return step >= distance;
}
