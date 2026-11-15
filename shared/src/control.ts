import type { Stats } from "./stats.js";

/**
 * Control (concept batch: combat): who steers a body. Read by the server's `walk` and `compel`
 * for people, creatures and bots alike.
 *
 * - `wobble` (DRUNK, a BEER, the `drunk` status): it veers side to side as it walks, wider the
 *   higher (WOBBLE_TILES a point), and now and then lurches.
 * - `reversed` (BACKWARD, the `reverse` status): it walks the opposite way to where it means to.
 * - `hypnosis` (status): whoever put it on steers the body: it walks as they walk and strikes what
 *   they strike, never them.
 * - `leash` (status): tethered to whoever put it on (or the spot, if a thing or an area did): never
 *   farther than LEASH_TILES, dragged along at their pace.
 * - `magnetism` (MAGNET, LODESTONE): a body that carries one pulls enemies who carry metal toward
 *   it (MAGNET_TILES a point of magnetism, faster the more metal).
 *
 * Counters, by meaning (tools/derive.py): SOBER, COFFEE end drunk; AWAKEN and whatever wakes or
 * frees the mind end hypnosis; a blade that cuts cords (SCISSORS, SHEARS) carried or used snaps
 * a leash; ANCHORED bodies are not dragged or pulled.
 */

/** Tiles of sideways sway a second for each point of wobble. */
export const WOBBLE_TILES = 0.12;
/** How far a leash lets its victim go from its holder. */
export const LEASH_TILES = 4;
/** Tiles of magnet reach for each point of magnetism. */
export const MAGNET_TILES = 1.5;
/** Magnetism from which a carried thing pulls. */
export const MAGNET_FROM = 3;
/** Metres a second of pull for each point of magnetism, before the metal carried is counted. */
export const MAGNET_PULL = 0.25;
/** Conductivity from which a thing counts as metal to a magnet. */
export const METAL_FROM = 5;

/**
 * Sideways tiles a wobbling body drifts this tick: a slow sway (two seconds a swing) plus a lurch
 * drawn from `noise` (-1 to 1). `seconds` is the tick, `t` the clock, `phase` the body's own offset.
 */
export function wobbleDrift(wobble: number, t: number, phase: number, noise: number, seconds: number): number {
  if (!(wobble > 0)) return 0;
  return WOBBLE_TILES * wobble * (Math.sin(t * Math.PI + phase) * 1.4 + noise) * seconds;
}

/** The point a reversed body walks toward when it means to go to `to`: mirrored through where it stands. */
export function mirrored(at: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  return { x: 2 * at.x - to.x, y: 2 * at.y - to.y };
}

/** True if a body's controls are reversed. */
export const isReversed = (s: Stats): boolean => s.num("reversed") > 0;

/** True for a thing a magnet pulls: conductive (iron, steel) or made of metal. */
export function isMetal(s: Stats): boolean {
  return s.num("conductivity") >= METAL_FROM || s.tags("nature").includes("metal");
}

/**
 * Metres a second a magnet of `magnetism` pulls a body carrying `metalKg` of metal from `tiles`
 * away: none past its reach, more for more metal (the square root of the kilograms, at least 1).
 */
export function magnetPull(magnetism: number, metalKg: number, tiles: number): number {
  if (!(magnetism >= MAGNET_FROM) || !(metalKg > 0) || tiles > magnetism * MAGNET_TILES) return 0;
  return MAGNET_PULL * magnetism * Math.max(1, Math.sqrt(metalKg)) * (1 - tiles / (magnetism * MAGNET_TILES + 1e-9));
}

/** Where a leashed body may be: pulled back to LEASH_TILES from its holder if it is farther. */
export function leashed(at: { x: number; y: number }, holder: { x: number; y: number }, tiles = LEASH_TILES): { x: number; y: number } | null {
  const dx = at.x - holder.x, dy = at.y - holder.y, d = Math.hypot(dx, dy);
  if (d <= tiles) return null;
  return { x: holder.x + (dx / d) * tiles, y: holder.y + (dy / d) * tiles };
}

/** What a word does to control, in short lines for its card. */
export function controlText(s: Stats): string[] {
  const out: string[] = [];
  if (s.num("wobble") > 0) out.push(`drunk sway ${+s.num("wobble").toFixed(1)}`);
  if (s.num("reversed") > 0) out.push("controls reversed");
  if (s.num("inflict_hypnosis") > 0) out.push("hypnotizes: you steer them, they strike what you strike");
  if (s.num("inflict_leash") > 0) out.push(`leashes them to you: ${LEASH_TILES} tiles at most`);
  if (s.num("magnetism") >= MAGNET_FROM) out.push(`pulls metal within ${Math.round(s.num("magnetism") * MAGNET_TILES)} tiles`);
  return out;
}
