import type { Dictionary } from "./dictionary.js";
import type { Rng } from "./rng.js";
import type { Stats } from "./stats.js";
import { Tile } from "./world.js";

/**
 * Sea and ships (dictionary theme 23). A vessel is anything mountable with speed on water and
 * none on land or in the air (a BOAT, a GALLEON): it is launched on the water nearest its maker,
 * boarded from the shore, and sails only over water (`SAIL_COST`). `waves` on an area rock the
 * vessels afloat inside it; fishing with gear lands a catch (`catchOf`); a thing that `docks`
 * (a PORT) is a market and launches its owner's vessels.
 */

/** What sailing across each tile costs: water and deep water only. */
export const SAIL_COST: Record<Tile, number> = Object.fromEntries(
  Object.values(Tile).filter((v): v is Tile => typeof v === "number").map((t) => [t, t === Tile.Water || t === Tile.DeepWater ? 1 : Infinity]),
) as Record<Tile, number>;

/** True for a vessel: mountable, with speed on water and none on land or in the air. */
export function sails(s: Stats): boolean {
  return s.flag("mountable") && s.num("speed_water") > 0 && !(s.num("speed_land") > 0) && !(s.num("speed_air") > 0);
}

/** Tiles from its maker within which a vessel finds water to launch on (or from a port that docks). */
export const LAUNCH_TILES = 12;
/** Tiles from a moored vessel within which someone on the shore can board it. */
export const BOARD_TILES = 3;
/** Tiles from a port within which its owner's vessels are launched beside it. */
export const PORT_TILES = 30;
/** T a port's owner earns for each trade someone else makes at it. */
export const PORT_TOLL = 1;

/**
 * Damage a second rough water does to a vessel afloat: twice the wave height squared, against
 * the hull's length in four-metre lengths (a 5 m BOAT in 2 m waves takes 6 a second, a 50 m
 * GALLEON in a 6 m TEMPEST under 6 against its 40000). Nothing for an anchored vessel.
 */
export function waveDamage(waves: number, length: number, anchored: boolean): number {
  if (anchored || !(waves > 0)) return 0;
  return (2 * waves * waves) / Math.max(1, length / 4);
}

/** Multiplier on a vessel's speed in waves of this height. */
export const waveSlow = (waves: number): number => 1 / (1 + Math.max(0, waves) / 4);

/**
 * The fish a catch can be: every creature that breathes water, the smaller more often (sardines
 * and cod far oftener than sharks), with its weight.
 */
export function fishTable(dict: Dictionary): [string, number][] {
  const out: [string, number][] = [];
  for (const [word, def] of dict.words) {
    if (def.role !== "noun" || def.class !== "creature" || def.set.breathes !== "water") continue;
    const mass = Number(def.set.mass ?? 1);
    out.push([word, 1 / (1 + Math.log10(Math.max(1, mass)))]);
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

/** A catch: the fish, the letter it gives (its first, J/Q/X/Z swapped for O), and food a kilogram. */
export interface Catch { fish: string; letter: string; food: number }

/** One catch from a table, or null if nothing lives in the water. */
export function catchOf(table: readonly [string, number][], dict: Dictionary, rng: Rng): Catch | null {
  if (!table.length) return null;
  let r = rng() * table.reduce((n, [, w]) => n + w, 0);
  let fish = table.at(-1)![0];
  for (const [word, w] of table) if ((r -= w) < 0) { fish = word; break; }
  const first = fish[0]!;
  const mass = Number(dict.word(fish)?.set.mass ?? 1);
  return { fish, letter: /[jqxz]/.test(first) ? "o" : first, food: Math.min(5, 0.2 + Math.sqrt(Math.max(0, mass)) / 5) };
}

/** What a word does at sea, in short lines for its card. */
export function seaText(s: Stats): string[] {
  const out: string[] = [];
  if (sails(s)) out.push(`sails at ${+s.num("speed_water").toFixed(1)} m/s: launched on the nearest water, boarded from the shore`);
  if (s.num("waves") > 0) out.push(`${+s.num("waves").toFixed(1)} m waves: rocks vessels afloat`);
  if (s.flag("docks")) out.push(`a port: a market here, ${PORT_TOLL} T toll to its owner; launches its owner's vessels`);
  return out;
}
