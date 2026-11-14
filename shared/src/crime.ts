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

/** Crime's lines for a card. */
export function crimeText(s: Stats): string[] {
  const out: string[] = [];
  if (isTrap(s)) {
    const st = s.num("stealth");
    out.push(`a trap: springs on the first enemy within ${+springReach(s).toFixed(1)} tiles, then is spent${st > 0 ? `; hidden from enemies without detect stealth ${st}` : ""}`);
  }
  return out;
}
