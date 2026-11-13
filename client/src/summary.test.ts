import { expect, it } from "vitest";
import { dictionary } from "./data.js";
import { describe as describeWord } from "./summary.js";

it("describes a known word", () => {
  expect(describeWord(dictionary, "hammer")).toMatch(/^HAMMER: noun, tool, \d+ properties$/);
});

it("names the base of an inflected form", () => {
  expect(describeWord(dictionary, "biggest")).toMatch(/^BIGGEST \(superlative of BIG\): adjective/);
});

it("says when a word is unknown", () => {
  expect(describeWord(dictionary, "zzz")).toBe("ZZZ: not a word yet");
});
