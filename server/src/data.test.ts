import { expect, it } from "vitest";
import { loadDictionary } from "./data.js";

it("loads the dictionary from the data folder", () => {
  const dict = loadDictionary();
  expect(dict.size).toBe(352);
  expect(dict.word("theft")?.set.transfers_ownership).toBe(true);
});
