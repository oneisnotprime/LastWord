import { describe, expect, it } from "vitest";
import {
  ageRate, EXTRACT_HALF, generateMap, IDEAL, labourBoost, moistureAt, outputOf, parsePhrase, producerOf, Soil, SOIL_DRAIN, SOIL_REGROW, Tile, tileAt, waterNear, windAt,
} from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const spec = (word: string) => producerOf(parsePhrase(dict, word).stats);

describe("what producers make and need, from their data", () => {
  it("each plan letter has its producers and needs", () => {
    expect(spec("hoe")).toMatchObject({ rates: { a: 0.6 }, needs: ["tilled", "water"] });
    expect(spec("dog").rates).toEqual({ i: 0.3 });
    expect(spec("dog").alive).toBe(true);
    expect(spec("oak").needs).toContain("harvest");
    expect(spec("oak").age).toBeGreaterThan(0);
    expect(spec("mill").needs).toEqual(["wind"]);
    expect(spec("press")).toMatchObject({ rates: { m: 0.6 }, uses: ["vowel", "vowel"] });
    expect(spec("kiln")).toMatchObject({ needs: ["labor"], uses: ["g"] });
    expect(spec("bed").needs).toEqual(["claim"]);
    expect(spec("aide").rates).toEqual({ n: 0.5 });
    expect(spec("well").needs).toEqual(["extract"]);
    expect(spec("sword").rates).toEqual({});
  });
});

describe("conditions", () => {
  it("in ideal conditions a producer makes what its data says, more with workers about", () => {
    expect(outputOf(spec("hoe"), IDEAL).rates.a).toBeCloseTo(0.6 * labourBoost(1));
    expect(outputOf(spec("hoe"), { ...IDEAL, labour: 0 }).rates.a).toBeCloseTo(0.6);
    expect(labourBoost(16)).toBe(2);
  });
  it("crops need tilled land and water; furniture a claim; stations someone working them", () => {
    expect(outputOf(spec("corn"), { ...IDEAL, tilled: false }).idle).toBe("needs tilled land");
    expect(outputOf(spec("corn"), { ...IDEAL, moisture: 0 }).idle).toBe("too dry");
    expect(outputOf(spec("corn"), { ...IDEAL, moisture: 0.5, labour: 0 }).rates.a).toBeCloseTo(0.25);
    expect(outputOf(spec("bed"), { ...IDEAL, claimed: false }).idle).toMatch(/claim/);
    expect(outputOf(spec("kiln"), { ...IDEAL, labour: 0 }).idle).toBe("nobody working it");
  });
  it("mills follow the wind; wells run down; machines stop without power; nothing works in a fight; the hungry make nothing", () => {
    expect(outputOf(spec("mill"), { ...IDEAL, wind: 0.5, labour: 0 }).rates.w).toBeCloseTo(0.6);
    expect(outputOf(spec("well"), { ...IDEAL, made: EXTRACT_HALF }).rates.o).toBeCloseTo(0.5);
    expect(outputOf(spec("press"), { ...IDEAL, powered: false }).idle).toMatch(/fuel or power/);
    expect(outputOf(spec("hoe"), { ...IDEAL, peace: false }).idle).toBe("fighting nearby");
    expect(outputOf(spec("cow"), { ...IDEAL, fed: false }).idle).toBe("hungry");
  });
  it("age: Y grows with the square root of the minutes a thing has stood", () => {
    expect(ageRate(0, 0)).toBe(0);
    expect(ageRate(0, 16)).toBeCloseTo(0.04);
    expect(ageRate(0.15, 16)).toBeGreaterThan(ageRate(0, 16) * 10);
  });
  it("the wind rises and falls within its bounds, and differs by map", () => {
    const seen = Array.from({ length: 600 }, (_, t) => windAt(5, t));
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(0.05);
    expect(Math.max(...seen)).toBeLessThanOrEqual(1.06);
    expect(Math.max(...seen) - Math.min(...seen)).toBeGreaterThan(0.5);
    expect(windAt(5, 100)).not.toBe(windAt(6, 100));
  });
});

describe("the ground", () => {
  const map = generateMap(42);
  const find = (ok: (x: number, y: number) => boolean) => {
    for (let y = 0; y < map.size; y++) for (let x = 0; x < map.size; x++) if (ok(x + 0.5, y + 0.5)) return { x: x + 0.5, y: y + 0.5 };
    throw new Error("none");
  };
  it("moisture: wetter by water, a well and rain; sand is dry", () => {
    const dry = find((x, y) => tileAt(map, x, y) === Tile.Grass && !waterNear(map, x, y));
    const shore = find((x, y) => tileAt(map, x, y) === Tile.Grass && waterNear(map, x, y));
    expect(moistureAt(map, dry.x, dry.y, false, false)).toBeCloseTo(0.6);
    expect(moistureAt(map, shore.x, shore.y, false, false)).toBeCloseTo(1.2);
    expect(moistureAt(map, dry.x, dry.y, true, true)).toBe(1.5);
  });
  it("soil wears out as crops take from it, grows back slowly, and compost restores it", () => {
    const at = find((x, y) => tileAt(map, x, y) === Tile.Grass);
    const soil = new Soil(map);
    expect(soil.fertility(at.x, at.y, 0)).toBe(1);
    soil.drain(at.x, at.y, 0, 25);
    expect(soil.fertility(at.x, at.y, 0)).toBeCloseTo(1 - 25 * SOIL_DRAIN);
    expect(soil.fertility(at.x, at.y, 600)).toBeCloseTo(1 - 25 * SOIL_DRAIN + 10 * SOIL_REGROW);
    soil.drain(at.x, at.y, 600, 1000);
    expect(soil.fertility(at.x, at.y, 600)).toBe(0);
    soil.enrich(at.x, at.y, 600, 8);
    expect(soil.fertility(at.x, at.y, 600)).toBeCloseTo(0.8);
  });
});
