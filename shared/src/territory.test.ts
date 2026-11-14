import { describe, expect, it } from "vitest";
import {
  bossWords, generateMap, LAND_HALF, landHeld, readOffer, readTransmute, roadRun, stampTerrain, stampTiles, taper, Tile, tileAt, transmuteProblem, walkable,
} from "./index.js";
import { demo } from "./testdata.js";

const map = generateMap(42);
const grass = (() => {
  for (let y = 30; y < map.size - 30; y++) for (let x = 30; x < map.size - 30; x++) {
    let ok = true;
    for (let dy = -12; dy <= 12 && ok; dy++) for (let dx = -12; dx <= 12 && ok; dx++) if (!walkable(map, x + dx + 0.5, y + dy + 0.5)) ok = false;
    if (ok) return { x: x + 0.5, y: y + 0.5 };
  }
  throw new Error("no open ground");
})();

describe("land held", () => {
  it("each walkable tile inside your claim is yours; where two owners' claims meet it is contested and pays nobody", () => {
    const alone = landHeld(map, [{ owner: "a", x: grass.x, y: grass.y, radius: 4, born: 0 }], 0).get("a")!;
    expect(alone.tiles).toBeGreaterThan(40);
    expect(alone.contested).toBe(0);
    expect(alone.weight).toBeCloseTo(alone.tiles);
    const both = landHeld(map, [
      { owner: "a", x: grass.x, y: grass.y, radius: 4, born: 0 },
      { owner: "b", x: grass.x + 4, y: grass.y, radius: 4, born: 0 },
    ], 0);
    expect(both.get("a")!.contested).toBeGreaterThan(5);
    expect(both.get("a")!.contested).toBe(both.get("b")!.contested);
    expect(both.get("a")!.tiles).toBe(alone.tiles - both.get("a")!.contested);
  });
  it("a claim's land tires: it pays half after LAND_HALF minutes; two of your own claims over a tile count it once", () => {
    const old = landHeld(map, [{ owner: "a", x: grass.x, y: grass.y, radius: 4, born: 0 }], LAND_HALF * 60).get("a")!;
    expect(old.weight).toBeCloseTo(old.tiles * 0.5);
    const twice = landHeld(map, [
      { owner: "a", x: grass.x, y: grass.y, radius: 4, born: 0 },
      { owner: "a", x: grass.x, y: grass.y, radius: 4, born: 0 },
    ], 0).get("a")!;
    expect(twice.tiles).toBe(old.tiles);
    expect(taper(0, 10)).toBe(1);
  });
});

describe("roads", () => {
  it("a road runs the way its speller faces, longer for a wider word, and stamps a line of tiles", () => {
    const run = roadRun(grass.x, grass.y, 1, 0, 0, map.size);
    expect(run.x2 - run.x).toBeCloseTo(12);
    expect(run.y2).toBeCloseTo(run.y);
    expect(roadRun(grass.x, grass.y, 0, -3, 3, map.size).y2).toBeCloseTo(Math.max(0.5, grass.y - 36));
    const m = generateMap(42);
    const stamp = { ...run, radius: 0, tile: Tile.Road };
    expect(stampTiles(m, stamp).length).toBeGreaterThanOrEqual(12);
    stampTerrain(m, stamp);
    expect(tileAt(m, grass.x + 6, grass.y)).toBe(Tile.Road);
    expect(tileAt(m, grass.x + 6, grass.y + 2)).not.toBe(Tile.Road);
  });
});

describe("trading, transmuting and bosses", () => {
  it("reads typed offers and transmutations", () => {
    expect(readOffer("offer bot3 eee for a")).toEqual({ to: "bot3", give: "eee", get: "a" });
    expect(readOffer("OFFER Bot3 EE for")).toEqual({ to: "Bot3", give: "ee", get: "" });
    expect(readOffer("offer bot3 for")).toBeNull();
    expect(readTransmute("transmute eeeeeeeeee")).toBe("eeeeeeeeee");
    expect(transmuteProblem("eeeeeeeeee", 10)).toBeNull();
    expect(transmuteProblem("eeeee", 10)).toMatch(/10 common letters/);
    expect(transmuteProblem("qeeeeeeeee", 10)).toMatch(/not J, Q, X or Z/);
  });
  it("bosses are wild-hearted creatures a few people can bring down, from the data", () => {
    const words = bossWords(demo());
    expect(words).toEqual(expect.arrayContaining(["giant", "demon"]));
    expect(words).not.toContain("dragon"); // sixty thousand integrity: an army's work, not a few people's
    expect(words).not.toContain("wolf");
  });
});
