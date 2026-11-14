import type { Stats } from "./stats.js";

/**
 * Emotions and mental states (dictionary theme 13). Feelings are fields and statuses that move
 * the mind's properties (shared mind.ts): morale (low, a body is shaken; at nothing it breaks and
 * runs), courage (how hard fear and losses bite), loyalty, obedience and aggression. Three rules
 * are emotions' own:
 *
 * - rage: an enraged body (`rage`, shared status.ts) goes for whoever is nearest, friend or foe,
 *   strikes half again as often and as hard, aims worse and guards nothing. Counter: CALM, PEACE.
 * - love: a creature charmed for CONVERT_SECONDS or more (after its `loyalty` shortens it: a
 *   loyal DOG is hard to win) goes over to whoever charmed it, for good (`wonOver`). People are
 *   only spared. Bosses and citizens keep to themselves. Counter: LOYALTY, deafness to songs.
 * - temper: a creature of someone's with `aggression` TEMPER_FROM or more (ANGER, FURY on it)
 *   goes for enemies it sees without being told (`spoiling`).
 */

/** Seconds of charm that win a creature over. */
export const CONVERT_SECONDS = 10;
/**
 * Aggression from which a creature of someone's attacks enemies unbidden: well past a wild
 * beast's (a WOLF's 6), so only a temper raised by a word (ANGER, FURY, RAGE, FURIOUS) does it.
 */
export const TEMPER_FROM = 10;

/** True if a creature charmed for `seconds` (already shortened by its loyalty) changes sides. */
export const wonOver = (seconds: number): boolean => seconds >= CONVERT_SECONDS;

/** True if a creature of someone's goes for enemies on its own. */
export const spoiling = (s: Stats): boolean => s.num("aggression") >= TEMPER_FROM;

/** Emotions' lines for a card. */
export function emotionText(s: Stats): string[] {
  const out: string[] = [];
  if (s.num("inflict_rage") > 0) out.push("enrages whoever it reaches: they go for whoever is nearest, friend or foe");
  if (s.num("inflict_charm") > 0) out.push(`charms: people spare the charmer; a creature charmed ${CONVERT_SECONDS} s or more comes over to the charmer's side`);
  if (s.tags("effect_status").includes("rage")) out.push("calms the enraged");
  return out;
}
