import type { Stats } from "./stats.js";

/**
 * Disease and medicine (dictionary theme 12). Sickness is a status (`sick`, shared status.ts): it
 * wastes the body (disease damage a second, weaker, slower, working less, low in spirit) and it
 * passes on. Three rules:
 *
 * - contagion: whoever is sick passes it, once a second, to every living body within CONTACT_TILES
 *   (people and creatures, friend or foe) at its `contagion` a minute (`catchChance`); what gave it
 *   says how catching it is (PLAGUE 0.4, FLU 0.7; SICK_CONTAGION if it says nothing), and the one
 *   who catches it carries the same. A body's `res_disease` cuts the chance; 1 or more (a VACCINE)
 *   or `immune_sick` means it never catches it. Rats, fleas and mosquitoes give it with their bite.
 * - immunity: whoever gets over it is immune for IMMUNE_SECONDS (`recovered`).
 * - quarantine: inside an area whose `law` names `contact` (QUARANTINE, LOCKDOWN), it does not pass.
 *
 * Cures end it (`effect_status` sick: MEDICINE, ANTIBIOTIC, a HOSPITAL's field, a DOCTOR's care).
 * Counters go both ways: CURE and VACCINE end plagues' fields; a SUPERBUG ends antibiotics'.
 */

/** Tiles within which a sick body passes it on. */
export const CONTACT_TILES = 2;
/** How catching sickness is a minute when what gave it says nothing. */
export const SICK_CONTAGION = 0.3;
/** Seconds a body that got over sickness cannot catch it again. */
export const IMMUNE_SECONDS = 180;

/** The chance a body catches sickness from one carrier near it over `seconds`. */
export function catchChance(contagion: number, body: Stats, seconds: number): number {
  if (body.flag("immune_sick") || !body.flag("alive")) return 0;
  const guard = Math.min(1, Math.max(0, body.num("res_disease")));
  const p = Math.min(1, Math.max(0, contagion)) * (1 - guard);
  return p > 0 ? 1 - (1 - p) ** (seconds / 60) : 0;
}

/** True while a body that got over sickness at `since` (room seconds) is still immune at `now`. */
export const recovered = (since: number | undefined, now: number): boolean => since !== undefined && now - since < IMMUNE_SECONDS;

/** Disease's lines for a card. */
export function diseaseText(s: Stats): string[] {
  const out: string[] = [];
  const sick = s.num("inflict_sick");
  if (sick > 0) out.push(`makes whoever it reaches sick, and the sick pass it to anyone within ${CONTACT_TILES} tiles (${Math.round((s.num("contagion") || SICK_CONTAGION) * 100)}% a minute)`);
  if (s.tags("effect_status").includes("sick")) out.push("cures sickness; whoever gets over it is immune for a while");
  if (s.tags("law").includes("contact")) out.push("quarantine: sickness does not pass between bodies inside");
  if (s.flag("immune_sick") || s.num("res_disease") >= 1) out.push("cannot catch sickness");
  return out;
}
