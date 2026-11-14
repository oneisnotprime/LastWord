import type { Stats } from "./stats.js";

/**
 * Sports and games (dictionary theme 24). A challenge passed on someone (`stakes`: a DUEL, a
 * WAGER, a BOUT) puts that many of each one's commonest letters into a pot and holds the two in
 * a ring (`field_radius`) for `field_duration`. Blows between them cannot kill: the one who
 * would drop is left standing at RING_FLOOR of their health and the other takes the pot, as does
 * whoever dealt more when time runs out (a draw hands the stakes back). A race (`race_to`) puts a
 * flag that far off instead: the first of the two to reach it takes the pot. A word that counters
 * a challenge voids it, stakes back; `forfeits` gives it up to the other side.
 *
 * Peace keepers (`peace`: a GAVEL, a JUDGE, a REFEREE) give whoever takes them the `truce` status
 * for that many seconds, once: untouchable, but unable to strike or spell. Ended early by any word
 * that ends truce (PROVOCATION, TAUNT).
 */

/** Share of full health a duellist who would drop is left with. */
export const RING_FLOOR = 0.1;
/** Tiles from the flag that count as reaching it. */
export const FLAG_TILES = 1.5;
/** The most letters one side can stake, whatever a word asks. */
export const STAKES_MAX = 60;
/** A challenge with no length of its own runs this many minutes. */
export const CHALLENGE_MINUTES = 2;

/** One side of a challenge: who, what they staked, and damage dealt to the other. */
export interface Side { id: string; staked: string; dealt: number }

/** A challenge between two people. */
export interface Challenge {
  word: string;
  a: Side;
  b: Side;
  /** The ring's middle and radius in tiles, or null for a race. */
  ring: { x: number; y: number; radius: number } | null;
  /** The race's flag, or null for a ring. */
  flag: { x: number; y: number } | null;
  /** Room time it ends. */
  until: number;
}

/** Whoever dealt more when time ran out, or null on a draw. */
export function ahead(c: Challenge): Side | null {
  if (c.a.dealt === c.b.dealt) return null;
  return c.a.dealt > c.b.dealt ? c.a : c.b;
}

/** The pot: both stakes. */
export const pot = (c: Challenge): string => c.a.staked + c.b.staked;

/** Where a duellist outside the ring is put back: on its edge, toward where they stand. */
export function backInRing(ring: { x: number; y: number; radius: number }, p: { x: number; y: number }): { x: number; y: number } | null {
  const dx = p.x - ring.x, dy = p.y - ring.y, d = Math.hypot(dx, dy);
  if (d <= ring.radius) return null;
  const k = (ring.radius - 0.3) / d;
  return { x: ring.x + dx * k, y: ring.y + dy * k };
}

/** Seconds of truce a peace keeper gives, or 0. */
export const peaceOf = (s: Stats): number => Math.max(0, s.num("peace") || 0);

/** What a word does as a game, in short lines for its card. */
export function sportText(s: Stats): string[] {
  const out: string[] = [];
  if (s.num("stakes") > 0) out.push(`${s.num("race_to") > 0 ? `a race to a flag ${Math.round(s.num("race_to"))} m off` : "a challenge in a ring"}: each stakes ${Math.round(Math.min(STAKES_MAX, s.num("stakes")))} letters, the winner takes the pot`);
  if (s.flag("forfeits")) out.push("gives up your challenges: the other side takes the pot");
  if (peaceOf(s) > 0) out.push(`truce for ${Math.round(peaceOf(s))} s once taken: untouchable, cannot strike or spell`);
  return out;
}
