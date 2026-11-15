import type { Stats } from "./stats.js";
import { susceptibility } from "./material.js";
import { DAMAGE_TYPES } from "./status.js";

/**
 * Damage types and natures (concept batch: combat). Every body has natures (`nature`: what kind
 * of body it is for damage), given by tools/derive.py from its class, its first material, its own
 * properties and its meaning: a WOLF is a beast, a SWORD metal, a HOUSE stone, a GHOST a spirit, a
 * VAMPIRE undead and a demon. Adjectives add theirs (a FIERY WOLF is fire too), a material before a
 * noun replaces its material nature (a GLASS SWORD is glass). NATURE_MATRIX says how much of each
 * damage type each nature takes; a body with several takes the product. Nothing missing from the
 * table changes: 1 is ordinary.
 *
 * What lands (shared combat.ts `strike`): raw × (1 − res_type) × susceptibility (brittle,
 * flammable, conductive, low-melting make-up: material.ts) × affinity (this table). A blow whose
 * damage comes out at WEAK_FROM or more of its raw size is shown "weak!", at RESIST_BELOW or less
 * "resists", and nothing at all "immune".
 */
export const NATURE_MATRIX: Record<string, Partial<Record<(typeof DAMAGE_TYPES)[number], number>>> = {
  // The living.
  flesh: {},
  beast: { psychic: 0.75 },
  insect: { poison: 1.5, cold: 1.5, crush: 1.5, fire: 1.25, psychic: 0.5 },
  reptile: { cold: 1.5, poison: 0.75 },
  fish: { electric: 1.5, cold: 1.25, fire: 0.5, water: 0, suffocation: 0 },
  plant: { fire: 1.5, cold: 1.25, slash: 1.25, poison: 1.25, acid: 1.25, pierce: 0.5, blunt: 0.75, psychic: 0, disease: 0.5, suffocation: 0 },
  fungus: { fire: 1.5, light: 1.25, poison: 0.5, disease: 0, psychic: 0, suffocation: 0 },
  // The dead and the otherworldly.
  undead: { holy: 1.5, fire: 1.5, light: 1.5, pierce: 0.5, cold: 0.5, psychic: 0.5, poison: 0, disease: 0, suffocation: 0, hunger: 0, unholy: 0 },
  spirit: { blunt: 0, crush: 0, earth: 0, slash: 0.25, pierce: 0.25, blast: 0.25, holy: 1.5, magic: 1.5, light: 1.5, psychic: 1.5, sonic: 1.25, cold: 0.5, fire: 0.5, poison: 0, disease: 0, acid: 0, suffocation: 0, hunger: 0 },
  demon: { holy: 1.5, light: 1.25, water: 1.25, cold: 1.25, fire: 0.25, unholy: 0, dark: 0.5 },
  holy: { unholy: 2, dark: 1.5, light: 0.5, psychic: 0.5 }, // holy harm still finds the holy: a god falls to it (TODO.md "Decided")
  fae: { magic: 0.5, psychic: 0.5, poison: 1.25 },
  // The elements.
  fire: { cold: 2, water: 2, fire: 0, poison: 0.5, wind: 0.75 },
  ice: { fire: 2, blunt: 1.25, crush: 1.25, cold: 0, water: 0.5 },
  water: { electric: 1.5, cold: 1.5, fire: 0.25, blunt: 0.5, slash: 0.5, pierce: 0.5, water: 0 },
  // What things are made of (brittleness, flammability, conductivity and melting are material.ts's).
  stone: { slash: 0.5, pierce: 0.5, fire: 0.5, electric: 0.5, earth: 0.5, cold: 0.75, crush: 1.25, sonic: 1.25, acid: 1.25, poison: 0, disease: 0, psychic: 0 },
  metal: { slash: 0.75, pierce: 0.75, fire: 0.75, acid: 1.5, water: 1.25, poison: 0, disease: 0, psychic: 0 },
  wood: { slash: 1.25, pierce: 0.75, acid: 0.75, poison: 0, disease: 0, psychic: 0 },
  glass: { sonic: 1.5, slash: 0.75, pierce: 0.75, fire: 0.75, acid: 0.5, electric: 0.25, poison: 0, disease: 0, psychic: 0 },
  cloth: { slash: 1.5, acid: 1.25, blunt: 0.5, crush: 0.5, poison: 0, disease: 0, psychic: 0 },
  paper: { slash: 1.5, water: 2, blunt: 0.5, poison: 0, disease: 0, psychic: 0 },
  plastic: { electric: 0.25, acid: 0.5, blunt: 0.75, poison: 0, disease: 0, psychic: 0 },
  bone: { blunt: 1.5, crush: 1.5, slash: 0.75, pierce: 0.5, poison: 0, disease: 0 },
  machine: { electric: 1.5, water: 1.25, acid: 1.25, psychic: 0, poison: 0, disease: 0, suffocation: 0, hunger: 0 },
};


/** A blow coming out at this share of its raw size or more is shown "weak!". */
export const WEAK_FROM = 1.25;
/** A blow coming out at this share or less is shown "resists". */
export const RESIST_BELOW = 0.75;

/** A body's natures, in order. */
export function naturesOf(s: Stats): string[] {
  return s.tags("nature");
}

/** How much of one damage type a body's natures let through (the product of NATURE_MATRIX rows). */
export function affinity(target: Stats, type: string): number {
  let k = 1;
  for (const n of target.tags("nature")) k *= (NATURE_MATRIX[n] as Record<string, number> | undefined)?.[type] ?? 1;
  return k;
}

/**
 * The whole multiplier a damage type meets on a body, before armour: its resistance (an absolute
 * one is 0), its make-up and its natures.
 */
export function damageShare(target: Stats, type: string): number {
  const res = target.num(`res_${type}`);
  return Math.max(0, (1 - Math.min(1, res)) * susceptibility(target, type) * affinity(target, type));
}

/** How a blow met its target: "weak" (WEAK_FROM or more of its raw size), "resist" (RESIST_BELOW or less), "immune" (nothing), or "". */
export type Aff = "weak" | "resist" | "immune" | "";
export function affOf(raw: number, dealt: number): Aff {
  if (!(raw > 0)) return "";
  const k = dealt / raw;
  return k <= 0 ? "immune" : k >= WEAK_FROM ? "weak" : k <= RESIST_BELOW ? "resist" : "";
}

/** Damage types too slow to name on a card (hunger and suffocation come from the world, not blows). */
const UNSHOWN = new Set(["hunger", "suffocation"]);

/** Damage only the living feel. */
const LIFELESS = new Set(["poison", "disease", "psychic"]);

/** A body's weaknesses, resistances and immunities by damage type, strongest first. */
export function weaknesses(s: Stats): { weak: [string, number][]; resist: [string, number][]; immune: string[] } {
  const weak: [string, number][] = [], resist: [string, number][] = [], immune: string[] = [];
  for (const type of DAMAGE_TYPES) {
    if (UNSHOWN.has(type)) continue;
    const k = damageShare(s, type);
    // Things that never lived are plainly beyond poison, sickness and the mind: not worth a line.
    if (k <= 0) { if (s.flag("alive") || !LIFELESS.has(type)) immune.push(type); }
    else if (k >= WEAK_FROM) weak.push([type, k]);
    else if (k <= RESIST_BELOW) resist.push([type, k]);
  }
  weak.sort((a, b) => b[1] - a[1]);
  resist.sort((a, b) => a[1] - b[1]);
  return { weak, resist, immune };
}

/** Short lines for a card: "weak to holy ×3, fire ×1.5", "resists slash ×0.5", "immune to poison". */
export function affinityText(s: Stats, most = 4): string[] {
  const { weak, resist, immune } = weaknesses(s);
  const fmt = (list: [string, number][]) => list.slice(0, most).map(([t, k]) => `${t} ×${+k.toFixed(2)}`).join(", ");
  const out: string[] = [];
  const natures = naturesOf(s).filter((n) => n !== "flesh");
  if (natures.length) out.push(natures.join(", "));
  if (weak.length) out.push(`weak to ${fmt(weak)}`);
  if (resist.length) out.push(`resists ${fmt(resist)}`);
  if (immune.length) out.push(`immune to ${immune.slice(0, most + 1).join(", ")}`);
  return out;
}
