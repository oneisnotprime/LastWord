import { describe, expect, it } from "vitest";
import { BIOMES, generateMap, huntYield, pickWild, resolve, roll, rollText, seeded, Tile, toolHelp, wildlife, WALK_COST } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const thing = (word: string) => ({ name: word, stats: resolve(dict, word) });

describe("biomes", () => {
  it("every walkable kind of ground has a biome, and foraging fails most of the time", () => {
    for (const t of Object.keys(WALK_COST).map(Number) as Tile[]) {
      if (WALK_COST[t] !== Infinity) expect(BIOMES[t], Tile[t]).toBeDefined();
    }
    for (const b of Object.values(BIOMES)) {
      expect(b!.forage).toBeLessThanOrEqual(0.35);
      expect(b!.finds).toMatch(/^[a-z]+$/);
    }
    expect(BIOMES[Tile.Desert]!.forage).toBeLessThan(BIOMES[Tile.Jungle]!.forage);
    expect(new Set(BIOMES[Tile.Jungle]!.finds).size).toBeGreaterThan(new Set(BIOMES[Tile.Desert]!.finds).size);
  });

  it("a map is laid out in large regions of each biome", () => {
    const map = generateMap(7);
    // Neighbours agree most of the time: regions, not speckle.
    let same = 0, land = 0;
    for (let i = 0; i < map.tiles.length - 1; i++) if (map.tiles[i]! > Tile.Field) { land++; if (map.tiles[i + 1] === map.tiles[i]) same++; }
    expect(same / land).toBeGreaterThan(0.85);
  });

  it("tools help the gathering their harvest_sources name: a SHOVEL digs, a NET fishes, a BASKET forages", () => {
    expect(toolHelp("dig", [thing("shovel")])).toEqual([{ by: "shovel", chance: 0.1 }]);
    expect(toolHelp("forage", [thing("shovel")])).toEqual([]);
    expect(toolHelp("fish", [thing("net")])[0]!.chance).toBeCloseTo(0.2);
    expect(toolHelp("forage", [thing("basket")])[0]!.chance).toBeCloseTo(0.15);
    expect(toolHelp("forage", [thing("axe")])[0]!.chance).toBeCloseTo(0.1); // wood
  });

  it("a roll says its odds and what made them, for the popup", () => {
    const r = roll(0.35, "jungle", [{ by: "shovel", chance: 0.1 }], () => 0.5);
    expect(r.ok).toBe(false);
    expect(r.chance).toBeCloseTo(0.45);
    expect(rollText(r)).toBe("JUNGLE 35% · +10% SHOVEL");
    expect(roll(0, "desert", [], () => 0.01).ok).toBe(true); // never below 2%
  });

  it("wild animals suit their biome: camels and scorpions in desert, monkeys in jungle, crabs on shore", () => {
    expect(wildlife(dict, "desert").map(([w]) => w)).toEqual(expect.arrayContaining(["camel", "scorpion", "lizard"]));
    expect(wildlife(dict, "jungle").map(([w]) => w)).toEqual(expect.arrayContaining(["monkey", "jaguar", "parrot"]));
    expect(wildlife(dict, "tundra").map(([w]) => w)).toEqual(expect.arrayContaining(["seal", "walrus", "penguin"]));
    expect(wildlife(dict, "shore").map(([w]) => w)).toContain("crab");
    expect(wildlife(dict, "marsh").map(([w]) => w)).toEqual(expect.arrayContaining(["frog", "heron"]));
    for (const b of Object.values(BIOMES)) if (b!.habitat !== "city") expect(wildlife(dict, b!.habitat).length, b!.habitat).toBeGreaterThan(1);
    // The fierce are rarer than the meek.
    const savanna = Object.fromEntries(wildlife(dict, "savanna"));
    expect(savanna.lion!).toBeLessThan(savanna.gazelle!);
    expect(pickWild([], seeded(1))).toBeNull();
  });

  it("a hunt pays H and the animal's first letter, more for big bodies, blades and bows on birds", () => {
    const fox = huntYield("fox", resolve(dict, "fox"), null, [], () => 0.9);
    expect(fox.letters).toBe("hf");
    const cow = huntYield("cow", resolve(dict, "cow"), thing("knife"), [], () => 0.9);
    expect(cow.letters.slice(0, 2)).toBe("hc");
    expect(cow.letters).toHaveLength(4); // big +1, skinned +1
    expect(cow.food).toBe(1.5);
    const duck = huntYield("duck", resolve(dict, "duck"), thing("bow"), [thing("bow")], () => 0.9);
    expect(duck.letters).toHaveLength(4); // bow on a bird +1, hunting gear +1
    // Far-off ground: a JAGUAR may give its J.
    const jaguar = huntYield("jaguar", resolve(dict, "jaguar"), null, [], () => 0.1);
    expect(jaguar.letters).toContain("j");
    expect(jaguar.why.join(" ")).toMatch(/rare J/);
  });
});
