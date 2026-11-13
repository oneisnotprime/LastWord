/** A numeric property may be absolute: infinite or total. */
export type Value = number | boolean | string | string[] | "ABS";

export interface PropertyDef {
  id: string;
  group: string;
  type: "num" | "scale" | "frac" | "bool" | "enum" | "tags" | "text";
  default: Value;
  desc: string;
  unit?: string;
  values?: string[];
}

/** [property, operation, amount]: changes a property on whatever the word modifies. */
export type Op = [property: string, op: "mul" | "add", amount: number];

export interface WordDef {
  role: "noun" | "verb" | "adjective" | "adverb";
  class: string;
  archetype: string;
  /** The word's own property values; anything absent is the property's default. */
  set: Record<string, Value>;
  ops: Op[];
}

export interface PropertyFile {
  properties: PropertyDef[];
}
