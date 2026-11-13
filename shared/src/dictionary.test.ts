import { describe, expect, it } from "vitest";
import { Dictionary } from "./index.js";
import { demo, rawProperties } from "./testdata.js";

const dict = demo();

describe("Dictionary", () => {
  it("loads the demo words and the property schema", () => {
    expect(dict.size).toBeGreaterThanOrEqual(352);
    expect(dict.properties.size).toBe(351);
  });

  it("returns a word's own value, else the default", () => {
    expect(dict.base("sword", "dmg_slash")).toBe(40);
    expect(dict.base("sword", "dmg_fire")).toBe(0);
    expect(dict.base("SUN", "placement")).toBe("sky");
    expect(dict.base("vanish", "stealth")).toBe("ABS");
  });

  it("finds inflected forms", () => {
    expect(dict.lookup("BIGGEST")).toMatchObject({ word: "big", degree: "superlative" });
    expect(dict.lookup("big")?.degree).toBe("positive");
    expect(dict.lookup("zzz")).toBeUndefined();
  });

  it("rejects a word that uses an unknown property", () => {
    const words = { x: { role: "noun", class: "artifact", archetype: "tool", set: { nope: 1 }, ops: [] } };
    expect(() => new Dictionary({ properties: rawProperties(), words: words as never })).toThrow(
      "unknown property nope",
    );
  });
});
