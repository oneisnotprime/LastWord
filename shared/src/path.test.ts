import { describe, expect, it } from "vitest";
import { clearLine, findPath, generateMap, seeded, stampTerrain, stepToward, Tile, walkable, randomWalkable } from "./index.js";

describe("findPath", () => {
  const map = generateMap(42);
  const c = map.cities[0]!;
  const a = { x: c.x - 4.5, y: c.y + 0.5 }, b = { x: c.x + 5.5, y: c.y + 0.5 };

  it("walks straight when nothing is in the way", () => {
    const open = generateMap(42);
    expect(findPath(open, { x: c.x + 0.5, y: c.y + 0.5 }, { x: c.x + 2.5, y: c.y + 0.5 })).toEqual([{ x: c.x + 2.5, y: c.y + 0.5 }]);
  });

  it("goes around a lake, never onto water", () => {
    const m = generateMap(42);
    stampTerrain(m, { x: c.x + 0.5, y: c.y + 0.5, radius: 3, tile: Tile.Water });
    expect(clearLine(m, a, b)).toBe(false);
    const path = findPath(m, a, b);
    expect(path.length).toBeGreaterThan(1);
    expect(path.at(-1)).toEqual(b);
    let prev = a;
    for (const p of path) { expect(clearLine(m, prev, p)).toBe(true); prev = p; }
    // And a walker following it arrives.
    const pos = { ...a };
    for (const p of path) for (let i = 0; i < 400 && !stepToward(m, pos, p, 5, 0.1); i++);
    expect(Math.hypot(pos.x - b.x, pos.y - b.y)).toBeLessThan(0.01);
  });

  it("gets as close as it can to somewhere it cannot stand", () => {
    const sea = { x: 1.5, y: 1.5 };
    const path = findPath(map, { x: c.x + 0.5, y: c.y + 0.5 }, sea);
    expect(path.length).toBeGreaterThan(0);
    const end = path.at(-1)!;
    expect(walkable(map, end.x, end.y)).toBe(true);
  });

  it("is fast enough to run for many walkers", () => {
    const rng = seeded(3), started = performance.now();
    for (let i = 0; i < 50; i++) findPath(map, randomWalkable(map, rng), randomWalkable(map, rng));
    expect((performance.now() - started) / 50).toBeLessThan(15);
  });
});
