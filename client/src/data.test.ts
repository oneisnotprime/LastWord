import { expect, it } from "vitest";
import { parsePhrase } from "@lastword/shared";
import { dictionary } from "./data.js";

it("bundles a dictionary the rules can use", () => {
  expect(dictionary.size).toBeGreaterThanOrEqual(352);
  expect(parsePhrase(dictionary, "biggest sword").stats.num("mass")).toBeCloseTo(96);
});
