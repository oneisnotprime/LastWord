import type { Dictionary } from "./dictionary.js";
import type { Degree, Op, Value, WordDef } from "./types.js";
import { applyMaterial, isMaterial, knownMaterial } from "./material.js";

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

  clone(): Stats {
    const copy = new Stats(this.dict);
    for (const [id, value] of this.values) copy.values.set(id, value);
    copy.absolutes.push(...this.absolutes);
    return copy;
  }

  /** Every property that differs from its default, for sending or showing. */
  entries(): [string, Value][] {
    return [...this.values.entries()];
  }
}

/**
 * Words that may stand before a noun: adjectives, and number words such as THOUSAND or DOZEN
 * (nouns of archetype quantity), which act exactly as adjectives do and take a slot like one.
 */
export function isModifier(def: WordDef): boolean {
  return def.role === "adjective" || (def.role === "noun" && def.archetype === "quantity") || isMaterial(def);
}

export interface Modifier {
  word: string;
  degree: Degree;
}

/**
 * Builds an object from a noun and the adjectives on it, written as the player spells them:
 * resolve(dict, "sword", ["bigger", "sharp"]).
 */
export function resolve(
  dict: Dictionary,
  noun: string,
  adjectives: readonly string[] = [],
  /** Adjectives lent by something else, such as a rider's own; these take no slot. */
  lent: readonly string[] = [],
  /** Values that replace the noun's own before its adjectives apply. */
  own: Record<string, Value> = {},
): Stats {
  const base = dict.lookup(noun);
  if (!base || base.def.role !== "noun") throw new Error(`${noun} is not a noun`);
  const stats = new Stats(dict);
  for (const [id, value] of Object.entries({ ...base.def.set, ...own })) stats.set(id, value);

  const slots = stats.num("adjective_slots");
  if (adjectives.length > slots) {
    throw new Error(`${noun} holds ${slots} adjective${slots === 1 ? "" : "s"}, not ${adjectives.length}`);
  }
  for (const text of [...adjectives, ...lent]) {
    const adj = dict.lookup(text);
    if (!adj || !isModifier(adj.def)) throw new Error(`${text} is not an adjective`);
    const absolute = adj.def.set.is_absolute === true;
    // A material before a noun (GLASS SWORD), or an adjective made of one (WOODEN, GOLDEN), remakes
    // the thing out of it (shared material.ts); the material's own values are not copied over.
    if (isMaterial(adj.def)) {
      applyMaterial(dict, stats, adj.word);
      continue;
    }
    const made = knownMaterial(dict, adj.def.set.material ?? []);
    if (made) applyMaterial(dict, stats, made);
    for (const [id, value] of Object.entries(adj.def.set)) {
      if (META.has(id) || (made && id === "material")) continue;
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

/**
 * Many of one thing as a single body: a swarm of a thousand ants is one walker whose integrity,
 * mass and damage are a thousand ants' worth. This is how large counts are represented, so a
 * MILLION of anything costs the server what one does; it is not a limit on how many there are.
 */
export function massed(stats: Stats, count: number): Stats {
  if (count === 1) return stats;
  const scaled = ["integrity", "mass", ...stats.entries().filter(([id, v]) => id.startsWith("dmg_") && typeof v === "number").map(([id]) => id)];
  stats.apply(scaled.map((id) => [id, "mul", count]));
  return stats;
}
