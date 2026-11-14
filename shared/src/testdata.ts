import { readFileSync } from "node:fs";
import { Dictionary } from "./dictionary.js";

const read = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../data/${name}`, import.meta.url), "utf8"));

/** The demo dictionary, for tests only. */
export const demo = () =>
  new Dictionary({
    properties: read("properties.json"),
    words: read("demo.json"),
    inflections: read("demo_inflections.json"),
    degrees: read("operators.json").degrees,
  });
export const rawProperties = () => read("properties.json");
/** The starting-kit tables (data/kits.json), for tests only. */
export const kitData = () => read("kits.json");
