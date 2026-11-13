import type { Rng } from "./rng.js";
import type { Stats } from "./stats.js";

/**
 * Minds: how living walkers (people and creatures) hold their nerve, choose whom to fight, and
 * whom they obey. Everything here reads shared properties: morale, courage, intelligence,
 * sentient, obedience, loyalty, authority, command_limit, recruit_rate and aggression.
 */

/** Ordinary morale and courage (both properties' default). */
export const NORMAL = 5;
/** Below this morale a walker is shaken: its aim is halved. */
export const SHAKEN_BELOW = 3;
/** Morale points a second a walker regains on its way back up. */
export const MORALE_RECOVERY = 0.5;
/** Below this intelligence a creature is dim: it goes for the nearest and re-routes rarely. */
export const DIM_BELOW = 3;
/** From this intelligence a creature is cunning: it picks off the weakest and retreats when hurt. */
export const CUNNING_FROM = 7;
/** A cunning creature retreats below this fraction of its integrity. */
export const RETREAT_BELOW = 0.25;
/** Below this obedience (with its master's authority added) a creature may ignore an order. */
export const DISOBEDIENT_BELOW = 3;
/** A wild creature with at least this aggression attacks whoever it sees. */
export const AGGRESSIVE_FROM = 5;
/**
 * Creatures anyone can keep without authority: a handful, the most a spelling makes as
 * separate bodies. Authority (KING, CAPTAIN, a CROWN) adds its `command_limit` to this.
 */
export const UNCOMMANDED = 12;

/**
 * Where a walker's morale is heading. A lift (LOVE, HOPE) counts in full. A drop (FEAR,
 * `fear_aura`) is scaled by courage the way fear itself is: 5 / courage, so a coward (courage 1)
 * feels it five times over and an absolute courage feels nothing.
 * `base` is the body's own morale; `now` is its morale with everything acting on it.
 */
export function moraleGoal(base: number, now: number, courage: number): number {
  const drop = base - now;
  if (!(drop > 0)) return Math.max(0, now);
  if (courage === Infinity) return base;
  return Math.max(0, base - (drop * NORMAL) / Math.max(0.5, courage));
}

/** The courage a body faces a drop in morale with: immune to fear is unshakeable. */
export function courageOf(stats: Stats): number {
  return stats.flag("immune_fear") ? Infinity : stats.num("courage");
}

/** Morale a moment later: it falls at once to its goal and climbs back at `MORALE_RECOVERY` a second. */
export function nextMorale(current: number, goal: number, seconds: number): number {
  if (goal <= current) return goal;
  return Math.min(goal, current + MORALE_RECOVERY * seconds);
}

/** At no morale at all a walker breaks: it runs from its nearest enemy and does not strike. */
export const routed = (morale: number): boolean => morale <= 0;

/** What morale does to aim: halved while shaken. */
export const moraleAim = (morale: number): number => (morale < SHAKEN_BELOW ? 0.5 : 1);

/** Seconds a creature waits before working out a chased target's route again. */
export const rerouteSeconds = (intelligence: number): number => (intelligence < DIM_BELOW ? 3 : 1);

/** A creature that may become a target, as seen by the creature choosing. */
export interface Candidate { id: string; distance: number; health: number }

/** Whom a creature goes for: the weakest if it is cunning, else the nearest. Null if none. */
export function chooseTarget(intelligence: number, candidates: readonly Candidate[]): string | null {
  let best: Candidate | null = null;
  const cunning = intelligence >= CUNNING_FROM;
  for (const c of candidates) {
    if (!best) { best = c; continue; }
    const better = cunning
      ? c.health < best.health || (c.health === best.health && c.distance < best.distance)
      : c.distance < best.distance;
    if (better) best = c;
  }
  return best?.id ?? null;
}

/** True if a creature pulls back to save itself: cunning, and below a quarter of its integrity. */
export function retreats(intelligence: number, hp: number, max: number): boolean {
  return intelligence >= CUNNING_FROM && max > 0 && hp < max * RETREAT_BELOW;
}

/**
 * True if a creature ignores an order this time. Below `DISOBEDIENT_BELOW` obedience (its own
 * plus its master's authority) the chance grows in proportion: obedience 0 never obeys, 1.5
 * ignores half the orders it is given.
 */
export function ignoresOrder(obedience: number, authority: number, rng: Rng): boolean {
  const heed = obedience + authority;
  if (!(heed < DISOBEDIENT_BELOW)) return false;
  return rng() < (DISOBEDIENT_BELOW - Math.max(0, heed)) / DISOBEDIENT_BELOW;
}

/** True if a wild creature attacks unprovoked. */
export const aggressive = (stats: Stats): boolean => stats.num("aggression") >= AGGRESSIVE_FROM;

/**
 * How many creatures someone can command: `UNCOMMANDED` plus the `command_limit` of everything
 * that is theirs (their body, what they wear, the creatures and things they own).
 */
export function commandLimit(sources: readonly Stats[]): number {
  return UNCOMMANDED + sources.reduce((n, s) => n + Math.max(0, s.num("command_limit")), 0);
}

/** The best authority among what someone is and owns. */
export function authorityOf(sources: readonly Stats[]): number {
  return Math.max(0, ...sources.map((s) => s.num("authority")));
}

/** Wild creatures a minute that what someone owns draws to them. */
export function recruitRate(sources: readonly Stats[]): number {
  return sources.reduce((n, s) => n + Math.max(0, s.num("recruit_rate")), 0);
}

/** How hard a creature is to steal: the better of its security and its loyalty. */
export function theftResistance(stats: Stats, contestedBy: string): number {
  return Math.max(stats.num(contestedBy), stats.num("loyalty"));
}
