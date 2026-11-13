import { describe, expect, it } from "vitest";
import { resolve } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();

describe("resolve", () => {
  it("gives a bare noun its own values and defaults elsewhere", () => {
    const sword = resolve(dict, "sword");
    expect(sword.num("dmg_slash")).toBe(40);
    expect(sword.num("dmg_fire")).toBe(0);
    expect(sword.get("equip_slot")).toBe("held");
  });

  it("applies an adjective's multipliers and additions", () => {
    const sword = resolve(dict, "sword", ["big"]);
    expect(sword.num("mass")).toBeCloseTo(1.5 * 8);
    expect(sword.num("integrity")).toBeCloseTo(80 * 3);
    expect(resolve(dict, "sword", ["hot"]).num("temperature")).toBe(320);
  });

  it("grades comparatives and superlatives", () => {
    const mass = (adj: string) => resolve(dict, "sword", [adj]).num("mass");
    expect(mass("bigger")).toBeCloseTo(1.5 * 8 ** 1.5);
    expect(mass("biggest")).toBeCloseTo(1.5 * 64);
    expect(mass("big")).toBeLessThan(mass("bigger"));
    expect(resolve(dict, "sword", ["hottest"]).num("temperature")).toBe(20 + 600);
  });

  it("records absolutes and leaves them ungraded", () => {
    const wall = resolve(dict, "wall", ["fireproof"]);
    expect(wall.get("res_fire")).toBe("ABS");
    expect(wall.num("res_fire")).toBe(Infinity);
    expect(wall.absolute("res_fire")).toMatchObject({ side: "defence", specificity: 2, from: "fireproof" });
    expect(wall.get("is_absolute")).toBe(false);
  });

  it("keeps an absolute through later arithmetic", () => {
    const god = resolve(dict, "god", ["big"]);
    expect(god.get("integrity")).toBe("ABS");
  });

  it("enforces the adjective slot limit", () => {
    expect(() => resolve(dict, "sword", ["big", "sharp"])).toThrow("sword holds 1 adjective, not 2");
  });

  it("rejects words in the wrong role", () => {
    expect(() => resolve(dict, "big")).toThrow("big is not a noun");
    expect(() => resolve(dict, "sword", ["hammer"])).toThrow("hammer is not an adjective");
  });
});
