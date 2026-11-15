import { describe, expect, it } from "vitest";
import { BIOMES, forageOdds, generateMap, pool, huntYield, pickWild, resolve, roll, rollText, seeded, Tile, toolHelp, wildlife, WALK_COST } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const thing = (word: string) => ({ name: word, stats: resolve(dict, word) });

describe("biomes", () => {
  it("every walkable kind of ground has a biome, and foraging finds something more often than not on common ground", () => {
    for (const t of Object.keys(WALK_COST).map(Number) as Tile[]) {
      if (WALK_COST[t] !== Infinity) expect(BIOMES[t], Tile[t]).toBeDefined();
    }
    for (const b of Object.values(BIOMES)) {
      expect(b!.forage).toBeLessThanOrEqual(0.7);
      expect(b!.finds).toMatch(/^[a-z]+$/);
    }
    expect(BIOMES[Tile.Desert]!.forage).toBeLessThan(BIOMES[Tile.Jungle]!.forage);
    for (const t of [Tile.Grass, Tile.Meadow, Tile.Forest, Tile.Jungle]) expect(BIOMES[t]!.forage).toBeGreaterThanOrEqual(0.6);
    expect(new Set(BIOMES[Tile.Jungle]!.finds).size).toBeGreaterThan(new Set(BIOMES[Tile.Grass]!.finds).size);
  });

  it("each biome has its own pool: E about a third, then letters that fit the ground", () => {
    const share = (t: Tile, ch: string) => forageOdds(BIOMES[t]!).find((o) => o.letter === ch)?.pct ?? 0;
    const seen = new Set<string>();
    for (const [t, b] of Object.entries(BIOMES)) {
      const odds = forageOdds(b!);
      expect(b!.finds.length, b!.name).toBe(100);
      expect(b!.finds[0], b!.name).toBe("e"); // the first find is E (tests roll 0)
      expect(odds[0]!.letter, b!.name).toBe("e");
      expect(odds[0]!.pct, b!.name).toBeGreaterThanOrEqual(30);
      expect(odds[0]!.pct, b!.name).toBeLessThanOrEqual(40);
      expect(odds.length, b!.name).toBeGreaterThanOrEqual(6);
      const key = odds.map((o) => o.letter).join("");
      expect(seen.has(key), `${b!.name} ${Tile[Number(t)]}`).toBe(false);
      seen.add(key);
    }
    expect(share(Tile.Forest, "p")).toBeGreaterThan(10);
    expect(share(Tile.Desert, "s")).toBeGreaterThan(20);
    expect(share(Tile.Swamp, "u") + share(Tile.Swamp, "m")).toBeGreaterThan(30);
    expect(share(Tile.Hill, "g")).toBeGreaterThan(20);
    expect(share(Tile.Grass, "a") + share(Tile.Grass, "l") + share(Tile.Grass, "i")).toBeGreaterThan(40);
    expect(share(Tile.Sand, "o")).toBeGreaterThan(20);
    expect(share(Tile.Taiga, "w")).toBeGreaterThan(10);
    expect(() => pool({ e: 50, a: 40 })).toThrow(/90/);
  });

  it("rare letters only on hostile ground, which finds less often; Z only on ash, and never Q", () => {
    const RARE = /[jkvxz]/;
    const hostile = [Tile.Desert, Tile.Badlands, Tile.Tundra, Tile.Snow, Tile.Ash];
    const rare = (t: Tile) => [...BIOMES[t]!.finds].filter((c) => RARE.test(c)).length / 100;
    for (const [t, b] of Object.entries(BIOMES)) {
      expect(b!.finds, b!.name).not.toMatch(/q/);
      if (hostile.includes(Number(t))) {
        expect(rare(Number(t)), b!.name).toBeGreaterThan(0.05);
        expect(b!.forage, b!.name).toBeLessThanOrEqual(0.3);
      } else expect(b!.finds, b!.name).not.toMatch(RARE);
    }
    for (const [t, b] of Object.entries(BIOMES)) if (Number(t) !== Tile.Ash) expect(b!.finds, b!.name).not.toMatch(/z/);
    expect(forageOdds(BIOMES[Tile.Ash]!).find((o) => o.letter === "z")!.pct).toBe(1);
    // The harshest ground gives the most: snow's rare share beats the desert's.
    expect(rare(Tile.Snow)).toBeGreaterThan(rare(Tile.Desert));
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
