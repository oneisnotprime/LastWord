import type { Dictionary } from "./dictionary.js";
import type { Degree, Op, Value } from "./types.js";

/** Properties that describe an adjective itself and are not copied onto its noun. */
const META = new Set(["is_absolute", "absolute_side", "specificity"]);

/** A property an absolute adjective has made total on an object. */
export interface Absolute {
  property: string;
  side: "attack" | "defence" | "none";
  /** Higher is narrower: FIREPROOF (2) outranks IRRESISTIBLE (0). */
  specificity: number;
  from: string;
}

/** An object's resolved properties: what it is after its adjectives are applied. */
export class Stats {
  private readonly values = new Map<string, Value>();
  readonly absolutes: Absolute[] = [];

  constructor(private readonly dict: Dictionary) {}

  get(id: string): Value {
    return this.values.get(id) ?? this.dict.property(id).default;
  }

  set(id: string, value: Value): void {
    this.dict.property(id);
    this.values.set(id, value);
  }

  /** Numeric value; an absolute reads as Infinity, a flag as 0 or 1. */
  num(id: string): number {
    const v = this.get(id);
    if (v === "ABS") return Infinity;
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    throw new Error(`${id} is not numeric`);
  }

  flag(id: string): boolean {
    return this.get(id) === true;
  }

  tags(id: string): string[] {
    const v = this.get(id);
    return Array.isArray(v) ? v : [];
  }

  /** The strongest absolute an object holds on a property, if any. */
  absolute(property: string): Absolute | undefined {
    return this.absolutes
      .filter((a) => a.property === property)
      .sort((a, b) => b.specificity - a.specificity)[0];
  }

  /**
   * Applies multiply and add operations. `strength` is the degree of the word applying them:
   * a multiplier f becomes f ** strength and an added amount a becomes a * strength.
   * An absolute stays absolute whatever is done to it.
   */
  apply(ops: readonly Op[], strength = 1): void {
    for (const [id, op, amount] of ops) {
      const current = this.get(id);
      if (current === "ABS") continue;
      if (typeof current !== "number") throw new Error(`${id} is not numeric`);
      this.set(id, op === "mul" ? current * amount ** strength : current + amount * strength);
    }
  }

  /** Every property that differs from its default, for sending or showing. */
  entries(): [string, Value][] {
    return [...this.values.entries()];
  }
}

export interface Modifier {
  word: string;
  degree: Degree;
}

/**
 * Builds an object from a noun and the adjectives on it, written as the player spells them:
 * resolve(dict, "sword", ["bigger", "sharp"]).
 */
export function resolve(dict: Dictionary, noun: string, adjectives: readonly string[] = []): Stats {
  const base = dict.lookup(noun);
  if (!base || base.def.role !== "noun") throw new Error(`${noun} is not a noun`);
  const stats = new Stats(dict);
  for (const [id, value] of Object.entries(base.def.set)) stats.set(id, value);

  const slots = stats.num("adjective_slots");
  if (adjectives.length > slots) {
    throw new Error(`${noun} holds ${slots} adjective${slots === 1 ? "" : "s"}, not ${adjectives.length}`);
  }
  for (const text of adjectives) {
    const adj = dict.lookup(text);
    if (!adj || adj.def.role !== "adjective") throw new Error(`${text} is not an adjective`);
    const absolute = adj.def.set.is_absolute === true;
    for (const [id, value] of Object.entries(adj.def.set)) {
      if (META.has(id)) continue;
      stats.set(id, value);
      if (absolute && (value === "ABS" || value === true)) {
        stats.absolutes.push({
          property: id,
          side: (adj.def.set.absolute_side as Absolute["side"]) ?? "none",
          specificity: Number(adj.def.set.specificity ?? 0),
          from: adj.word,
        });
      }
    }
    // Absolutes do not grade: there is no "more invincible".
    stats.apply(adj.def.ops, absolute ? 1 : dict.degrees[adj.degree]);
  }
  return stats;
}
