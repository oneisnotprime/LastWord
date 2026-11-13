import { describe, expect, it } from "vitest";
import { generateMap, randomWalkable, seeded, stepToward, Tile, tileAt, TILE_METERS, walkable } from "./index.js";

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
