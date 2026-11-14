import { describe, expect, it } from "vitest";
import { clearLine, generateMap, openGround, roomAround, stepToward, Tile, walkable, type WorldMap } from "./index.js";

/** An all-grass map with water at the given tiles. */
function field(water: [number, number][] = []): WorldMap {
  const map = generateMap(42);
  map.tiles.fill(Tile.Grass);
  for (const [x, y] of water) map.tiles[y * map.size + x] = Tile.Water;
  return map;
}

describe("clearLine", () => {
  it("sees a corner it only clips: sampling every third of a tile missed this one", () => {
    const map = field([[204, 83]]);
    // From the playtest: a car steered west along a shore ran into this tile every tick.
    expect(clearLine(map, { x: 204.79, y: 82.75 }, { x: 201.96, y: 83.76 })).toBe(false);
    expect(clearLine(map, { x: 204.5, y: 82.5 }, { x: 201.5, y: 82.5 })).toBe(true);
  });

  it("does not squeeze diagonally between two blocked tiles", () => {
    const map = field([[11, 10], [10, 11]]);
    expect(clearLine(map, { x: 10.5, y: 10.5 }, { x: 11.5, y: 11.5 })).toBe(false);
  });
});

describe("stepToward", () => {
  it("slides along an edge instead of stopping dead at it", () => {
    const map = field(Array.from({ length: 20 }, (_, i) => [i, 9] as [number, number])); // a shore along y = 9
    const pos = { x: 5.5, y: 10.2 };
    // Steering north-east into the water: keeps moving east along the shore.
    for (let i = 0; i < 10; i++) stepToward(map, pos, { x: pos.x + 3, y: pos.y - 3 }, 5, 0.1);
    expect(pos.x).toBeGreaterThan(6);
    expect(walkable(map, pos.x, pos.y)).toBe(true);
  });

  it("says it is blocked only when it cannot move at all", () => {
    const map = field([[6, 5]]);
    const pos = { x: 5.5, y: 5.5 };
    let blocked = false;
    for (let i = 0; i < 50 && !blocked; i++) blocked = stepToward(map, pos, { x: 9.5, y: 5.5 }, 5, 0.1);
    expect(blocked).toBe(true);
    expect(pos.x).toBeGreaterThan(5.9); // walked up to the water's edge first
    expect(walkable(map, pos.x, pos.y)).toBe(true);
  });

  it("walks out of ground nobody can stand on", () => {
    const map = field([[5, 5]]);
    const pos = { x: 5.5, y: 5.5 };
    stepToward(map, pos, { x: 9.5, y: 5.5 }, 5, 0.1);
    expect(walkable(map, pos.x, pos.y)).toBe(true);
  });

  it("flies along the map's edge rather than stopping at it", () => {
    const map = field();
    const pos = { x: map.size - 0.5, y: 10.5 };
    expect(stepToward(map, pos, { x: map.size + 5, y: 15.5 }, 20, 0.1, true)).toBe(false);
    expect(pos.y).toBeGreaterThan(10.5);
    expect(pos.x).toBeLessThan(map.size);
  });
});

describe("openGround", () => {
  it("never leaves someone in a pocket they cannot step out of", () => {
    // One open tile at (10, 10), boxed in on every side (pits and walls around a player).
    const box: [number, number][] = [];
    for (let y = 8; y <= 12; y++) for (let x = 8; x <= 12; x++) if (!(x === 10 && y === 10)) box.push([x, y]);
    const map = field(box);
    const p = { x: 10.5, y: 10.5 };
    expect(walkable(map, p.x, p.y)).toBe(true);
    expect(roomAround(map, p)).toBe(1);
    const out = openGround(map, p);
    expect(roomAround(map, out)).toBeGreaterThanOrEqual(24);
    expect(Math.hypot(out.x - p.x, out.y - p.y)).toBeLessThan(5);
  });

  it("leaves someone with room to move where they are", () => {
    const map = field();
    const p = { x: 30.2, y: 30.7 };
    expect(openGround(map, p)).toBe(p);
  });
});
