import type { Stats } from "./stats.js";
import { TILE_METERS } from "./world.js";

/**
 * Crime and deception (dictionary theme 17). Theft is `transfers_ownership` and `letter_steal`
 * (stealth against security; a debtor has no security against their creditor: money.ts). Traps
 * are crime's own rule:
 *
 * - a thing on the ground with `trigger_radius` is a trap (`isTrap`). Enemies whose
 *   `detect_stealth` is below its `stealth` do not see it (`hiddenFrom`): it is not sent to them.
 * - it springs on the first enemy body (a person or a creature not of its owner's side, flying
 *   things excepted) that comes within its trigger radius (`springReach`, tiles): its blow
 *   (damage, `attack_area` around) and its statuses land, and it is spent.
 * - a trap with no `single_use` is not spent: it re-arms REARM_SECONDS after it springs (a
 *   MANTRAP, a MINEFIELD, BARBWIRE, QUICKSAND), and shows to everyone until then (`rearms`).
 * - a trap that `captures` (a MANTRAP, a CHUTE), or an event that does passed on a person
 *   (INCARCERATION, INTERNMENT), drops its victim into its owner's nearest walk-in lockup within
 *   CAPTURE_TILES (interior.ts `holds`), behind the door, where the walls hold them until the door
 *   is broken, from inside or out (`capturesInto`).
 * - counters: detect_stealth sees it (a DETECTIVE, INVESTIGATE); a word whose `counters` names
 *   the trap's noun or archetype (DISARM, INVESTIGATION) breaks enemies' traps near its speller.
 *
 * Lies are `decoys` (signal.ts); extortion and blackmail are debts (money.ts).
 */

/** Detect_stealth that sees through lies and decoys (signal.ts uses it too). */
export const SEES_THROUGH = 5;

/** True if a thing on the ground is a trap. */
export const isTrap = (s: Stats): boolean => s.num("trigger_radius") > 0;

/** Tiles from a trap at which it springs. */
export function springReach(s: Stats): number {
  return Math.max(0.5, s.num("trigger_radius") / TILE_METERS);
}

/** True if a trap is hidden from a viewer of another side: its stealth beats their detect_stealth. */
export function hiddenFrom(trap: Stats, viewer: Stats): boolean {
  const stealth = trap.num("stealth");
  return stealth > 0 && viewer.num("detect_stealth") < stealth;
}

/** Seconds a trap that is not single-use takes to re-arm after it springs. */
export const REARM_SECONDS = 20;

/** Whether a trap stays set after it springs, re-arming (no `single_use`). */
export const rearms = (s: Stats): boolean => isTrap(s) && !s.flag("single_use");

/** Tiles from a capture within which its owner's lockup must stand. */
export const CAPTURE_TILES = 40;

/** Whether a trap or an event drops its victim into its owner's lockup (`captures`). */
export const capturesInto = (s: Stats): boolean => s.flag("captures");

/** Crime's lines for a card. */
export function crimeText(s: Stats): string[] {
  const out: string[] = [];
  if (isTrap(s)) {
    const st = s.num("stealth");
    out.push(`a trap: springs on the first enemy within ${+springReach(s).toFixed(1)} tiles, then ${rearms(s) ? `re-arms after ${REARM_SECONDS} s` : "is spent"}${st > 0 ? `; hidden from enemies without detect stealth ${st}` : ""}`);
  }
  if (capturesInto(s)) out.push(`captures: drops its victim into your nearest lockup within ${CAPTURE_TILES} tiles, held behind the door until it is broken`);
  return out;
}
