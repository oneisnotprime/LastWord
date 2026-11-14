import { describe, expect, it } from "vitest";
import {
  countersOf, Deposits, DEPOSITS, eventCard, forbids, generateMap, growthOf, harvest, marketRatio, parsePhrase, placeRules, resolve, seeded,
  Tile, tileAt, tradeProblem, tradeRateOf, yieldOf, type PlaceRules,
} from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const rules = (word: string) => placeRules(dict.word(word)!, resolve(dict, word, []))!;

describe("place rules", () => {
  it("read produce_* and harvest_bonus operations as yields on letters earned inside", () => {
    const drought = rules("drought");
    expect(yieldOf("a", [drought]).mul).toBe(0);
    expect(yieldOf("e", [drought]).mul).toBe(0.5);
    expect(drought.growth).toBe(0.1);
    expect(harvest("aaee", [drought], () => 0.9)).toBe("");
    expect(harvest("aaee", [drought], () => 0.1)).toBe("ee");
    // WAR: kills pay K three times over; a JINX takes most of everything.
    expect(harvest("k", [rules("war")], seeded(1))).toBe("kkk");
    expect(yieldOf("e", [rules("jinx")]).mul).toBeCloseTo(0.2);
    expect(harvest("e", [], seeded(1), 3)).toBe("eee"); // the earner's own harvest_bonus
  });

  it("carry taxes, lodes, market prices and laws", () => {
    expect(rules("tithe").tax).toBe(0.1);
    expect(rules("bonanza")).toMatchObject({ lode: ["x", "z"], lodeShare: 0.5, lodeStock: 12 });
    expect(tradeRateOf([rules("inflation")])).toBe(2);
    expect(marketRatio(tradeRateOf([rules("inflation")]))).toBe(6);
    expect(marketRatio(tradeRateOf([rules("bargain")]))).toBe(1);
    expect(tradeProblem("eee", "o", 6)).toMatch(/takes 6 letters/);
    expect(forbids([rules("truce")], "attack")).toBe(true);
    expect(forbids([rules("curfew")], "gather")).toBe(true);
    expect(growthOf([rules("spring"), rules("drought")])).toBeCloseTo(0.3);
    expect(placeRules(dict.word("sword")!, resolve(dict, "sword", []))).toBeNull();
  });

  it("every concept word parses and does something to letters, acts, bodies or the map", () => {
    const words = ["drought", "harvest", "blight", "bonanza", "tithe", "inflation", "migration", "pilgrimage", "plague", "eclipse", "festival",
      "curfew", "earthquake", "monsoon", "siege", "truce", "war", "hurricane", "swarm", "plunder", "windfall", "spring", "riot", "nightmare", "meteor"];
    for (const w of words) {
      const p = parsePhrase(dict, w);
      expect(p.kind, w).not.toBe("object");
      const card = eventCard(dict, w);
      expect(card.lines.length, w).toBeGreaterThan(0);
    }
  });
});

describe("event cards", () => {
  it("say in plain numbers what WAR changes, and what ends it", () => {
    const card = eventCard(dict, "war");
    expect(card.kind).toBe("event · conflict");
    expect(card.lines).toContain("letters earned here: K ×3, V ×3, D ×2");
    expect(card.lines).toContain("markets closed");
    expect(card.lines).toContain("brings 6 SOLDIERS to fight for its maker");
    expect(card.counters).toEqual(expect.arrayContaining(["peace", "truce", "armistice"]));
  });

  it("day ends night: DAWN and SUN counter an ECLIPSE; RAIN ends a DROUGHT", () => {
    expect(countersOf(dict, "eclipse")).toEqual(expect.arrayContaining(["dawn", "sun"]));
    expect(countersOf(dict, "drought")).toContain("rain");
  });
});

describe("deposits and places", () => {
  const map = generateMap(42);
  const grass = (() => {
    for (let y = 20; y < map.size; y++) for (let x = 20; x < map.size; x++) if (tileAt(map, x + 0.5, y + 0.5) === Tile.Grass) return { x: x + 0.5, y: y + 0.5 };
    throw new Error("no grass");
  })();

  it("deposit_factor strips the ground (0) or fills it past its usual stock", () => {
    const d = new Deposits(map);
    d.scale(grass.x, grass.y, 10, 0, 0);
    expect(d.available(grass.x, grass.y, 0).e).toBeUndefined();
    d.scale(grass.x, grass.y, 10, 0, 3);
    expect(d.available(grass.x, grass.y, 0).e).toBe(DEPOSITS.forage.stock * 3);
  });

  it("growth scales how fast picked ground grows back; 0 never", () => {
    const d = new Deposits(map), rng = seeded(3);
    d.scale(grass.x, grass.y, 1, 0, 0);
    const blight: PlaceRules[] = [{ ...rules("blight") }];
    expect(d.available(grass.x, grass.y, 600, growthOf(blight)).e).toBeUndefined();
    expect(d.gather(grass.x, grass.y, 600, rng, 0)).toMatchObject({ letter: "" });
    expect(d.available(grass.x, grass.y, 660, 2).e).toBe(2); // 60 s at twice the speed: two E
  });
});
