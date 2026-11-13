import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Dictionary } from "./index.js";

const read = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../data/${name}`, import.meta.url), "utf8"));
const dict = new Dictionary(read("properties.json"), read("demo.json"));

describe("Dictionary", () => {
  it("loads the demo words and the property schema", () => {
    expect(dict.size).toBe(351);
    expect(dict.properties.size).toBe(349);
  });

  it("returns a word's own value, else the default", () => {
    expect(dict.base("sword", "dmg_slash")).toBe(40);
    expect(dict.base("sword", "dmg_fire")).toBe(0);
    expect(dict.base("SUN", "placement")).toBe("sky");
    expect(dict.base("god", "integrity")).toBe("ABS");
  });

  it("keeps modifier operations", () => {
    expect(dict.word("big")?.ops).toContainEqual(["mass", "mul", 8]);
  });

  it("rejects a word that uses an unknown property", () => {
    const bad = { x: { role: "noun", class: "artifact", archetype: "tool", set: { nope: 1 }, ops: [] } };
    expect(() => new Dictionary(read("properties.json"), bad as never)).toThrow("unknown property nope");
  });
});
