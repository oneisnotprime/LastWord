import type { Stats } from "./stats.js";
import { TILE_METERS } from "./world.js";

/**
 * Machines and technology (dictionary theme 6). Machines already draw power and fuel from their
 * owner's stores (shared upkeep.ts: a GENERATOR, a DAM or a SOLAR panel supplies the grid, every
 * machine draws on it and stalls when it runs dry) and turn vowels into M (tools/producers.txt).
 * Two rules are technology's own:
 *
 * - eyes: a thing left on the ground that watches (`map_reveal` tiles, or `detect_life` or a
 *   `sight_range` of EYE_SIGHT metres or more: a CAMERA, a RADAR, a SATELLITE dish, a
 *   WATCHTOWER) shows its owner the land and the living things around it on their minimap,
 *   wherever they are (`eyeOf`). Counter: break it, blind it (SMOKE, FOG), or keep out of its sight.
 * - automation: a machine with `labor` (a CONVEYOR, an ASSEMBLY line, an AUTOMATON) left on the
 *   ground and running works the producers near it as hired hands would (`automates`), without
 *   food. Counter: cut its power (break the generator), or break it.
 */

/** Metres of sight from which a thing on the ground counts as watching. */
export const EYE_SIGHT = 100;

/** Tiles of ground a thing on the ground watches for its owner, or 0. */
export function eyeOf(s: Stats): number {
  if (s.flag("alive")) return 0;
  const sight = s.num("sight_range");
  const tiles = Math.max(s.num("map_reveal"), s.num("detect_life") / TILE_METERS, sight >= EYE_SIGHT ? sight / TILE_METERS : 0);
  return tiles > 0 ? (Number.isFinite(tiles) ? Math.round(tiles * 10) / 10 : Infinity) : 0;
}

/** Labour a machine on the ground gives the producers near it (not alive, `labor`, times how many). */
export function automates(s: Stats, count = 1): number {
  if (s.flag("alive")) return 0;
  return Math.max(0, s.num("labor")) * Math.max(1, count);
}

/** Technology's lines for a card. */
export function techText(s: Stats): string[] {
  const out: string[] = [];
  const eye = eyeOf(s);
  if (eye > 0 && !s.flag("portable")) out.push(`watches ${Number.isFinite(eye) ? `${eye} tiles` : "the whole map"} around where it stands: you see that land and who is in it on your minimap`);
  else if (eye > 0) out.push(`put down, it watches ${Number.isFinite(eye) ? `${eye} tiles` : "the whole map"} around it on your minimap`);
  const work = automates(s);
  if (work > 0) out.push(`automated: on the ground and powered it works your producers near it (labour ${+work.toFixed(2)}), needing no food`);
  return out;
}
