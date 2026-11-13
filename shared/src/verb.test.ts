import { describe, expect, it } from "vitest";
import { auras, castVerb, parsePhrase, resolve, Stats, Unit, useObject } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();

describe("adverbs", () => {
  it("QUICKLY RUN: half as long, and the doubled speed applies at strength 1.5", () => {
    const run = castVerb(dict, "run");
    const quick = castVerb(dict, "run", ["quickly"]);
    expect(run.stats.num("duration")).toBe(30);
    expect(quick.stats.num("duration")).toBe(15);
    expect(run.ops).toContainEqual(["speed_land", "mul", 2]);
    expect(quick.ops).toContainEqual(["speed_land", "mul", 2 ** 1.5]);
    // Effect properties never land on the body.
    expect(quick.set).not.toHaveProperty("duration");
    expect(quick.set).not.toHaveProperty("effect_multiplier");
  });

  it("FOREVER makes a verb last for ever; SLOWLY makes it three times as long", () => {
    expect(castVerb(dict, "fly", ["forever"]).stats.num("duration")).toBe(Infinity);
    expect(castVerb(dict, "fly", ["slowly"]).stats.num("duration")).toBe(180);
  });

  it("an adverb's other properties add to what the verb does to the body", () => {
    const strong = castVerb(dict, "run", ["strongly"]);
    expect(strong.ops).toContainEqual(["self_damage", "add", 0.1]);
    expect(strong.ops).toContainEqual(["speed_land", "mul", 4]);
  });

  it("the effect multiplier scales what a verb restores", () => {
    expect(castVerb(dict, "heal", ["strongly"]).stats.num("restores")).toBe(400);
  });

  it("one adverb per verb, and adverbs only go with verbs", () => {
    expect(() => castVerb(dict, "run", ["quickly", "slowly"])).toThrow("RUN takes 1 adverb, not 2");
    expect(parsePhrase(dict, "quickly run")).toMatchObject({ kind: "verb", noun: "run", adverbs: ["quickly"], letters: "quicklyrun" });
    expect(() => parsePhrase(dict, "quickly")).toThrow("QUICKLY says how you do something");
    expect(() => parsePhrase(dict, "quickly sword")).toThrow("QUICKLY goes with a verb, not with SWORD");
    expect(() => parsePhrase(dict, "big run")).toThrow("RUN is something you do; it takes an adverb, not BIG");
  });

  it("every verb with every adverb casts onto a body without error", () => {
    const verbs = [...dict.words].filter(([, d]) => d.role === "verb").map(([w]) => w);
    const adverbs = [...dict.words].filter(([, d]) => d.role === "adverb").map(([w]) => w);
    expect(verbs.length).toBeGreaterThan(250);
    expect(adverbs.length).toBeGreaterThan(150);
    for (const v of verbs) {
      for (const a of ["", ...adverbs]) {
        const cast = castVerb(dict, v, a ? [a] : []);
        const body = new Stats(dict);
        for (const [id, value] of Object.entries(cast.set)) body.set(id, value);
        body.apply(cast.ops);
      }
      new Unit(dict, { body: { noun: "human" }, effects: [castVerb(dict, v)] });
    }
  });
});

describe("using objects", () => {
  it("MEDICINE restores, cures and protects for its duration; BREAD only restores; a SWORD does nothing", () => {
    const med = useObject(dict, "medicine")!;
    expect(med.stats.num("restores")).toBe(150);
    expect(med.stats.tags("effect_status")).toEqual(["poison", "bleed", "burn"]);
    expect(med.ops).toEqual([["res_disease", "add", 0.5]]);
    expect(med.set).toEqual({}); // its mass and potency describe the medicine, not you
    expect(useObject(dict, "bread")!.stats.num("restores")).toBe(15);
    expect(useObject(dict, "sword")).toBeNull();
    expect(useObject(dict, "leaf")?.stats.num("nutrition")).toBeGreaterThan(0); // nutrition alone: it feeds your food store
  });
});

describe("auras", () => {
  it("a TORCH lights five tiles and frightens enemies in its holder's sight; a field reaches as far as its radius", () => {
    const torch = auras(resolve(dict, "torch"), 60);
    expect(torch.map((a) => [a.kind, a.radius, a.targets])).toEqual([["light", 20, "all"], ["fear", 60, "enemies"]]);
    expect(torch[0]!.set).toEqual({ night_vision: true });
    expect(torch[1]!.ops).toEqual([["morale", "add", -1]]);
    // BEATS has a field of its own: its fear reaches the field's 50 m, not the holder's sight.
    expect(auras(resolve(dict, "beats"), 60).find((a) => a.kind === "fear")!.radius).toBe(50);
    expect(auras(resolve(dict, "sword"), 60)).toEqual([]);
  });
});
