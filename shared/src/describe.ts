import type { Dictionary } from "./dictionary.js";
import { resolve, type Stats } from "./stats.js";
import { resolveSpelled, type Spelled } from "./unit.js";

/**
 * Adjectives spelled on their own (WORST, BIG RED): they describe something already in the world,
 * which the speller then points at. Returns the adjectives and the letters they cost, or null if
 * the text is not only adjectives (then it is an ordinary spelling, read by `parsePhrase`).
 */
export function readDescription(dict: Dictionary, text: string): { adjectives: string[]; letters: string } | null {
  const words = text.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length || !words.every((w) => /^[a-z]+$/.test(w) && dict.lookup(w)?.def.role === "adjective")) return null;
  return { adjectives: words, letters: words.join("") };
}

/** How many adjectives a noun holds: its `adjective_slots`. */
export function adjectiveSlots(dict: Dictionary, noun: string): number {
  return resolve(dict, noun).num("adjective_slots");
}

/**
 * Puts adjectives on something already made, exactly as if it had been spelled with them after
 * its own: WORST on a SWORD makes the same thing as spelling WORST SWORD. Throws, with a message
 * fit for the player, if the thing has no room for them (`adjective_slots`). Returns the new
 * spelling and what changed, in plain words.
 */
export function applyAdjectives(dict: Dictionary, s: Spelled, adjectives: readonly string[]): { spelled: Spelled; changes: string[] } {
  const had = s.adjectives ?? [];
  const slots = adjectiveSlots(dict, s.noun);
  const name = [...had, s.noun].join(" ").toUpperCase();
  const words = adjectives.join(" ").toUpperCase();
  if (had.length + adjectives.length > slots) {
    const room = slots - had.length;
    throw new Error(
      room <= 0
        ? `${name} cannot take ${words}: it holds ${slots} adjective${slots === 1 ? "" : "s"} and has none free`
        : `${name} has room for ${room} more adjective${room === 1 ? "" : "s"}, not ${adjectives.length}`,
    );
  }
  const spelled: Spelled = { ...s, adjectives: [...had, ...adjectives] };
  const before = resolveSpelled(dict, s), after = resolveSpelled(dict, spelled);
  return { spelled, changes: changes(dict, before, after) };
}

/** Properties shown first when telling what changed, in this order; the rest by size of change. */
const FIRST = ["integrity", "damage", "speed_land", "speed_air", "strength", "armor", "attack_rate", "accuracy", "critical", "evasion", "mass", "sight_range", "morale", "loyalty"];
/** Plain names for properties whose ids do not read well. */
const NAMES: Record<string, string> = { speed_land: "speed", speed_air: "flying speed", sight_range: "sight", attack_rate: "attack rate", res_fire: "fire resistance" };

const plain = (id: string) =>
  NAMES[id] ?? id.replace(/^dmg_(.*)$/, "$1 damage").replace(/^res_(.*)$/, "$1 resistance").replace(/^inflict_(.*)$/, "inflicts $1").replaceAll("_", " ");
const round = (n: number) => (Math.abs(n) >= 10 ? Math.round(n) : +n.toPrecision(2));

/**
 * What an adjective did to a thing, in plain words, most important first: "integrity ×0.2",
 * "damage ×0.3", "accuracy −0.4", "now flying". Damage of every type changed by the same factor
 * reads as one "damage". At most `limit` lines.
 */
export function changes(dict: Dictionary, before: Stats, after: Stats, limit = 4): string[] {
  const ids = new Set([...before.entries(), ...after.entries()].map(([id]) => id));
  const found: { id: string; text: string; size: number }[] = [];
  const damage: number[] = [];
  for (const id of ids) {
    const a = before.get(id), b = after.get(id);
    if (a === b || JSON.stringify(a) === JSON.stringify(b)) continue;
    if (b === "ABS") { found.push({ id, text: `${plain(id)} total`, size: 100 }); continue; }
    if (typeof a === "number" && typeof b === "number") {
      // Amounts read as a factor (integrity ×0.2); fractions and scales as a step (accuracy −0.4).
      const amount = dict.property(id).type === "num";
      if (amount && a !== 0 && Math.sign(a) === Math.sign(b) && b !== 0) {
        const f = b / a;
        if (id.startsWith("dmg_")) { damage.push(f); continue; }
        found.push({ id, text: `${plain(id)} ×${round(f)}`, size: Math.abs(Math.log(f)) });
      } else {
        const d = b - a;
        found.push({ id, text: `${plain(id)} ${d > 0 ? "+" : "−"}${round(Math.abs(d))}`, size: Math.min(5, Math.abs(d)) });
      }
    } else if (typeof b === "boolean") {
      found.push({ id, text: `${b ? "now" : "no longer"} ${plain(id)}`, size: 3 });
    } else if (typeof b === "string" && b && b !== "none") {
      found.push({ id, text: `${plain(id)}: ${b.replaceAll("_", " ")}`, size: 1 });
    } else if (Array.isArray(b)) {
      const added = b.filter((x) => !(Array.isArray(a) && a.includes(x)));
      if (added.length) found.push({ id, text: `${plain(id)}: ${added.join(", ").replaceAll("_", " ")}`, size: 1 });
    }
  }
  if (damage.length) {
    const same = damage.every((f) => Math.abs(f - damage[0]!) < 1e-9);
    const f = same ? damage[0]! : damage.reduce((x, y) => x * y, 1) ** (1 / damage.length);
    found.push({ id: "damage", text: `damage ×${round(f)}`, size: Math.abs(Math.log(f)) });
  }
  const rank = (id: string) => { const i = FIRST.indexOf(id); return i < 0 ? FIRST.length : i; };
  found.sort((x, y) => rank(x.id) - rank(y.id) || y.size - x.size);
  return found.slice(0, limit).map((f) => f.text);
}
