import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import archetypes from "../../../data/archetypes.json";
import words from "../../../data/demo.json";
import { dictionary } from "../data.js";
import { lookOf } from "./look.js";
import { ARCHETYPES, WORDS } from "./shapes.js";

it("has a silhouette for every archetype a dictionary word has", () => {
  const used = new Set(Object.values(words as Record<string, { archetype: string }>).map((w) => w.archetype));
  const missing = (archetypes as { archetype: string }[]).map((a) => a.archetype).filter((a) => used.has(a) && !ARCHETYPES[a]);
  expect(missing).toEqual([]);
});

it("has per-word shapes for common creature and object words, all of them real words", () => {
  const nouns = Object.keys(WORDS);
  expect(nouns.length).toBeGreaterThanOrEqual(60);
  // Words not spellable yet (not in demo.json) may still have a shape ready, if they are in the lexicon.
  const lexicon = new Set(readFileSync(new URL("../../../data/lexicon.tsv", import.meta.url), "utf8").split("\n").map((l) => l.split("\t")[0]));
  expect(nouns.filter((w) => !dictionary.word(w) && !lexicon.has(w)).join(" ")).toBe("");
  expect(nouns.filter((w) => dictionary.word(w)).length).toBeGreaterThanOrEqual(60);
  for (const w of ["wolf", "dog", "horse", "dragon", "bear", "sword", "gun", "tank", "car", "house", "tree", "chest", "wall"]) expect(WORDS[w]).toBeDefined();
});

it("reads size, fire, cold, colour and stealth from the word data", () => {
  expect(lookOf(dictionary, "huge wolf").scale).toBeGreaterThan(lookOf(dictionary, "wolf").scale * 1.5);
  expect(lookOf(dictionary, "tiny wolf").scale).toBeLessThan(lookOf(dictionary, "wolf").scale);
  expect(lookOf(dictionary, "burning sword").burning).toBe(true);
  expect(lookOf(dictionary, "frozen wolf").frozen).toBe(true);
  expect(lookOf(dictionary, "golden wolf").colour).toBe("#e3b341");
  expect(lookOf(dictionary, "red car").colour).toBe("#c9453f");
  expect(lookOf(dictionary, "invisible dog").invisible).toBe(true);
  expect(lookOf(dictionary, "thousand ants", 1000).count).toBe(1000);
});

it("draws JOHN as a toilet, BAR as an iron bar, MEN and other living groups as several people", () => {
  expect(lookOf(dictionary, "john").shape).toBe(WORDS.toilet);
  expect(lookOf(dictionary, "bar").shape).toBe(WORDS.crowbar);
  expect(lookOf(dictionary, "men").shape).toBe(WORDS.men);
  expect(lookOf(dictionary, "folk").shape.pieces.length).toBeGreaterThan(WORDS.man!.pieces.length * 2);
  expect(dictionary.word("bar")!.archetype).toBe("weapon");
});

it("gives the animals of every biome a shape of their own", () => {
  for (const w of ["camel", "scorpion", "monkey", "jaguar", "parrot", "seal", "walrus", "penguin", "crab", "frog", "heron", "zebra", "lizard"]) expect(WORDS[w], w).toBeDefined();
});

it("lists only generated images that exist, for dictionary words, with aliases to listed words", () => {
  const dir = new URL("../../public/art/words/", import.meta.url);
  const m = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8")) as { words: Record<string, [string, number, number, number[]]>; alias: Record<string, string> };
  const entries = Object.entries(m.words);
  expect(entries.length).toBeGreaterThan(0);
  for (const [w, [file, width, height, top]] of entries) {
    expect(dictionary.word(w), w).toBeDefined();
    expect(Math.max(width, height), w).toBeLessThanOrEqual(128);
    expect(top.length, w).toBe(5);
    expect(readFileSync(new URL(file, dir)).length, file).toBeLessThan(40_000);
  }
  for (const [a, b] of Object.entries(m.alias)) expect(m.words[b], a).toBeDefined();
});

it("sizes a generated image to the shape it replaces", async () => {
  const { rasterSize } = await import("./standee.js");
  const sil = lookOf(dictionary, "wolf").shape;
  const wide = rasterSize({ img: null as never, w: 128, h: 64, top: [0, 0, 0, 0, 0] }, sil);
  const tall = rasterSize({ img: null as never, w: 64, h: 128, top: [0, 0, 0, 0, 0] }, sil);
  expect(wide.w).toBeCloseTo(tall.h);
  expect(wide.w / wide.h).toBeCloseTo(2);
});
