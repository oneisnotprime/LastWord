import { describe, expect, it } from "vitest";
import { applyAdjectives, changes, readDescription, resolve, resolveSpelled } from "./index.js";
import { demo } from "./testdata.js";

const dict = demo();

describe("adjectives spelled alone", () => {
  it("are read only when every word is an adjective", () => {
    expect(readDescription(dict, "worst")).toEqual({ adjectives: ["worst"], letters: "worst" });
    expect(readDescription(dict, " Weak ")).toEqual({ adjectives: ["weak"], letters: "weak" });
    expect(readDescription(dict, "worst sword")).toBeNull();
    expect(readDescription(dict, "run")).toBeNull();
    expect(readDescription(dict, "zzz")).toBeNull();
  });

  it("make the same thing as spelling them with the noun", () => {
    const { spelled } = applyAdjectives(dict, { noun: "sword" }, ["worst"]);
    expect(spelled).toEqual({ noun: "sword", adjectives: ["worst"] });
    expect(resolveSpelled(dict, spelled).entries()).toEqual(resolve(dict, "sword", ["worst"]).entries());
  });

  it("keep a swarm's count", () => {
    const { spelled } = applyAdjectives(dict, { noun: "wolf", count: 20 }, ["weak"]);
    expect(spelled.count).toBe(20);
  });

  it("are refused when the thing has no free adjective slot", () => {
    expect(() => applyAdjectives(dict, { noun: "sword", adjectives: ["sharp"] }, ["worst"])).toThrow("SHARP SWORD cannot take WORST: it holds 1 adjective and has none free");
    expect(() => applyAdjectives(dict, { noun: "sword" }, ["worst", "weak"])).toThrow("room for 1 more adjective, not 2");
  });

  it("say what they changed in plain words, most important first", () => {
    const { changes: said } = applyAdjectives(dict, { noun: "sword" }, ["worst"]);
    expect(said[0]).toBe("integrity ×0.2");
    expect(said[1]).toBe("damage ×0.3");
    expect(said).toContain("accuracy −0.4");
    expect(said.length).toBeLessThanOrEqual(4);
  });

  it("tell flags turned on and absolutes", () => {
    const said = changes(dict, resolve(dict, "wolf"), resolve(dict, "wolf", ["flying"]), 10);
    expect(said.some((s) => s.startsWith("flying speed") || s.startsWith("now "))).toBe(true);
    expect(changes(dict, resolve(dict, "sword"), resolve(dict, "sword", ["indestructible"]), 10)).toContain("now indestructible");
  });
});
