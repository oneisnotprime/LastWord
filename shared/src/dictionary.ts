import type { PropertyDef, PropertyFile, Value, WordDef } from "./types.js";

/** The word data the rules run on. Built from plain objects; does no I/O. */
export class Dictionary {
  readonly properties: ReadonlyMap<string, PropertyDef>;
  readonly words: ReadonlyMap<string, WordDef>;

  constructor(propertyFile: PropertyFile, words: Record<string, WordDef>) {
    this.properties = new Map(propertyFile.properties.map((p) => [p.id, p]));
    this.words = new Map(Object.entries(words));
    for (const [word, def] of this.words) {
      for (const id of [...Object.keys(def.set), ...def.ops.map((o) => o[0])]) {
        if (!this.properties.has(id)) throw new Error(`${word}: unknown property ${id}`);
      }
    }
  }

  get size(): number {
    return this.words.size;
  }

  word(word: string): WordDef | undefined {
    return this.words.get(word.toLowerCase());
  }

  /** A word's own value for a property, falling back to the property's default. */
  base(word: string, property: string): Value {
    const prop = this.properties.get(property);
    if (!prop) throw new Error(`unknown property ${property}`);
    return this.word(word)?.set[property] ?? prop.default;
  }
}
