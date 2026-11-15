import type { Stats } from "./stats.js";

/**
 * Death and coming back (concept "death and respawn"), read from shared properties:
 *
 * - `prevents_death`: extra lives. When a body would die, a life is used instead: from what it
 *   has on it (buffs that granted one first, then carried and worn things, then its own body;
 *   ABS never runs out) and it stands again at REBORN_SHARE of full health, untouchable for
 *   REBORN_SECONDS. A killing blow from something with `denies_revival` cannot be cheated.
 * - `last_stand`: with no life left, it fights on that many seconds unable to fall, enraged, then
 *   falls to whoever downed it.
 * - Ghosts: a knocked-out person haunts the map as a ghost until the round ends. Ghosts never
 *   count as alive; they glide through everything, nothing touches them, and they may spell only
 *   words with `haunts`, free of letters, one every GHOST_GAP seconds.
 * - `revives`: a ghost brought back with that share of full health, from a word spelled with the
 *   ghost clicked (within REVIVE_TILES of its speller... or its reach), or by a follower or thing
 *   of their side within REVIVE_TILES, once every REVIVE_COOLDOWN seconds each.
 * - Graves: a person who falls leaves a GRAVE holding the rarer half of their letters (all of
 *   them with nobody to take them, or into their own tomb: `entombs`); anyone who takes or breaks
 *   it gets them, and a revived ghost gets back what it still holds.
 * - `raises`: whatever its holder kills, or whatever dies in its area, rises as that creature
 *   under the killer's (or area maker's) command: a ZOMBIE's victims rise as zombies.
 */

/** Share of full health a body stands again at when it uses a life. */
export const REBORN_SHARE = 1;
/** Seconds untouchable after using a life. */
export const REBORN_SECONDS = 3;
/** Seconds between a ghost's words. */
export const GHOST_GAP = 12;
/** A ghost's gliding speed, tiles a second. */
export const GHOST_SPEED = 3;
/** A ghost's sight, tiles. */
export const GHOST_SIGHT = 30;
/** Tiles a reviving follower or thing reaches a ghost from. */
export const REVIVE_TILES = 3;
/** Seconds between revivals by one follower or thing. */
export const REVIVE_COOLDOWN = 60;
/** Letters of the fallen kept in their grave: the rarer this share; the killer takes the rest. */
export const GRAVE_SHARE = 0.5;

/** Extra lives a body or thing has (Infinity for ABS). */
export function livesOf(s: Stats): number {
  const n = s.num("prevents_death");
  return n === Infinity ? Infinity : Math.max(0, Math.floor(n));
}

/** Seconds of last stand a body or thing gives. */
export function lastStandOf(s: Stats): number {
  const n = s.num("last_stand");
  return Number.isFinite(n) ? Math.max(0, n) : 60;
}

/** The creature what it kills rises as, or "". */
export function raisesOf(s: Stats): string {
  return String(s.get("raises") ?? "").toLowerCase();
}

/** Share of full health a ghost it revives gets back (0: it does not revive). */
export function revivesOf(s: Stats): number {
  const n = s.num("revives");
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

/** Letters split at a death: the commoner half to the killer, the rarer half into the grave. */
export function graveSplit(letters: string, killed: boolean): { grave: string; loot: string } {
  if (!killed) return { grave: letters, loot: "" };
  const order = "etaoinshrdlcumwfgypbvkjxqz";
  const sorted = [...letters].sort((a, b) => order.indexOf(b) - order.indexOf(a));
  const n = Math.ceil(sorted.length * GRAVE_SHARE);
  return { grave: sorted.slice(0, n).join(""), loot: sorted.slice(n).join("") };
}

/** What a word does about death, in short lines for its card. */
export function deathText(s: Stats): string[] {
  const out: string[] = [];
  const lives = livesOf(s);
  if (lives) out.push(lives === Infinity ? "cannot stay dead" : `${lives} extra ${lives === 1 ? "life" : "lives"}`);
  const stand = lastStandOf(s);
  if (stand > 0) out.push(`last stand: fights on ${Math.round(stand)} s past death`);
  const rev = revivesOf(s);
  if (rev > 0) out.push(`revives a ghost at ${Math.round(rev * 100)}%`);
  if (s.flag("haunts")) out.push("a ghost may spell it");
  const raises = raisesOf(s);
  if (raises) out.push(`its dead rise as ${raises.toUpperCase()}`);
  if (s.flag("entombs")) out.push("its owner's letters lie in it when they fall");
  if (s.flag("denies_revival")) out.push("no coming back from its deaths");
  return out;
}
