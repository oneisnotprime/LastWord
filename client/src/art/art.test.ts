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
