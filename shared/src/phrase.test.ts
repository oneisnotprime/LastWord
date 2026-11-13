import { describe, expect, it } from "vitest";
import { missing, parsePhrase, spend } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();

describe("parsePhrase", () => {
  it("reads adjectives then a noun", () => {
    const p = parsePhrase(dict, "  Bigger  SWORD ");
    expect(p).toMatchObject({ noun: "sword", adjectives: ["bigger"], letters: "biggersword" });
    expect(p.stats.num("mass")).toBeCloseTo(1.5 * 8 ** 1.5);
  });

  it("explains what is wrong", () => {
    expect(() => parsePhrase(dict, "")).toThrow("Spell something");
    expect(() => parsePhrase(dict, "sw0rd")).toThrow("sw0rd is not a word");
    expect(() => parsePhrase(dict, "zzz")).toThrow("ZZZ is not in the dictionary yet");
    expect(() => parsePhrase(dict, "sword big")).toThrow("BIG is not a thing");
    expect(() => parsePhrase(dict, "big sharp sword")).toThrow("holds 1 adjective");
  });
});

describe("letters", () => {
  it("lists what is missing and spends what is held", () => {
    const held = { s: 1, w: 1, o: 2, r: 1 };
    expect(missing(held, "sword")).toBe("d");
    expect(missing(held, "roof")).toBe("f");
    expect(missing(held, "row")).toBe("");
    spend(held, "row");
    expect(held).toEqual({ s: 1, w: 0, o: 1, r: 0 });
  });
});
