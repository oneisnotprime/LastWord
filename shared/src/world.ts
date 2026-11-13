import { seeded } from "./rng.js";

/** Metres across one map tile. Word properties are in metres; the map is in tiles. */
export const TILE_METERS = 4;

export enum Tile { DeepWater, Water, Sand, Grass, Forest, Hill, Mountain, Road, City, Pit, Snow, Swamp, Lava, Wall }

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
};

/** The `tile_type` property's values, as map tiles. */
export const TILE_TYPES: Record<string, Tile> = {
  water: Tile.Water, deep_water: Tile.DeepWater, hill: Tile.Hill, mountain: Tile.Mountain, pit: Tile.Pit,
  forest: Tile.Forest, field: Tile.Grass, sand: Tile.Sand, snow: Tile.Snow, swamp: Tile.Swamp,
  lava: Tile.Lava, road: Tile.Road, floor: Tile.City, wall: Tile.Wall,
};

/** A change a word made to the map: a disc of one kind of tile. */
export interface Stamp { x: number; y: number; radius: number; tile: Tile }

/** Applies a stamp. Server and client both do this, in the same order, so their maps agree. */
export function stampTerrain(map: WorldMap, s: Stamp): void {
  const r = Math.max(0, s.radius);
  // Only tiles on the map are visited, so a stamp far larger than the map costs no more than the map.
  for (let y = Math.max(0, Math.floor(s.y - r)); y <= Math.min(map.size - 1, Math.floor(s.y + r)); y++) {
    for (let x = Math.max(0, Math.floor(s.x - r)); x <= Math.min(map.size - 1, Math.floor(s.x + r)); x++) {
      if (Math.hypot(x + 0.5 - s.x, y + 0.5 - s.y) <= r + 0.5) map.tiles[y * map.size + x] = s.tile;
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
  const tiles = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Land falls away toward the edges so the map is an island.
      const dx = (x / size) * 2 - 1, dy = (y / size) * 2 - 1;
      const edge = Math.max(Math.abs(dx), Math.abs(dy)) ** 4;
      const h = big(x, y) * 0.7 + small(x, y) * 0.3 - edge * 0.6;
      const m = wet(x, y);
      tiles[y * size + x] =
        h < 0.22 ? Tile.DeepWater : h < 0.3 ? Tile.Water : h < 0.34 ? Tile.Sand
        : h > 0.72 ? Tile.Mountain : h > 0.62 ? Tile.Hill
        : m > 0.58 ? Tile.Forest : Tile.Grass;
    }
  }
  const map: WorldMap = { seed, size, tiles, cities: [] };

  const rng = seeded(seed + 3);
  for (let tries = 0; map.cities.length < cityCount && tries < 2000; tries++) {
    const x = Math.floor(rng() * size), y = Math.floor(rng() * size);
    const t = tileAt(map, x, y);
    const apart = map.cities.every((c) => Math.hypot(c.x - x, c.y - y) > size / 5);
    if ((t === Tile.Grass || t === Tile.Forest) && apart) map.cities.push({ x, y, radius: 5 + Math.floor(rng() * 4) });
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
  // In the air the ground below does not matter, but the map still has edges.
  const cost = flying ? 1 : WALK_COST[tileAt(map, pos.x, pos.y)];
  const reach = (speed / TILE_METERS / cost) * seconds;
  const step = Math.min(distance, reach);
  const nx = pos.x + (dx / distance) * step, ny = pos.y + (dy / distance) * step;
  const inside = nx >= 0 && ny >= 0 && nx < map.size && ny < map.size;
  if (flying ? !inside : !walkable(map, nx, ny)) return true;
  pos.x = nx;
  pos.y = ny;
  return step >= distance;
}
