import { describe, expect, it } from "vitest";
import { addLetters, gatherLetter, generateMap, production, resolve, seeded, Tile, tileAt } from "./index.js";
import { demo } from "./testdata.js";

const map = generateMap(42);
const find = (kind: Tile) => {
  for (let y = 0; y < map.size; y++) for (let x = 0; x < map.size; x++) if (tileAt(map, x, y) === kind) return { x: x + 0.5, y: y + 0.5 };
  throw new Error("no such tile");
};
const sample = (at: { x: number; y: number }) => {
  const rng = seeded(5), seen = new Set<string>();
  for (let i = 0; i < 300; i++) seen.add(gatherLetter(map, at.x, at.y, rng));
  return [...seen].sort().join("");
};

describe("gatherLetter", () => {
  it("yields letters that depend on the ground", () => {
    const city = map.cities[0]!;
    expect(sample({ x: city.x + 0.5, y: city.y + 0.5 })).toBe("lnst");
    expect(sample(find(Tile.Road))).toMatch(/r/);
    expect(sample(find(Tile.Hill))).toMatch(/g/);
  });

  it("adds O beside water and yields nothing on water", () => {
    expect(sample(find(Tile.Sand))).toMatch(/o/);
    expect(gatherLetter(map, 0.5, 0.5, seeded(1))).toBe("");
  });
});

describe("production", () => {
  const dict = demo();
  it("reads what an object generates each minute", () => {
    expect(production(resolve(dict, "farm"))).toEqual({ a: 2 });
    expect(production(resolve(dict, "mine"))).toEqual({ g: 1, x: 0.02 });
    expect(production(resolve(dict, "sword"))).toEqual({});
  });
  it("scales with adjectives", () => {
    expect(production(resolve(dict, "farm", ["fertile"])).a).toBe(4);
  });
});

it("adds letters to a hand", () => {
  const held = { a: 1 };
  addLetters(held, "aab");
  expect(held).toEqual({ a: 3, b: 1 });
});
