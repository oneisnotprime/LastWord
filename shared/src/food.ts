import type { Dictionary } from "./dictionary.js";
import type { Stats } from "./stats.js";
import type { Spelled } from "./unit.js";

/**
 * Food and cooking (dictionary theme 8), read the same way for every word:
 *
 * - Heat cooks: anything `raw` lying or carried within COOK_RANGE tiles of something at
 *   COOK_HEAT °C or hotter (an OVEN, a CAMPFIRE, a FIRE, a BURNING dragon, a cook who has cast
 *   BAKE on themselves) for COOK_SECONDS becomes its `cooks_into` (DOUGH bakes into BREAD), or
 *   else takes on COOKED, a state that takes no adjective slot.
 * - Time spoils: anything with a `shelf_life` (minutes) older than that takes on ROTTEN.
 *   Preserving words set `shelf_life` to 0, which keeps for ever (SALTED, SMOKED, FROZEN).
 * - Eating is using (shared `useObject`): `nutrition` fills the food store, `restores` heals,
 *   `effect_status` cures, ops act for `duration`, and `toxicity` poisons whoever eats it for
 *   TOXIN_SECONDS a point, unless they are immune.
 *
 * COOKED and ROTTEN are ordinary adjectives in the data: what cooking and rotting do is theirs.
 */
export const COOK_HEAT = 150;
export const COOK_RANGE = 3;
export const COOK_SECONDS = 8;
export const TOXIN_SECONDS = 6;
export const COOKED = "cooked";
export const ROTTEN = "rotten";

/** True for something heat changes: raw food, dough, clay. */
export const cookable = (s: Stats): boolean => s.flag("raw");

/** True for something hot enough to cook with. */
export const cooks = (s: Stats): boolean => s.num("temperature") >= COOK_HEAT;

/** True once a thing made `minutes` ago has gone off. */
export function spoils(s: Stats, minutes: number): boolean {
  const life = s.num("shelf_life");
  return life > 0 && Number.isFinite(life) && minutes >= life;
}

/** States a spelled thing has taken on (cooked, rotten): adjectives that take no slot. */
export const statesOf = (s: Spelled): string[] => s.states ?? [];

/**
 * What heat makes of a raw thing: its `cooks_into` noun if the dictionary has one (the count kept,
 * adjectives kept while the new noun has room), else the same thing COOKED. Null if it is not raw.
 */
export function cooked(dict: Dictionary, s: Spelled, stats: Stats): Spelled | null {
  if (!cookable(stats)) return null;
  const into = String(stats.get("cooks_into") || "");
  const next = into ? dict.word(into) : undefined;
  if (next && next.role === "noun") {
    const slots = Number(next.set.adjective_slots ?? dict.property("adjective_slots").default);
    const adjectives = (s.adjectives ?? []).slice(0, slots);
    return { noun: into, ...(adjectives.length ? { adjectives } : {}), ...(s.count ? { count: s.count } : {}), ...(s.states?.length ? { states: s.states.filter((x) => x !== ROTTEN) } : {}) };
  }
  if (!dict.word(COOKED)) return null;
  return { ...s, states: [...statesOf(s).filter((x) => x !== COOKED), COOKED] };
}

/** The same thing gone off, or null if it already has. */
export function rotted(dict: Dictionary, s: Spelled): Spelled | null {
  if (!dict.word(ROTTEN) || statesOf(s).includes(ROTTEN)) return null;
  return { ...s, states: [...statesOf(s), ROTTEN] };
}

/** Seconds of poison eating (or drinking) a thing gives, from its toxicity. */
export function toxin(s: Stats): number {
  const t = s.num("toxicity");
  return t > 0 ? Math.min(600, t * TOXIN_SECONDS) : 0;
}

/** Lines for a card: what heat and time do to it. */
export function foodText(dict: Dictionary, s: Stats): string[] {
  const out: string[] = [];
  if (cookable(s)) {
    const into = String(s.get("cooks_into") || "");
    out.push(`raw: near heat (${COOK_HEAT}°C, ${COOK_RANGE} tiles) it ${into && dict.word(into) ? `becomes ${into.toUpperCase()}` : "cooks"} in ${COOK_SECONDS} s`);
  }
  if (cooks(s)) out.push(`hot enough to cook raw food within ${COOK_RANGE} tiles`);
  const life = s.num("shelf_life");
  if (life > 0 && Number.isFinite(life)) out.push(`rots after ${+life.toFixed(1)} min`);
  const t = toxin(s);
  if (t > 0 && (s.flag("edible") || s.num("nutrition") > 0)) out.push(`poisons whoever eats it (${t} s)`);
  return out;
}
