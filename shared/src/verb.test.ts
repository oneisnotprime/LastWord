import { describe, expect, it } from "vitest";
import { castVerb, parsePhrase, Stats, Unit } from "./index.js";
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
