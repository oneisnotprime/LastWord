import { describe, expect, it } from "vitest";
import { generateMap, nearestWalkable, randomWalkable, seeded, stampTerrain, stepToward, Tile, tileAt, TILE_METERS, walkable } from "./index.js";

describe("generateMap", () => {
  const map = generateMap(42);

  it("is the same for the same seed and different for another", () => {
    expect(generateMap(42).tiles).toEqual(map.tiles);
    expect(generateMap(43).tiles).not.toEqual(map.tiles);
  });

  it("is an island with land, water, cities and roads", () => {
    const count = (t: Tile) => map.tiles.filter((v) => v === t).length;
    const total = map.size * map.size;
    expect(tileAt(map, 0, 0)).toBe(Tile.DeepWater);
    expect(count(Tile.Grass) + count(Tile.Forest)).toBeGreaterThan(total * 0.2);
    expect(count(Tile.DeepWater) + count(Tile.Water)).toBeGreaterThan(total * 0.1);
    expect(map.cities).toHaveLength(5);
    expect(count(Tile.City)).toBeGreaterThan(0);
    expect(count(Tile.Road)).toBeGreaterThan(0);
  });
});

describe("stepToward", () => {
  const map = generateMap(42);
  const city = map.cities[0]!;

  it("moves at the given speed, scaled by terrain", () => {
    const pos = { x: city.x + 0.5, y: city.y + 0.5 };
    stepToward(map, pos, { x: pos.x + 3, y: pos.y }, 5, 1);
    expect(pos.x - (city.x + 0.5)).toBeCloseTo(5 / TILE_METERS / 0.7);
  });

  it("stops at the target", () => {
    const pos = { x: city.x + 0.5, y: city.y + 0.5 };
    expect(stepToward(map, pos, { x: pos.x + 0.1, y: pos.y }, 5, 1)).toBe(true);
    expect(pos.x).toBeCloseTo(city.x + 0.6);
  });

  it("never walks onto water or off the map", () => {
    const rng = seeded(1);
    for (let i = 0; i < 200; i++) {
      const pos = randomWalkable(map, rng);
      const target = { x: rng() * map.size * 1.5 - 30, y: rng() * map.size * 1.5 - 30 };
      for (let t = 0; t < 100; t++) stepToward(map, pos, target, 50, 0.1);
      expect(walkable(map, pos.x, pos.y)).toBe(true);
    }
  });
});

describe("stampTerrain", () => {
  it("lays a disc of tiles and nearestWalkable finds the shore", () => {
    const map = generateMap(42);
    const c = map.cities[0]!;
    const centre = { x: c.x + 0.5, y: c.y + 0.5 };
    stampTerrain(map, { ...centre, radius: 3, tile: Tile.Water });
    expect(tileAt(map, centre.x, centre.y)).toBe(Tile.Water);
    expect(tileAt(map, centre.x + 3, centre.y)).toBe(Tile.Water);
    expect(tileAt(map, centre.x + 5, centre.y)).not.toBe(Tile.Water);
    const shore = nearestWalkable(map, centre);
    expect(walkable(map, shore.x, shore.y)).toBe(true);
    expect(Math.hypot(shore.x - centre.x, shore.y - centre.y)).toBeLessThan(6);
    expect(nearestWalkable(map, shore)).toBe(shore);
  });

  it("with radius 0 changes one tile", () => {
    const map = generateMap(42);
    const before = map.tiles.slice();
    stampTerrain(map, { x: 100.5, y: 100.5, radius: 0, tile: Tile.Lava });
    expect(map.tiles.filter((t, i) => t !== before[i]).length).toBeLessThanOrEqual(1);
    expect(tileAt(map, 100.5, 100.5)).toBe(Tile.Lava);
  });
});

it("flying crosses water at full speed but not the map edge", () => {
  const map = generateMap(42);
  const pos = { x: 1.5, y: 1.5 }; // deep water
  stepToward(map, pos, { x: 5.5, y: 1.5 }, 20, 0.4, true);
  expect(pos.x).toBeCloseTo(1.5 + (20 / TILE_METERS) * 0.4);
  stepToward(map, pos, { x: -10, y: 1.5 }, 2000, 1, true);
  expect(pos.x).toBeGreaterThanOrEqual(0);
});
