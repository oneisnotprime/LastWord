import { describe, expect, it } from "vitest";
import {
  breachText, builtBy, cardOf, cooked, cooks, foodText, grow, haggled, HAGGLE_FLOOR, inspectText, isMaterial, jobsOf, outputOf, pactOf,
  parsePhrase, placeRules, producerOf, resolve, resolveSpelled, rotted, rulesText, seeded, SEEDLING, spawn, spoils, strike, susceptibility,
  takeLetters, toxin, useObject, IDEAL,
} from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();
const make = (noun: string, adjectives: string[] = []) => resolve(dict, noun, adjectives);

describe("materials (theme 11)", () => {
  it("a material noun before a noun is a modifier, and remakes the thing out of it", () => {
    expect(isMaterial(dict.word("glass"))).toBe(true);
    expect(isMaterial(dict.word("silk"))).toBe(true); // a fabric
    expect(isMaterial(dict.word("sword"))).toBe(false);
    const glass = make("sword", ["glass"]), steel = make("sword");
    expect(glass.tags("material")).toEqual(["glass"]);
    expect(glass.num("integrity")).toBeLessThan(steel.num("integrity") / 10); // brittle
    expect(glass.num("dmg_slash")).toBeGreaterThan(steel.num("dmg_slash")); // and sharp
    expect(glass.num("brittleness")).toBe(9);
    expect(parsePhrase(dict, "glass sword").stats.num("integrity")).toBeCloseTo(glass.num("integrity"));
  });

  it("IRON DOG is armoured, heavy and slow; PAPER CASTLE burns; GOLD is worth more", () => {
    const dog = make("dog"), iron = make("dog", ["iron"]);
    expect(iron.num("mass")).toBeCloseTo(dog.num("mass") * 7.8);
    expect(iron.num("armor")).toBeGreaterThan(dog.num("armor") + 10);
    expect(iron.num("speed_land")).toBeLessThan(dog.num("speed_land") * 0.7);
    expect(susceptibility(iron, "electric")).toBeGreaterThan(1.5); // carries lightning
    const paper = make("castle", ["paper"]);
    expect(susceptibility(paper, "fire")).toBeGreaterThan(2.5);
    expect(paper.num("integrity")).toBeLessThan(make("castle").num("integrity") / 20);
    expect(make("crown", ["paper"]).num("value")).toBeLessThan(make("crown").num("value"));
  });

  it("adjectives that name a material rewrite the same way; a material's own damage comes with it", () => {
    const wooden = make("sword", ["wooden"]), wood = make("sword", ["wood"]);
    expect(wooden.num("mass")).toBeCloseTo(wood.num("mass"));
    expect(wooden.tags("material")).toEqual(["wood"]);
    expect(make("sword", ["ice"]).num("dmg_cold")).toBeGreaterThan(0);
    expect(make("sword", ["silver"]).num("dmg_holy")).toBeGreaterThan(0);
  });

  it("what a body is made of decides what hurts it, in every strike", () => {
    const hammer = make("hammer");
    const hit = (target: string, adjectives: string[]) => {
      const e = spawn(target, make(target, adjectives));
      e.integrity = 1e9;
      return strike(hammer, e, () => 0).damage;
    };
    expect(hit("wall", ["glass"])).toBeGreaterThan(hit("wall", []) * 2);
    expect(susceptibility(make("castle", ["ice"]), "fire")).toBeGreaterThan(2); // melts
    expect(susceptibility(make("wall", ["stone"]), "fire")).toBeLessThan(1);
    expect(inspectText(dict, "glass sword")).toMatchObject({ card: { does: expect.arrayContaining(["made of glass"]) } });
  });
});

describe("food (theme 8)", () => {
  it("heat cooks raw food into its cooks_into, else COOKED; time rots it", () => {
    expect(cooks(make("oven"))).toBe(true);
    expect(cooks(make("bread"))).toBe(false);
    expect(cooked(dict, { noun: "dough" }, make("dough"))).toEqual({ noun: "bread" });
    const steak = cooked(dict, { noun: "steak" }, make("steak"))!;
    expect(steak.states).toEqual(["cooked"]);
    const done = resolveSpelled(dict, steak);
    expect(done.num("nutrition")).toBe(make("steak").num("nutrition") * 2);
    expect(done.flag("raw")).toBe(false);
    expect(cooked(dict, { noun: "bread" }, make("bread"))).toBeNull();
    expect(spoils(make("steak"), 7)).toBe(true);
    expect(spoils(make("steak"), 1)).toBe(false);
    expect(spoils(make("steak", ["salted"]), 1000)).toBe(false); // preserved: keeps for ever
    const bad = resolveSpelled(dict, rotted(dict, { noun: "steak" })!);
    expect(toxin(bad)).toBeGreaterThan(0);
    expect(foodText(dict, make("dough")).join(" ")).toContain("BREAD");
  });

  it("eating something toxic poisons; a boost lasts its duration", () => {
    expect(useObject(dict, "hemlock")).not.toBeNull();
    expect(toxin(useObject(dict, "hemlock")!.stats)).toBe(60);
    const coffee = useObject(dict, "coffee")!;
    expect(coffee.stats.num("duration")).toBe(300);
    expect(coffee.ops).toContainEqual(["attack_rate", "mul", 1.3]);
  });
});

describe("plants (theme 2)", () => {
  it("a planted thing grows from a seedling to full yield, as fast as the place lets it", () => {
    const oak = producerOf(make("oak"));
    expect(oak.grows).toBeGreaterThan(0);
    expect(producerOf(make("dog")).grows).toBe(0); // moves: not planted
    const half = outputOf(oak, { ...IDEAL, grown: 0.5 }).rates.p!;
    expect(half).toBeCloseTo(outputOf(oak, IDEAL).rates.p! / 2);
    expect(outputOf(oak, { ...IDEAL, grown: 0 }).idle).toBe("still growing");
    const rainy = grow(SEEDLING, 60, 5, 1.5), dry = grow(SEEDLING, 60, 5, 0.1);
    expect(rainy).toBeGreaterThan(dry);
    expect(grow(SEEDLING, 3600, 5, 1)).toBe(1);
  });
});

describe("professions (theme 1)", () => {
  it("jobs come from properties, never names", () => {
    expect(jobsOf(make("scout"))).toContain("scout");
    expect(jobsOf(make("mason"))).toContain("build");
    expect(jobsOf(make("trader"))).toContain("trade");
    expect(jobsOf(make("nurse"))).toContain("heal");
    expect(jobsOf(make("preacher"))).toContain("preach");
    expect(jobsOf(make("farmer"))).toContain("farm");
    expect(jobsOf(make("wolf"))).toEqual([]); // not sentient: no job
    expect(haggled(3, 0.4)).toBeCloseTo(1.8);
    expect(haggled(3, 0.9)).toBeCloseTo(3 * HAGGLE_FLOOR);
    expect(builtBy([])).toBe(1);
    expect(builtBy([2, 2.5])).toBe(2.5);
    const card = cardOf(dict, parsePhrase(dict, "scout"));
    expect(card.does.join(" ")).toContain("J");
  });
});

describe("law (theme 15)", () => {
  it("a law with a fine is read; laws read in plain words", () => {
    const law = placeRules(dict.word("penalty")!, make("penalty"))!;
    expect(law.law).toEqual(["attack"]);
    expect(law.fine).toBe(8);
    expect(rulesText(law).join(" ")).toContain("fine of 8 letters");
    expect(placeRules(dict.word("regulation")!, make("regulation"))!.law).toContain("hunt");
  });

  it("agreements are pacts: aimed at someone, with a penalty", () => {
    const p = parsePhrase(dict, "alliance");
    expect(p.kind).toBe("event");
    expect(pactOf(p.stats)).toMatchObject({ size: 4, minutes: 10, penalty: ["letters", "loyalty", "reputation"] });
    expect(pactOf(make("sword"))).toBeNull();
    expect(breachText(["letters"])).toContain("letters");
    expect(cardOf(dict, p).does.join(" ")).toContain("binds you and 3 others");
    const held = { e: 5, a: 1, z: 1 };
    expect(takeLetters(held, 3, seeded(1))).toBe("eee"); // the commonest first: never the one Z
    expect(held).toEqual({ e: 2, a: 1, z: 1 });
  });
});
