import { readFileSync } from "node:fs";
import { Dictionary, type KitData } from "@lastword/shared";

const read = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../data/${name}`, import.meta.url), "utf8"));

/** Reads the generated word data from disk. */
export function loadDictionary(): Dictionary {
  return new Dictionary({
    properties: read("properties.json"),
    words: read("demo.json"),
    inflections: read("demo_inflections.json"),
    degrees: read("operators.json").degrees,
  });
}

/** Reads the starting-kit tables (data/kits.json). */
export function loadKits(): KitData {
  return read("kits.json") as KitData;
}
