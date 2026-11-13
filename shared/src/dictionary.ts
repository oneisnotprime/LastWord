import type { Degree, PropertyDef, PropertyFile, Value, WordDef } from "./types.js";

export interface DictionaryData {
  properties: PropertyFile;
  words: Record<string, WordDef>;
  /** Inflected form -> [base adjective, degree]. */
  inflections?: Record<string, [string, Degree]>;
  /** Degree name -> strength; see operators.json. */
  degrees?: Record<Degree, number>;
}

export interface Lookup {
  word: string;
  def: WordDef;
  degree: Degree;
}

/** The word data the rules run on. Built from plain objects; does no I/O. */
export class Dictionary {
  readonly properties: ReadonlyMap<string, PropertyDef>;
  readonly words: ReadonlyMap<string, WordDef>;
  readonly degrees: Record<Degree, number>;
  private readonly inflections: ReadonlyMap<string, [string, Degree]>;

  constructor(data: DictionaryData) {
    this.properties = new Map(data.properties.properties.map((p) => [p.id, p]));
    this.words = new Map(Object.entries(data.words));
    this.inflections = new Map(Object.entries(data.inflections ?? {}));
    this.degrees = data.degrees ?? { positive: 1, comparative: 1.5, superlative: 2 };
    for (const [word, def] of this.words) {
      for (const id of [...Object.keys(def.set), ...def.ops.map((o) => o[0])]) {
        if (!this.properties.has(id)) throw new Error(`${word}: unknown property ${id}`);
      }
    }
    for (const [form, [base]] of this.inflections) {
      if (!this.words.has(base)) throw new Error(`${form}: unknown base word ${base}`);
    }
  }

  get size(): number {
    return this.words.size;
  }

  word(word: string): WordDef | undefined {
    return this.words.get(word.toLowerCase());
  }

  /** Finds a word or an inflected form of one (BIGGER -> big, comparative). */
  lookup(text: string): Lookup | undefined {
    const word = text.toLowerCase();
    const def = this.words.get(word);
    if (def) return { word, def, degree: "positive" };
    const inflected = this.inflections.get(word);
    if (!inflected) return undefined;
    return { word: inflected[0], def: this.words.get(inflected[0])!, degree: inflected[1] };
  }

  property(id: string): PropertyDef {
    const prop = this.properties.get(id);
    if (!prop) throw new Error(`unknown property ${id}`);
    return prop;
  }

  /** A word's own value for a property, falling back to the property's default. */
  base(word: string, property: string): Value {
    return this.word(word)?.set[property] ?? this.property(property).default;
  }
}
