import { readFileSync } from "node:fs";
import { Dictionary } from "@lastword/shared";

const read = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../data/${name}`, import.meta.url), "utf8"));

/** Reads the generated word data from disk. */
export function loadDictionary(): Dictionary {
  return new Dictionary(read("properties.json"), read("demo.json"));
}
