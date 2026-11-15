import type { Phrase } from "./phrase.js";
import type { Stats } from "./stats.js";
import { TILE_METERS } from "./world.js";

/**
 * Harm from the sky and from areas (STORM, METEOR SHOWER, a FIRE, a TORNADO) is local, shown
 * before it lands, and kept off by shelter. Nothing an area does strikes the whole map at once:
 *
 * - An area that strikes is marked for AREA_WARNING seconds before its first strike.
 * - An area wider than CELL_FROM tiles (weather over the map, a big quake) strikes in cells: spots
 *   CELL_TILES across or the word's `attack_area`, near the people inside, each marked on the
 *   ground CELL_WARNING seconds before it lands, so whoever sees it can step out.
 * - Indoors (a walk-in building, interior.ts) or under a roof (an `enterable` building within ROOF_TILES) nothing from an area lands; on your
 *   own side's claimed ground its `shelter` share is kept off.
 */
export const AREA_WARNING = 3;
export const CELL_FROM = 8;
export const CELL_TILES = 2;
export const CELL_WARNING = 2.5;
/** How far from a person a cell may fall, in tiles. */
export const CELL_SCATTER = 4;
/** Seconds between cells near each person: the area's own strike interval, kept within these. */
export const CELL_GAP: readonly [number, number] = [4, 12];
export const ROOF_TILES = 1.5;

/** Seconds between cells near each person for an area striking `rate` times a second. */
export function cellGap(rate: number): number {
  const every = rate > 0 ? 1 / rate : CELL_GAP[1];
  return Math.min(CELL_GAP[1], Math.max(CELL_GAP[0], every));
}

/** A cell's radius in tiles: the word's `attack_area`, at least CELL_TILES and at most twice that. */
export function cellRadius(s: Stats): number {
  const area = s.num("attack_area") / TILE_METERS;
  return Math.min(CELL_TILES * 2, Math.max(CELL_TILES, Number.isFinite(area) ? area : 0));
}

/** Share of an area's blow kept off: all of it under a roof, else the shelter of your side's claim. */
export function shelterShare(roof: boolean, claimShelter: number): number {
  return roof ? 1 : Math.min(1, Math.max(0, claimShelter));
}

const hurts = (s: Stats) => s.entries().some(([id, v]) => id.startsWith("dmg_") && typeof v === "number" && v > 0);

/**
 * Whether a spelling's own strikes can land on its speller, for the spell preview: weather that
 * strikes, and an area laid around them, that spares nobody (`friendly_fire`). An area aimed
 * somewhere else never harms its own side, so it carries no warning.
 */
export function selfRisk(p: Phrase): string | null {
  if (p.kind === "object" || p.kind === "verb") return null;
  const s = p.stats;
  if (!hurts(s) || !s.flag("friendly_fire")) return null;
  const placement = String(s.get("placement"));
  const around = placement === "region" || placement === "map" || placement === "self" || placement === "sky" || p.kind === "sky";
  return around ? `strikes you too · marked ${CELL_WARNING} s before` : null;
}
