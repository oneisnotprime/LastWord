import type { Stats } from "./stats.js";
import type { Op } from "./types.js";

/**
 * Body parts and anatomy (dictionary theme 9). A body-part noun (WINGS, CLAWS, GILLS, an ARM) is
 * grafted onto a body: spelled with someone picked (yourself, one of your creatures, anyone in
 * sight) it grows on them, else on its speller. What it does is the shared rules of any worn thing
 * (shared wear.ts `lend`) plus three of its own:
 *
 * - capability: the graft's own `GRAFT_CAPABILITIES` become the body's (GILLS breathe water, an
 *   EYE sees at night, a FANG is venomous), and its operations add the rest (WINGS fly, CLAWS
 *   slash, a HORN gores; on a body with no weapon its natural weapons are its blows).
 * - hands: each graft that grants a `held` slot (an ARM, a HAND, a TENTACLE) is another hand to
 *   hold with (`handsOf`): three arms wield a two-handed axe and a shield.
 * - cost: a graft is fed and carried (`graftCosts`): GRAFT_FOOD food a minute a kilogram, the land
 *   speed of a body carrying it falls with the weight it adds, and every graft is a seam where
 *   sickness gets in (GRAFT_SEAM less `res_disease` each).
 *
 * Counter: anything that `severs` (AMPUTATE, SEVER, a SURGEON's blows, a GUILLOTINE) cuts grafts off
 * whoever it lands on (`severing`), newest first.
 */

/** Food a minute each kilogram grafted on costs to feed. */
export const GRAFT_FOOD = 0.002;
/** `res_disease` each graft takes away: a seam where sickness gets in. */
export const GRAFT_SEAM = 0.1;
/** A graft's own properties that become the body's: what it lets the body do. */
export const GRAFT_CAPABILITIES = ["hands", "breathes", "night_vision", "sees_through", "venomous", "hover", "alarm", "immune_confuse", "immune_blind", "immune_poison"] as const;

/** True if a thing is worn as a graft. */
export const isGraft = (s: Stats): boolean => s.get("equip_slot") === "graft";

/** Hands a set of grafts adds for holding: one per graft that grants a `held` slot, times how many. */
export function handsOf(grafts: readonly { stats: Stats; count: number }[]): number {
  let n = 0;
  for (const g of grafts) if (isGraft(g.stats) && g.stats.tags("grants_equip_slots").includes("held")) n += Math.max(1, g.count);
  return n;
}

/**
 * What carrying grafts costs a body of `bodyMass` kg: food, land speed and resistance to sickness.
 * `grafts` are their masses (each already times how many).
 */
export function graftCosts(bodyMass: number, grafts: readonly number[]): Op[] {
  if (!grafts.length) return [];
  const mass = grafts.reduce((a, b) => a + Math.max(0, b), 0);
  const ops: Op[] = [["food_need", "add", Math.round(mass * GRAFT_FOOD * 1e4) / 1e4], ["res_disease", "add", -GRAFT_SEAM * grafts.length]];
  if (bodyMass > 0 && mass > 0) ops.push(["speed_land", "mul", bodyMass / (bodyMass + mass)]);
  return ops;
}

/** How many grafts something that `severs` cuts off a body carrying `grafts` of them. */
export function severing(severs: number, grafts: number): number {
  if (!(severs > 0) || grafts <= 0) return 0;
  return Number.isFinite(severs) ? Math.min(grafts, Math.ceil(severs)) : grafts;
}

/** A body part's lines for a card. */
export function bodyText(s: Stats): string[] {
  const out: string[] = [];
  if (isGraft(s)) {
    const caps = GRAFT_CAPABILITIES.filter((c) => (c === "breathes" ? s.get(c) !== "air" : c === "sees_through" ? s.tags(c).length > 0 : s.flag(c)));
    const hands = s.tags("grants_equip_slots").includes("held");
    out.push(`grafted: spelled with someone picked (you, a creature of yours, anyone in sight) it grows on them${caps.length ? `; gives ${caps.map((c) => c.replaceAll("_", " ")).join(", ")}` : ""}${hands ? "; one more hand to hold with" : ""}`);
    const mass = s.num("mass");
    if (mass > 0) out.push(`costs ${+(mass * GRAFT_FOOD).toFixed(4)} food a minute, slows on land by its weight, and opens a seam to sickness (−${GRAFT_SEAM} disease resistance)`);
  }
  const severs = s.num("severs");
  if (severs > 0) out.push(`cuts off ${Number.isFinite(severs) ? `${Math.ceil(severs)} graft${severs > 1 ? "s" : ""}` : "every graft"} from whoever it lands on`);
  return out;
}
