import type { Dictionary } from "./dictionary.js";
import { resolve, Stats } from "./stats.js";
import type { Op, Value } from "./types.js";

/**
 * Properties that describe a verb's effect itself (how long, how soon, how strong, how much it
 * heals) rather than what it does to a body: everything in the `effect` group, and
 * `extends_duration`.
 */
export function isEffectProperty(dict: Dictionary, id: string): boolean {
  return id === "extends_duration" || dict.property(id).group === "effect";
}

/** A verb as cast, with its adverbs. */
export interface Cast {
  /** The verb's own values with its adverbs applied: duration, restores, effect_status, and any event properties. */
  stats: Stats;
  /** What it does to the body it lands on while it lasts. */
  set: Record<string, Value>;
  ops: Op[];
}

/**
 * Casts a verb with the adverbs on it, written as spelled: castVerb(dict, "run", ["quickly"]).
 *
 * The adverb rule:
 * - Adverb values and operations on effect properties (duration, cast_time, effect_multiplier,
 *   restores, extends_duration...) change the verb itself: QUICKLY halves RUN's duration.
 * - `effect_multiplier` is the strength the verb's own operations apply at, the same way a
 *   comparative adjective grades: a multiplier f becomes f ** m, an added amount a becomes a * m.
 *   It also multiplies what the verb restores. QUICKLY (1.5) makes RUN's doubled speed 2 ** 1.5.
 * - `extends_duration` multiplies the duration.
 * - Anything else an adverb sets or changes is added to what the verb does to the body, for as
 *   long as the verb lasts: SILENTLY's stealth, an adverb's immune_stun.
 * - A verb takes as many adverbs as its `adjective_slots` (1 by default), the same as a noun.
 */
export function castVerb(dict: Dictionary, verb: string, adverbs: readonly string[] = []): Cast {
  const found = dict.lookup(verb);
  if (!found || found.def.role !== "verb") throw new Error(`${verb.toUpperCase()} is not something you do`);
  const def = found.def;
  const stats = new Stats(dict);
  for (const [id, value] of Object.entries(def.set)) stats.set(id, value);
  const slots = stats.num("adjective_slots");
  if (adverbs.length > slots) {
    throw new Error(`${verb.toUpperCase()} takes ${slots} adverb${slots === 1 ? "" : "s"}, not ${adverbs.length}`);
  }
  const set: Record<string, Value> = {};
  for (const [id, value] of Object.entries(def.set)) if (!isEffectProperty(dict, id)) set[id] = value;
  const extra: Op[] = [];
  for (const text of adverbs) {
    const adv = dict.lookup(text);
    if (!adv || adv.def.role !== "adverb") throw new Error(`${text.toUpperCase()} is not an adverb`);
    for (const [id, value] of Object.entries(adv.def.set)) {
      stats.set(id, value);
      if (!isEffectProperty(dict, id)) set[id] = value;
    }
    for (const op of adv.def.ops) {
      if (isEffectProperty(dict, op[0])) stats.apply([op]);
      else extra.push(op);
    }
  }
  const longer = stats.num("extends_duration");
  if (longer !== 1) stats.apply([["duration", "mul", longer]]);
  const m = stats.num("effect_multiplier");
  if (m !== 1) stats.apply([["restores", "mul", m]]);
  const ops: Op[] = [
    ...def.ops.map(([id, op, amount]): Op => [id, op, op === "mul" ? amount ** m : amount * m]),
    ...extra,
  ];
  return { stats, set, ops };
}

/**
 * Body flags a word passes on to whoever it acts on: immunities and a few ways of being
 * (night vision, untargetable, phase, hover). Its other own values describe the word itself.
 */
export function bodyFlags(set: Record<string, Value>): Record<string, Value> {
  const flags: Record<string, Value> = {};
  for (const [k, v] of Object.entries(set)) {
    if (v === true && (k.startsWith("immune_") || ["night_vision", "untargetable", "phase", "hover"].includes(k))) flags[k] = true;
  }
  return flags;
}

/**
 * Using an object (eating BREAD, drinking WINE, taking MEDICINE) works as casting a verb on
 * yourself: it restores `restores` integrity, ends the statuses in `effect_status`, and for its
 * `duration` its operations and body flags act on you, and its `nutrition` goes into your food
 * store; eaten, its `toxicity` poisons you (shared food.ts `toxin`). Returns null if using it would do nothing. Whether it is gone afterwards is its
 * `single_use`; anything eaten for its nutrition is gone too.
 */
export function useObject(dict: Dictionary, noun: string, adjectives: readonly string[] = [], states: readonly string[] = []): Cast | null {
  const def = dict.word(noun);
  if (!def || def.role !== "noun") return null;
  const stats = resolve(dict, noun, adjectives, states);
  const set = bodyFlags(def.set);
  const ops = def.ops;
  const lasting = stats.num("duration") > 0 && (ops.length > 0 || Object.keys(set).length > 0);
  const poisonous = stats.flag("edible") && stats.num("toxicity") > 0; // eaten, it poisons (shared food.ts `toxin`)
  if (!(stats.num("restores") > 0) && !stats.tags("effect_status").length && !lasting && !(stats.num("nutrition") > 0) && !poisonous) return null;
  return { stats, set, ops };
}
