import { describe, expect, it } from "vitest";
import { countersOf, lasting, parsePhrase, resolve } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const kind = (w: string) => parsePhrase(dict, w).kind;

describe("frequency batch 2: the next thousand most common words", () => {
  it("common words of every part of speech are playable", () => {
    for (const w of ["consist", "pierce", "airplane", "regiment", "harmless", "readily", "daytime", "shotgun", "explode", "misconduct"]) {
      expect(dict.word(w), w).toBeDefined();
    }
    expect(dict.word("pierce")!.role).toBe("verb");
    expect(dict.word("harmless")!.role).toBe("adjective");
    expect(dict.word("readily")!.role).toBe("adverb");
  });

  it("acts aimed at someone are events, states around you fields, units muster soldiers", () => {
    for (const w of ["booking", "compliment", "poisoning", "domination", "redemption"]) expect(kind(w), w).toBe("event");
    for (const w of ["solidarity", "prosperity", "geometry", "slick", "visibility"]) expect(kind(w), w).toBe("field");
    expect(kind("daytime")).toBe("sky");
    for (const w of ["regiment", "brigade", "battalion", "legion"]) expect(dict.word(w)!.set.summons, w).toBe("soldier");
    for (const w of ["airplane", "shotgun", "pickup", "researcher"]) expect(kind(w), w).toBe("object");
  });

  it("counter-words act on meaning: HARMLESS and UNARMED blunt a weapon, PARKED stops a car, SUNK a boat", () => {
    expect(resolve(dict, "shotgun", ["harmless"]).num("dmg_pierce")).toBeLessThan(resolve(dict, "shotgun").num("dmg_pierce") * 0.2);
    expect(resolve(dict, "shotgun", ["unarmed"]).num("dmg_pierce")).toBe(0);
    expect(resolve(dict, "pickup", ["parked"]).num("speed_land")).toBe(0);
    expect(resolve(dict, "boat", ["sunk"]).num("speed_water")).toBe(0);
  });

  it("daytime and night end each other, and REDEMPTION lifts a sealed fate", () => {
    expect(countersOf(dict, "daytime")).toContain("night");
    expect(lasting(dict, "daytime")?.wide).toBe(true);
    expect(dict.word("redemption")!.set.effect_status).toContain("doom");
  });
});
