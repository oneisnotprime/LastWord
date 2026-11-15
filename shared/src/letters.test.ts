import { describe, expect, it } from "vitest";
import {
  ACTION_LETTERS, addLetters, CHEST_CHANCE, RUIN_X_CHANCE, toolHelp, Deposits, DEPOSITS, depositsAt, destroyLetters, generateMap, killLetters, mainland, MAP_SOURCES,
  LETTER_GUIDE, makesLetter, parsePhrase, PATCH_TILES, PENDING_SOURCES, placeSources, production, readTrade, regionOf, resolve, seeded, SPAWN_APART, spawnPoint, Tile, tileAt, tradeProblem, walkable, marketRatio, rackSwap, exploredSight,
} from "./index.js";
import { demo } from "./testdata.js";

const map = generateMap(42);
const find = (ok: (x: number, y: number) => boolean) => {
  for (let y = 0; y < map.size; y++) for (let x = 0; x < map.size; x++) if (ok(x + 0.5, y + 0.5)) return { x: x + 0.5, y: y + 0.5 };
  throw new Error("no such place");
};
const near = (kind: Tile) => (x: number, y: number) => {
  if (!walkable(map, x, y)) return false;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (tileAt(map, x + dx, y + dy) === kind) return true;
  return false;
};

describe("deposits", () => {
  it("forage anywhere on land, fish by water, dig in hills, caves by mountains; nothing in the water", () => {
    const grass = find((x, y) => tileAt(map, x, y) === Tile.Grass && depositsAt(map, x, y).length === 1);
    expect(depositsAt(map, grass.x, grass.y)).toEqual(["forage"]);
    const shore = find(near(Tile.Water));
    expect(depositsAt(map, shore.x, shore.y)).toContain("fish");
    const foot = find(near(Tile.Mountain));
    expect(depositsAt(map, foot.x, foot.y)).toEqual(expect.arrayContaining(["dig", "cave"]));
    expect(depositsAt(map, 0.5, 0.5)).toEqual([]);
  });

  it("a patch runs out, then grows back slowly; the next patch is fresh", () => {
    const d = new Deposits(map), rng = () => 0; // every try finds something, and the biome's first find (E)
    const grass = find((x, y) => depositsAt(map, x, y).length === 1 && depositsAt(map, x + PATCH_TILES, y).length >= 1);
    const got: string[] = [];
    for (let i = 0; i < DEPOSITS.forage.stock; i++) got.push(d.gather(grass.x, grass.y, 0, rng).letter);
    expect(got.join("")).toBe("e".repeat(DEPOSITS.forage.stock));
    const spent = d.gather(grass.x, grass.y, 1, rng);
    expect(spent.letter).toBe("");
    expect("why" in spent && spent.why).toMatch(/picked clean/);
    expect(d.available(grass.x, grass.y, 1)).toEqual({});
    expect(d.gather(grass.x, grass.y, DEPOSITS.forage.regen + 1, rng).letter).toBe("e");
    expect(d.gather(grass.x + PATCH_TILES, grass.y, 1, rng).letter).toBe("e");
  });

  it("caves are scarce: a patch's U runs out long before its E", () => {
    const d = new Deposits(map), rng = seeded(9);
    const foot = find(near(Tile.Mountain));
    const seen: Record<string, number> = {};
    const sure = () => [{ by: "test", chance: 1 }];
    for (let i = 0; i < 60; i++) { const g = d.gather(foot.x, foot.y, 0, rng, 1, sure); if (g.letter) seen[g.letter] = (seen[g.letter] ?? 0) + 1; }
    expect(seen.u).toBe(DEPOSITS.cave.stock);
    expect(seen.g).toBeGreaterThanOrEqual(DEPOSITS.dig.stock); // hills foraging finds G too
  });

  it("a chest gives its X to whoever digs beside it, often only at the third or fourth dig, and is then gone; the temple grows Q back", () => {
    const d = new Deposits(map), rng = () => 0;
    const at = find((x, y) => tileAt(map, x, y) === Tile.Grass);
    d.addSite({ id: "t1", x: at.x, y: at.y, letter: "x", stock: 2, regen: 0, radius: 2 });
    expect(d.available(at.x + 1, at.y, 0).x).toBe(2);
    expect(d.gather(at.x + 1, at.y, 0, () => 0.99)).toMatchObject({ letter: "", why: "nothing", roll: { chance: CHEST_CHANCE, place: "chest" } });
    expect(d.gather(at.x + 1, at.y, 0, rng)).toMatchObject({ letter: "x", from: "t1" });
    // A SHOVEL (harvest_bonus 2 for dig and chest) adds ten points.
    const shovel = (kind: string) => toolHelp(kind, [{ name: "shovel", stats: resolve(demo(), "shovel") }]);
    expect(d.gather(at.x, at.y, 0, rng, 1, shovel)).toMatchObject({ letter: "x", from: "t1", emptied: "t1", roll: { chance: CHEST_CHANCE + 0.1 } });
    expect(d.gather(at.x, at.y, 0, rng).letter).toBe("e"); // only the ground is left
    d.addSite({ id: "q", x: at.x, y: at.y, letter: "q", stock: 1, regen: 100, radius: 2 }, 0);
    expect(d.gather(at.x, at.y, 0, rng).letter).toBe("q");
    expect(d.gather(at.x, at.y, 50, rng).letter).not.toBe("q");
    expect(d.gather(at.x, at.y, 150, rng).letter).toBe("q");
  });
});

describe("the map's sources", () => {
  const land = mainland(map);
  const places = placeSources(map, seeded(4), land);
  it("a market in every city, one temple, chests, ruins and animals on the mainland", () => {
    expect(places.markets).toHaveLength(map.cities.length);
    expect(places.chests).toHaveLength(MAP_SOURCES.chests);
    expect(places.ruins).toHaveLength(MAP_SOURCES.ruins);
    expect(places.animals.length).toBeGreaterThan(MAP_SOURCES.animals * 0.8);
    for (const p of [places.temple, ...places.chests, ...places.ruins, ...places.animals]) {
      expect(land[Math.floor(p.y) * map.size + Math.floor(p.x)]).toBe(1);
      expect(tileAt(map, p.x, p.y)).not.toBe(Tile.City);
    }
  });
  it("people start far apart and out of cities", () => {
    const rng = seeded(7), taken: { x: number; y: number }[] = [];
    for (let i = 0; i < 8; i++) taken.push(spawnPoint(map, land, taken, rng));
    let closest = Infinity;
    for (const a of taken) for (const b of taken) if (a !== b) closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y));
    expect(closest).toBeGreaterThanOrEqual(SPAWN_APART);
    for (const p of taken) expect(tileAt(map, p.x, p.y)).not.toBe(Tile.City);
  });
  it("regions for exploring are 64 tiles across", () => {
    expect(regionOf(1, 1)).toBe(regionOf(63, 63));
    expect(regionOf(1, 1)).not.toBe(regionOf(65, 1));
  });
});

describe("deeds", () => {
  it("kills pay K for people, V for someone's creature (and K if it was a person), H for the wild", () => {
    expect(killLetters("person", true)).toBe("k");
    expect(killLetters("owned", false)).toBe("v");
    expect(killLetters("owned", true)).toBe("vk");
    expect(killLetters("wild", true)).toBe("h");
  });
  it("destroying pays D, V for someone else's, F when burnt, X for a ruin", () => {
    expect(destroyLetters(false, false, false)).toBe("d");
    expect(destroyLetters(true, true, false)).toBe("dvf");
    expect(destroyLetters(false, false, true)).toBe("dx");
  });
  it("a ruin has its X only one time in four", () => expect(RUIN_X_CHANCE).toBe(0.25));
});

describe("markets", () => {
  it("reads a trade and holds it to any four for one, never the rare letters", () => {
    expect(readTrade("trade eeee for o")).toEqual({ give: "eeee", get: "o" });
    expect(readTrade("TRADE eeeggggk for SA")).toEqual({ give: "eeeggggk", get: "sa" });
    expect(readTrade("trade")).toBeNull();
    expect(tradeProblem("eeee", "o")).toBeNull();
    expect(tradeProblem("zqxj", "o")).toBeNull();
    expect(tradeProblem("eee", "o")).toMatch(/4 letters for each/);
    expect(tradeProblem("eeee", "q")).toMatch(/No market sells Q/);
  });
  it("prices stay whole letters under place rules: a merchant's ×0.75 asks 3, INFLATION 8", () => {
    expect(marketRatio(0.75)).toBe(3);
    expect(marketRatio(2)).toBe(8);
    expect(marketRatio(0.1)).toBe(1);
  });
  it("a rack swap gives as many letters as were held, at everyday frequency, never J Q X Z", () => {
    const out = rackSwap(400, seeded(5));
    expect(out).toHaveLength(400);
    expect(out).not.toMatch(/[jqxz]/);
    expect(out.split("e").length - 1).toBeGreaterThan(out.split("k").length - 1);
    expect(rackSwap(0, seeded(5))).toBe("");
  });
  it("exploring widens sight from 0.7 to 1.1 over eight regions", () => {
    expect(exploredSight(1)).toBeCloseTo(0.7);
    expect(exploredSight(5)).toBeCloseTo(0.9);
    expect(exploredSight(9)).toBeCloseTo(1.1);
    expect(exploredSight(16)).toBeCloseTo(1.1);
  });
});

it("the action letters are the plan's eleven", () => {
  expect([...ACTION_LETTERS].sort().join("")).toBe("deghjkoqtux");
});

describe("production", () => {
  const dict = demo();
  it("reads what an object generates each minute", () => {
    expect(production(resolve(dict, "farm"))).toEqual({ a: 1.6 });
    expect(production(resolve(dict, "mine"))).toEqual({ g: 1 });
    expect(production(resolve(dict, "sword"))).toEqual({});
  });
  it("scales with adjectives", () => {
    expect(production(resolve(dict, "farm", ["fertile"])).a).toBeCloseTo(3.2);
  });
});

it("adds letters to a hand", () => {
  const held = { a: 1 };
  addLetters(held, "aab");
  expect(held).toEqual({ a: 3, b: 1 });
});

describe("the alphabet guide", () => {
  it("says how to get every letter, and every word it names makes that letter", () => {
    const dict = demo();
    expect(Object.keys(LETTER_GUIDE).sort().join("")).toBe("abcdefghijklmnopqrstuvwxyz");
    for (const [letter, how] of Object.entries(LETTER_GUIDE)) {
      expect(how.how.length).toBeLessThanOrEqual(24);
      for (const w of how.words ?? []) expect(makesLetter(dict, w, letter) || (letter === "s" && parsePhrase(dict, w).stats.flag("takes_city")), `${w} makes ${letter}`).toBe(true);
      // A letter with no word that makes it comes from something you do.
      if (!how.words) expect(ACTION_LETTERS + "fvz" + PENDING_SOURCES).toContain(letter);
      if (how.later) expect(PENDING_SOURCES).toContain(letter);
    }
  });

  it("says why gathering would find nothing, before anyone waits for it", () => {
    const d = new Deposits(map), rng = seeded(4);
    expect(d.problem(0.5, 0.5, 0)).toBe("Nothing to gather here");
    const grass = find((x, y) => depositsAt(map, x, y).length === 1 && tileAt(map, x, y) === Tile.Grass);
    expect(d.problem(grass.x, grass.y, 0)).toBeNull();
    for (let i = 0; i < DEPOSITS.forage.stock; i++) d.gather(grass.x, grass.y, 0, () => 0);
    expect(d.problem(grass.x, grass.y, 0)).toMatch(/picked clean/);
  });
});
