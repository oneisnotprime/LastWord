import { Dictionary, type DictionaryData } from "@lastword/shared";
import properties from "../../data/properties.json";
import words from "../../data/demo.json";
import inflections from "../../data/demo_inflections.json";
import operators from "../../data/operators.json";
import crude from "../../data/crude.json";

/** The dictionary bundled with the client. */
export const dictionary = new Dictionary({
  properties,
  words,
  inflections,
  degrees: operators.degrees,
  crude,
} as unknown as DictionaryData);
