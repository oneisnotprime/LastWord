import { Dictionary, type PropertyFile, type WordDef } from "@lastword/shared";
import properties from "../../data/properties.json";
import words from "../../data/demo.json";

/** The dictionary bundled with the client. */
export const dictionary = new Dictionary(
  properties as unknown as PropertyFile,
  words as unknown as Record<string, WordDef>,
);
