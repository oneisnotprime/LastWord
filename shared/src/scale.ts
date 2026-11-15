import type { Stats } from "./stats.js";
import type { Op } from "./types.js";

/**
 * Scale (concept batch: combat). `size` is a body's size against what its word is by itself: 1 for
 * a WOLF as spelled, 4 for a HUGE WOLF, 0.1 for a TINY one, 0.25 while SHRINK lasts. Any word whose
 * operations scale height, length or mass scales `size` alike (tools/derive.py), so the size
 * adjectives, growing and shrinking verbs, potions and statuses all speak it.
 *
 * A word's own numbers already fit its own size (a GIANT's reach, a MOUSE's sight), so `size`
 * scales only what the adjectives do not: reach (`attack_range`) by the size, sight by its square
 * root, stride (`speed_land`) by its 0.3 power, and the hands' carrying (`carryLimit`) by its
 * square. Stature is absolute: how tall a body stands against a person, the cube root of its
 * word's mass over a person's, times its size. Stature decides the hitbox (a giant is easier to
 * reach), which doors it fits through (none over DOOR_STATURE; a body under SLIP_STATURE slips under
 * a shut one), and what it can ride: a mount no smaller than RIDE_SHARE of the rider, or, for a
 * body CARRY_RATIO times smaller than one of its own creatures, that creature even if nobody rides
 * it otherwise (a SHRUNK person rides their WOLF). The standee is drawn at its size.
 */

/** A person's mass: stature 1. */
export const PERSON_KG = 70;
/** The tallest stature that fits through a door (a walk-in building's, shared interior.ts). */
export const DOOR_STATURE = 2.2;
/** A body this small or smaller slips under a shut door. */
export const SLIP_STATURE = 0.35;
/** A rider may be at most this much taller than a mount it rides. */
export const RIDE_SHARE = 1.25;
/** A creature this many times its master's stature carries them, mountable or not. */
export const CARRY_RATIO = 3;
/** Tiles of hitbox each point of stature past a person's adds to how far a blow reaches it. */
export const HITBOX_PER_STATURE = 0.4;

/** A body's size, as a positive multiplier (1: as its word is). */
export function sizeOf(s: Stats): number {
  const k = s.num("size");
  return Number.isFinite(k) && k > 0 ? k : k === Infinity ? 1000 : 1;
}

/** How tall a body stands against a person: the cube root of its word's own mass over PERSON_KG, times its size. */
export function statureOf(baseMass: number, size: number): number {
  return Math.cbrt(Math.max(1e-6, baseMass) / PERSON_KG) * size;
}

/** What growing or shrinking by `k` does beyond what the adjectives said: reach, sight, stride. */
export function sizeOps(k: number): Op[] {
  if (!(k > 0) || !Number.isFinite(k) || k === 1) return [];
  return [["attack_range", "mul", k], ["sight_range", "mul", Math.sqrt(k)], ["speed_land", "mul", k ** 0.3]];
}

/** How much more a body's hands carry at its size: the square (strength grows with the cross-section). */
export const carryScale = (size: number): number => size * size;

/** Tiles a blow reaches farther against a body of this stature (a big target is hard to miss). */
export function hitbox(stature: number): number {
  return Math.max(0, stature - 1) * HITBOX_PER_STATURE;
}

/** Why a body of this stature cannot go through a door, or null if it fits. */
export function doorProblem(stature: number): string | null {
  return stature > DOOR_STATURE ? `too big for the door (×${+stature.toFixed(1)} a person)` : null;
}

/** True if a body this small slips under a shut door. */
export const slipsUnder = (stature: number): boolean => stature <= SLIP_STATURE;

/**
 * Why a rider cannot ride a mount by their statures, or null if size is no bar: a mount must stand
 * at least 1 / RIDE_SHARE of its rider (a GIANT does not ride a HORSE; a GIANT HORSE carries them).
 */
export function rideProblem(rider: number, mount: number, name: string): string | null {
  return rider > mount * RIDE_SHARE ? `${name.toUpperCase()} is too small to carry you` : null;
}

/** True if a body of `mount` stature carries one of `rider` stature on its back, though nobody rides it otherwise. */
export const carries = (rider: number, mount: number): boolean => mount >= rider * CARRY_RATIO;

/** What a word does to size, in a short line for its card. */
export function scaleText(s: Stats): string[] {
  const k = s.num("size");
  if (!(k > 0) || !Number.isFinite(k) || Math.abs(k - 1) < 0.05) return [];
  return [`size ×${+k.toFixed(2)}: reach ×${+k.toFixed(1)}, ${k > 1 ? "too big for doors past ×" + DOOR_STATURE : "slips under doors at ×" + SLIP_STATURE}`];
}
